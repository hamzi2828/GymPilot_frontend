// src/app/(routes)/pay/payService.ts
//
// The payment link a member is sent before, on and after the day their
// membership falls due. The link is the key: it names one order and needs no
// sign-in. The API checks its signature and its expiry on every call.

import type { BankAccount } from "../checkout/services/checkoutService";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export type PayLinkStatus = "due" | "paid" | "expired" | "cancelled";

/** GET /api/pay/:token -- what the link is for. */
export interface PayLink {
  gym_name: string;
  member_first_name: string;
  package_name: string;
  amount: number;
  currency: string;
  due_date: string | null;
  last_day: string | null;
  status: PayLinkStatus;
  /** What the gym's gateway takes: "Card, JazzCash, Easypaisa or any bank app". */
  online_label: string;
  /** The order's number, for a bank transfer's reference (when the API sends it). */
  order_number?: string;
  /** The gym charges saved cards on the due date, so the member may save one here (when the API sends it). */
  auto_pay_available?: boolean;
  /** How often the membership falls due ("month"), for the auto-pay consent (when the API sends it). */
  period?: string;
}

/**
 * A link that cannot be used: tampered with or cut short (400 LINK_INVALID),
 * past its date (410 LINK_EXPIRED), or no answer at all (status 0).
 */
export class PayLinkError extends Error {
  status: number;
  code?: string;
  /** What the link was for, when the API still says (an expired one, say). */
  data?: PayLink;

  constructor(message: string, status: number, code?: string, data?: PayLink) {
    super(message);
    this.name = "PayLinkError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function call<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new PayLinkError("We can't reach the server right now. Check your internet connection and try again.", 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    const message = json && typeof json.message === "string" && json.message ? json.message : fallback;
    const data = json && json.data && typeof json.data === "object" ? (json.data as PayLink) : undefined;
    throw new PayLinkError(message, res.status, json && typeof json.code === "string" ? json.code : undefined, data);
  }
  return json as T;
}

const tokenPath = (token: string) => `/api/pay/${encodeURIComponent(token)}`;

export async function getPayLink(token: string): Promise<PayLink> {
  const json = await call<{ data: PayLink }>(tokenPath(token), { method: "GET" }, "We could not load this payment.");
  return json.data;
}

/**
 * Starts paying: the gateway's payment page to send the browser to.
 * `autoPay` is the member's ticked consent to save the card and be charged
 * on each due date; it is only sent when given.
 */
export async function startPayLinkCheckout(token: string, autoPay = false): Promise<string> {
  const json = await call<{ url?: string }>(
    `${tokenPath(token)}/checkout`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(autoPay ? { saveCard: true, autoPayConsent: true } : {}),
    },
    "We could not start the payment. Please try again."
  );
  if (!json.url) throw new PayLinkError("We could not start the payment. Please try again.", 500);
  return json.url;
}

/** The gym's bank accounts, for paying by transfer instead (public). */
export async function getGymBanks(): Promise<BankAccount[]> {
  const json = await call<{ data?: BankAccount[] }>("/api/gymfolio/payment/banks", { method: "GET" }, "Could not load bank details");
  return json.data || [];
}

export function assetUrl(url?: string) {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `${API_BASE}${url}`;
}
