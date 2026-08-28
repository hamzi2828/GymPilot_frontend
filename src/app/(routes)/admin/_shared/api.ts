import { getAuthToken } from "@/helper/helper";

export const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
export const GYMFOLIO_API = `${API_BASE}/api/gymfolio`;

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "Request failed");
  return json;
}

export async function apiJson<T>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "Request failed");
  return json;
}

export async function apiForm<T>(url: string, method: "POST" | "PUT", form: FormData): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "Request failed");
  return json;
}

export function absoluteUrl(p?: string): string {
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return `${API_BASE}${p.startsWith("/") ? "" : "/"}${p}`;
}
