// src/helper/tenant.server.ts
//
// Server-side counterpart of tenant.ts. Only import this from server code
// (layouts' generateMetadata, sitemap, robots): it reads the incoming
// request's headers, which client components cannot do.

import { headers } from "next/headers";
import { tenantHeaders, withTenantHost } from "./tenant";

/**
 * The domain the visitor used, as seen by the Next.js server. Behind a proxy
 * (Vercel, nginx) that is x-forwarded-host; otherwise the Host header.
 *
 * Null when there is no request -- during a static build, for instance --
 * in which case the API falls back to its default gym, if one is configured.
 */
export async function serverTenantHost(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-host") || h.get("host") || null;
  } catch {
    return null;
  }
}

/** fetch() that tells the API which gym's site is rendering. */
export async function serverTenantFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const host = await serverTenantHost();
  const merged = new Headers(init.headers || {});
  for (const [key, value] of Object.entries(tenantHeaders(host))) merged.set(key, value);
  return fetch(withTenantHost(url, host), { ...init, headers: merged });
}
