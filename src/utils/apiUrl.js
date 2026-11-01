const PRODUCTION_API = "https://carevigoapi.onrender.com/api";

export function resolveApiBaseUrl({ configured, environment, hostname } = {}) {
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  if (environment !== "development") return PRODUCTION_API;

  // Keep local cookies on the same site as the page. In particular, a page
  // opened through 127.0.0.1 cannot use localhost's SameSite=Lax session cookie.
  const host = typeof hostname === "string" && hostname.trim() ? hostname.trim() : "localhost";
  const address = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  try {
    const url = new URL(`http://${address}:8080/api`);
    if (!url.username && !url.password && url.port === "8080" && url.pathname === "/api" && !url.search && !url.hash)
      return url.href;
  } catch { /* A missing/invalid browser hostname uses the normal local default. */ }
  return "http://localhost:8080/api";
}
