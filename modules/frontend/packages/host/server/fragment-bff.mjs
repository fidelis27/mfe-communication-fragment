import { FragmentFetchError, fetchFragment } from "@lib-core-mfe/fragment-frontend/server";

export const BFF_PATH = "/api/fragments";
const PROVIDER_PATH = "/api/fragments";

/** Provider origins by module name, from the same variables the Host used at build time. */
export function providersFromEnv(env) {
  return {
    student: env.VITE_MFE_STUDENT_URL ?? "http://localhost:4173",
    institution: env.VITE_MFE_INSTITUTION_URL ?? "http://localhost:4175",
    activity: env.VITE_MFE_ACTIVITY_URL ?? "http://localhost:4176",
    dashboard: env.VITE_MFE_DASHBOARD_URL ?? "http://localhost:4178",
    admin: env.VITE_MFE_ADMIN_URL ?? "http://localhost:4179",
  };
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/**
 * Fetches the Provider's stylesheet (URL from the fragment headers) so it ships inline with
 * the markup: one response to the browser, no unstyled flash while a second request runs.
 */
async function fetchFragmentStyles(stylesUrl, name) {
  if (!stylesUrl) return "";
  try {
    const response = await fetch(stylesUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return "";
    const css = (await response.text()).replaceAll("</style", "<\\/style");
    return `<style data-module-styles="${name}">${css}</style>`;
  } catch (error) {
    // Unstyled markup is better than no fragment; the client bundle still injects the styles.
    console.error(`[host] styles for "${name}" failed`, error);
    return "";
  }
}

/**
 * Host server: fetches a Provider's fragment server to server and returns its metadata plus
 * rendered HTML as JSON, so the browser can embed it without ever reaching the Provider's API.
 * Only the configured Provider origins are contacted and nothing from the request is forwarded.
 */
export function createFragmentBff({ providers, basePath = BFF_PATH }) {
  const allowedHosts = Object.values(providers);
  const prefix = `${basePath.replace(/\/+$/, "")}/`;

  return async function handleRequest(req, res, next) {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (!pathname.startsWith(prefix)) return next ? next() : sendJson(res, 404, {});
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

    const name = decodeURIComponent(pathname.slice(prefix.length));
    if (!Object.hasOwn(providers, name)) return sendJson(res, 404, { error: "Unknown module" });

    try {
      const fragment = await fetchFragment({
        host: providers[name],
        name,
        basePath: PROVIDER_PATH,
        allowedHosts,
      });
      const [markup, styles] = await Promise.all([
        fragment.html(),
        fetchFragmentStyles(fragment.styles, name),
      ]);
      const html = `${styles}${markup}`;
      const info = {
        id: fragment.id,
        name: fragment.name,
        appName: fragment.appName,
        script: fragment.script,
        ...(fragment.integrity ? { integrity: fragment.integrity } : {}),
      };
      return sendJson(res, 200, { fragment: info, html });
    } catch (error) {
      console.error(`[host] fragment "${name}" failed`, error);
      const timeout = error instanceof FragmentFetchError && /^Timeout/.test(error.message);
      return sendJson(res, timeout ? 504 : 502, { error: "Fragment unavailable" });
    }
  };
}
