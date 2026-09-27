import { checkAuth } from "../../middleware/auth.js";
import { isValidJwtSecret } from "../../utils/settings.js";
const PREFIX = "/api/management";
const reply = (error, status) =>
  Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
export function isManagementPath(path) {
  return path === PREFIX || path.startsWith(PREFIX + "/");
}
export async function handleManagement(request, env, sys) {
  if (env.MANAGEMENT_ENABLED !== "true") return reply("not_found", 404);
  const url = new URL(request.url);
  if (url.search) return reply("query_not_supported", 400);
  // No bootstrap API_SECRET authentication on administrative extensions.
  if (!sys?.password || !isValidJwtSecret(sys.jwt_secret))
    return reply("administrator_setup_required", 503);
  if (!(await checkAuth(request, env, sys, { requireCredentialVersion: true })))
    return reply("login_required", 401);
  const path = url.pathname.slice(PREFIX.length);
  const routes = new Map([
    ["/status", ["GET"]],
    ["/users", ["GET", "POST"]],
    ["/history", ["POST"]],
    ["/machines", ["GET"]],
  ]);
  const methods =
    routes.get(path) || (/^\/users\/[a-f0-9]{32}$/.test(path) ? ["PUT"] : /^\/users\/[a-f0-9]{32}\/subscription$/.test(path) ? ["POST"] : /^\/machines\/[a-z0-9_-]{1,40}$/.test(path) ? ["PUT"] : null);
  if (!methods) return reply("not_found", 404);
  if (!methods.includes(request.method))
    return reply("method_not_allowed", 405);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site")
    return reply("cross_site_request", 403);
  if (!["GET", "HEAD"].includes(request.method)) {
    if (
      request.headers.get("Origin") !== url.origin ||
      request.headers.get("X-CFSM-Management") !== "1"
    )
      return reply("csrf_rejected", 403);
    if (
      (request.headers.get("Content-Type") || "").split(";")[0].trim() !==
      "application/json"
    )
      return reply("json_required", 415);
  }
  if (!env.MANAGEMENT_ADMIN?.fetch) return reply("management_unavailable", 503);
  try {
    // Do not forward browser cookies, JWTs or arbitrary routing headers.
    const response = await env.MANAGEMENT_ADMIN.fetch(
      new Request("https://control.internal/v1" + path, {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        body: request.method === "GET" ? undefined : request.body,
        duplex: "half",
      }),
    );
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return reply("management_unavailable", 503);
  }
}
