import { getAuthToken, removeToken } from "@/helper/helper";

export const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
export const GYMFOLIO_API = `${API_BASE}/api/gymfolio`;
export const ATTENDANCE_API = `${API_BASE}/api/attendance`;
export const ACCOUNTS_API = `${API_BASE}/api/accounts`;

/** Where a gym goes to raise its plan's limits (Settings → Billing). */
export const BILLING_PATH = "/admin/settings?tab=billing";

/** The backend's `code` when a create is refused by the gym's platform plan. */
export const PLAN_LIMIT_REACHED = "PLAN_LIMIT_REACHED";

// The 401 codes that mean the session itself is over (see the backend's
// middleware/auth.js). A 401 without one of these -- a wrong current password,
// a wrong 2FA code -- is an ordinary failure and must not sign anyone out.
const SESSION_END_CODES = new Set(["TOKEN_MISSING", "TOKEN_INVALID", "TOKEN_WRONG_GYM", "SESSION_ENDED"]);

/**
 * A refused or unreadable API call. `message` is always fit to show as-is;
 * `code` is the backend's machine-readable reason when it sent one, so a page
 * can special-case e.g. PLAN_LIMIT_REACHED without matching on wording.
 */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** True when the call failed because the gym's plan is at its limit. */
export function isPlanLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.code === PLAN_LIMIT_REACHED;
}

/** True when the call ended the session and the page is already leaving for sign-in. */
export function isSessionEndError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && !!error.code && SESSION_END_CODES.has(error.code);
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Several requests usually fail together when a session ends; only the first
// should clear it and navigate.
let signingOut = false;

function endSession() {
  if (signingOut || typeof window === "undefined") return;
  signingOut = true;
  removeToken();
  // A full navigation rather than a router push: this runs outside React, and
  // nothing from the old session should survive into the sign-in page.
  window.location.replace("/authentication");
}

// The backend's "Upgrade the plan to add more." becomes a pointer to where
// that is actually done.
function planLimitMessage(serverMessage: string): string {
  const base = serverMessage.replace(/\s*Upgrade the plan[^.]*\.?\s*$/i, "").trim() || "This gym's plan limit has been reached.";
  return `${/[.!?]$/.test(base) ? base : `${base}.`} Upgrade your plan in Settings → Billing.`;
}

function failureMessage(status: number, serverMessage: string, code?: string): string {
  // Vercel refuses bodies over 4.5 MB before the API sees them, with a page
  // of HTML rather than JSON; the API's own upload limits answer 413 too.
  if (status === 413) return "That file is too large to upload.";
  if (code === PLAN_LIMIT_REACHED) return planLimitMessage(serverMessage);
  // Gateway failures come from the proxy in front of the API, never from the
  // API itself, so whatever they carry is not a message meant for people.
  if (status === 502 || status === 503 || status === 504) return "The server didn't respond — please try again.";
  if (serverMessage) return serverMessage;
  if (status >= 500) return "The server didn't respond — please try again.";
  return "Request failed";
}

// Status first, body second: an error page from a proxy is HTML, and parsing
// it as JSON is how "Unexpected token '<'" used to reach the screen.
async function handle<T>(request: () => Promise<Response>): Promise<T> {
  let res: Response;
  try {
    res = await request();
  } catch {
    throw new ApiError("Could not reach the server — check your connection and try again.", 0);
  }

  const text = await res.text().catch(() => "");
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }

  if (!res.ok) {
    const body = json && typeof json === "object" ? (json as { message?: unknown; code?: unknown }) : {};
    const serverMessage = typeof body.message === "string" ? body.message.trim() : "";
    const code = typeof body.code === "string" ? body.code : undefined;

    const error = new ApiError(failureMessage(res.status, serverMessage, code), res.status, code);
    if (isSessionEndError(error)) {
      error.message = "Your session has ended. Please sign in again.";
      endSession();
    }
    throw error;
  }

  // An empty success (a 204) is still a success.
  if (!text) return {} as T;
  if (json === undefined) {
    throw new ApiError("The server sent a response the panel could not read — please try again.", res.status);
  }
  return json as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  return handle<T>(() => fetch(url, { headers: authHeaders() }));
}

export async function apiJson<T>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  return handle<T>(() =>
    fetch(url, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

export async function apiForm<T>(url: string, method: "POST" | "PUT", form: FormData): Promise<T> {
  return handle<T>(() =>
    fetch(url, {
      method,
      headers: authHeaders(),
      body: form,
    })
  );
}

export function absoluteUrl(p?: string): string {
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return `${API_BASE}${p.startsWith("/") ? "" : "/"}${p}`;
}
