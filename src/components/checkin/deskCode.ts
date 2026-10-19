// Checking in by scanning the code on the front-desk screen (the web kiosk or
// the Windows desk app). The screen shows a QR code of
// https://<gym website>/checkin?c=GPD1.… that changes every 20 seconds; a
// signed-in phone sends the code to POST /api/attendance/me/checkin and is
// checked in or out at that desk.
//
// Shared by the /checkin page (what a phone's camera app opens) and the
// member portal's Check in tab.

import { getAuthHeader } from "@/helper/helper";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const DESK_CODE_PREFIX = "GPD1.";

/** What a scan that is not a desk code gets told. */
export const NOT_A_DESK_CODE = "That isn't your gym's check-in code. Scan the code on the screen at the front desk.";

// Light on purpose: the server checks the signature, the gym and the time,
// and says which was wrong. This only keeps an obviously foreign QR code
// (a menu, a payment code) from being sent at all.
const CODE_SHAPE = /^GPD1\.[A-Za-z0-9._-]{8,300}$/;

/**
 * The desk code in what a scanner read, or null. Either the screen's URL
 * (any host: the server decides whether the code is this gym's) with the
 * code in `c`, or the bare code.
 */
export function readDeskCode(text: string | null | undefined): string | null {
  const raw = (text || "").trim();
  if (!raw) return null;
  if (raw.startsWith(DESK_CODE_PREFIX)) return CODE_SHAPE.test(raw) ? raw : null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const code = (url.searchParams.get("c") || "").trim();
    return CODE_SHAPE.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** An id for one check-in attempt: 8-100 letters, digits, hyphens or underscores. */
export function newRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* not a secure context: fall through */
  }
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** The receipt the desk prints, as POST /api/desktop/punch sends it. */
export interface CheckinReceipt {
  action?: string;
  person_type?: string;
  person_name?: string;
  person_code?: string;
  person_meta?: string;
  status?: string;
  status_label?: string;
  warning?: string | null;
  alert?: { level: "ok" | "warning" | "problem"; speech: string | null } | null;
  /** "Balance due PKR 500" when a member still owes on their package. */
  balance_due_label?: string | null;
  rows?: { caption: string; value: string }[];
  check_in_time?: string | null;
  check_out_time?: string | null;
}

export type CheckinOutcome =
  | { kind: "checked_in" | "checked_out"; message: string; detail: CheckinReceipt | null }
  // Checked in (or out) a moment ago: nothing new was recorded, nothing is wrong.
  | { kind: "ignored"; message: string; detail: CheckinReceipt | null }
  // Turned away under the gym's entry rules: nothing was recorded.
  | { kind: "refused"; message: string; reason: string; detail: CheckinReceipt | null }
  // The screen has moved on to a new code: scan it again.
  | { kind: "expired"; message: string }
  | { kind: "invalid" | "desk_signed_out" | "failed"; message: string }
  | { kind: "paused"; message: string; retryAfter: number | null }
  // No answer: it may or may not have been recorded. Sent again with the same
  // request_id, the server answers with what it already has.
  | { kind: "offline"; message: string }
  | { kind: "session_ended" };

export const OFFLINE_MESSAGE =
  "We couldn't reach the server, so we can't tell whether you were checked in. Check your connection and try again — it won't be counted twice.";

const DEFAULTS = {
  expired: "That code has changed. Scan the screen again.",
  invalid: NOT_A_DESK_CODE,
  desk_signed_out: "The check-in screen is signed out. Ask at the front desk.",
  failed: "We couldn't check you in. Please try again, or ask at the front desk.",
};

function pausedMessage(retryAfter: number | null): string {
  if (!retryAfter) return "Too many check-in attempts. Wait a minute, then try again.";
  return `Too many check-in attempts. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`;
}

/** Sends a desk code for the signed-in account. Never throws. */
export async function checkInWithDeskCode(code: string, requestId: string): Promise<CheckinOutcome> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/attendance/me/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ code, request_id: requestId }),
    });
  } catch {
    return { kind: "offline", message: OFFLINE_MESSAGE };
  }
  // The proxy in front of the API answered for it: no word from the API.
  if (res.status === 502 || res.status === 503 || res.status === 504) return { kind: "offline", message: OFFLINE_MESSAGE };

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const body = json && typeof json === "object" ? json : {};
  const said = typeof body.message === "string" ? body.message.trim() : "";
  const apiCode = typeof body.code === "string" ? body.code : "";

  if (res.status === 401) return { kind: "session_ended" };
  if (apiCode === "CODE_EXPIRED" || res.status === 410) return { kind: "expired", message: said || DEFAULTS.expired };
  if (apiCode === "CODE_INVALID") return { kind: "invalid", message: said || DEFAULTS.invalid };
  if (apiCode === "DESK_SIGNED_OUT") return { kind: "desk_signed_out", message: said || DEFAULTS.desk_signed_out };
  if (apiCode === "CHECKIN_PAUSED" || res.status === 429) {
    const n = Number(body.retry_after);
    const retryAfter = Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
    return { kind: "paused", message: said || pausedMessage(retryAfter), retryAfter };
  }
  if (!res.ok) return { kind: "failed", message: said || DEFAULTS.failed };

  // 200: the same answer the desk gets from POST /api/desktop/punch.
  const detail = body.detail && typeof body.detail === "object" ? (body.detail as CheckinReceipt) : null;
  if (body.ignored === true) return { kind: "ignored", message: said || "Already checked in a moment ago.", detail };
  if (body.refused === true) {
    const reason = typeof body.reason === "string" ? body.reason : "";
    return { kind: "refused", message: said || "Entry refused. Please see the front desk.", reason, detail };
  }
  if (body.success === true) {
    const out = detail?.action ? detail.action === "check_out" : /\bout\b/i.test(said);
    return { kind: out ? "checked_out" : "checked_in", message: said, detail };
  }
  return { kind: "failed", message: said || DEFAULTS.failed };
}
