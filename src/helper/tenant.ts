// src/helper/tenant.ts
//
// Which gym's website this is, as far as the API is concerned.
//
// Every gym on the platform has its own domain and all of them talk to one
// API. The API picks the gym from the request's Origin header, which the
// browser sets on every client-side fetch -- so client code needs nothing
// here. Server-side renders carry no Origin, so they send the host
// explicitly instead (see tenant.server.ts).

export const TENANT_HOST_HEADER = "X-Tenant-Host";

/** The host of the page in the browser, or null on the server. */
export function browserTenantHost(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.host || null;
}

/** Headers that name the gym for a server-side request. */
export function tenantHeaders(host: string | null): Record<string, string> {
  return host ? { [TENANT_HOST_HEADER]: host } : {};
}

/**
 * Adds the host to the URL as well as the header. Next's fetch cache keys on
 * the URL, so two gyms' identical requests must not look identical to it.
 */
export function withTenantHost(url: string, host: string | null): string {
  if (!host) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}tenantHost=${encodeURIComponent(host)}`;
}
