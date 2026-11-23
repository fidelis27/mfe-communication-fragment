# ADR-0005: Use fragment-frontend for runtime composition

## Status

Accepted. Supersedes [ADR-0003](./0003-module-manifest-delivery.md) and
[ADR-0004](./0004-module-frontend-runtime.md).

## Context

[ADR-0004](./0004-module-frontend-runtime.md) composed the five MFEs with
`@lib-core-mfe/module-frontend`: every module was a browser-only IIFE loaded
through a manifest, so nothing was rendered before the module bundle arrived.
`@lib-core-mfe/fragment-frontend` v0.1.0 (experimental) takes the opposite
approach: the Provider renders the fragment on its own server and streams HTML,
the Consumer's server fetches it server to server, and the browser hydrates it
with the Provider's own React.

The Host is a Vite single-page app with no server, and `FragmentSlot` hydrates
markup that already exists in the page; the library has no client-render
fallback yet.

## Decision

- Each MFE registers with `registerFragment` (browser IIFE, unchanged output
  under `dist/modules`) and serves with `createFragmentHandler` from a
  self-contained server bundle (`dist/server`, built by `vite.server.config.ts`
  with everything inlined, so the Provider renders with the same React it ships).
- One shared handler (`modules/frontend/provider-handler.mjs`) serves
  `GET /api/fragments/<name>` and the client script at
  `/api/fragments/assets/<name>.client.js`. It computes the script's SHA-384
  and sends it in `x-fragment-integrity`; script CORS is limited to
  `MFE_HOST_ORIGINS`. It also serves the module styles at
  `/api/fragments/assets/<name>.css`. It runs as a Vercel Function per provider and in the
  local and E2E servers.
- The Host gets a small server, `GET /api/fragments/:module`
  (`host/server/fragment-bff.mjs`). It calls `fetchFragment` with the configured
  provider origins as the allowlist, forwards nothing from the request, and
  returns `{ fragment, html }` as JSON. `fragment.styles` (from the Provider's
  allowlisted `x-fragment-styles` header) is linked by `FragmentSlot` before the
  markup. The browser renders `<FragmentSlot fragment html>`, which hydrates with
  the Provider's React. The
  same handler runs in `vite dev`/`vite preview` and as a Vercel Function.
- The Host shell stays client-rendered. Loading, retry fallback, error reporting
  and the ready mark (now emitted when the fragment is hydrated) are kept; the
  Host handles them itself because the library does not provide them.
- Module state isolation, the global auth bridge and `globalThis.__mfeBus` are
  unchanged.

## Alternatives considered

- **Server-render the whole Host shell:** rejected for now. Authentication lives
  in the browser (Supabase session), so the server cannot render user-specific
  content, and it would turn the Host into a full SSR app.
- **Call the Provider directly from the browser:** rejected because
  `FragmentSlot` needs the HTML, `fetchFragment` is server-side only, and a
  browser call would need CORS on the fragment endpoint.
- **Keep `module-frontend`:** rejected because the goal of this migration is to
  adopt the fragment contract.

## Consequences

- The Host now needs a server runtime (Vercel Function) and the Host project
  needs the `VITE_MFE_*_URL` variables at runtime, not only at build time.
- Fragment markup is visible before it is interactive. Until the Provider
  bundle hydrates, inputs in the markup do not respond; E2E tests wait for the
  ready mark. A form submitted before hydration would submit natively.
- Provider styles are delivered with the fragment HTML by the Host server, so
  the markup is styled even before (or without) the client bundle; the bundle
  still injects the same styles when it loads. If the styles request fails, the
  fragment is sent unstyled and the error is logged.
- Provider failures after the shell has been sent, a failed script load and
  hydration errors are reported to Sentry but do not show the retry fallback.
- No manifest polling: a provider update reaches the Host on the next fragment
  request. SRI is enforced by the browser through `FragmentInfo.integrity`.
- Each Provider's server bundle inlines its React and dependencies; this
  increases function size and is not a performance claim. Measure it with the
  existing Playwright comparison before drawing conclusions.
- The library is experimental (v0.1.0) and lists CSS isolation, a `remount`
  lifecycle and a client-render fallback as not done; see
  [library feedback](../lib-feedback.md).
