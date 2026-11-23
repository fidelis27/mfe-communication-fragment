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
      const html = await fragment.html();
      const info = {
        id: fragment.id,
        name: fragment.name,
        appName: fragment.appName,
        script: fragment.script,
        ...(fragment.integrity ? { integrity: fragment.integrity } : {}),
        ...(fragment.styles ? { styles: fragment.styles } : {}),
      };
      return sendJson(res, 200, { fragment: info, html });
    } catch (error) {
      console.error(`[host] fragment "${name}" failed`, error);
      const timeout = error instanceof FragmentFetchError && /^Timeout/.test(error.message);
      return sendJson(res, timeout ? 504 : 502, { error: "Fragment unavailable" });
    }
  };
}
