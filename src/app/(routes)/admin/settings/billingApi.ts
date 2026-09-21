// The gym's own subscription to GymPilot, as the backend's /api/billing
// routes describe it (GymPilot_backend src/platform/controllers/billingController.js).
// Used by Settings → Billing, the admin shell's billing banner, and the
// "sign in to renew" page a lapsed gym shows instead of its site.

import { API_BASE, authHeaders } from "../_shared/api";

export const BILLING_API = `${API_BASE}/api/billing`;

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "expired" | "cancelled";
export type BillingCycle = "monthly" | "yearly";

export interface BillingSubscription {
  plan: {
    name: string;
    slug: string;
    price: { monthly: number; yearly: number; currency: string };
    trialDays: number;
  } | null;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodEnd: string | null;
  daysLeft: number | null;
  amount: number;
  currency: string;
  addons: { slug: string; name: string; amount: number }[];
  stripeConfigured: boolean;
  hasStripeSubscription: boolean;
  contactEmail: string;
}

/**
 * A billing call's answer with its HTTP status and error `code` kept: the
 * shared apiJson helper throws those away, and here they decide what to do
 * next (409 ALREADY_SUBSCRIBED means "open the portal instead", 403 means
 * "not your call").
 */
export interface BillingResult<T> {
  ok: boolean;
  status: number;
  code?: string;
  message?: string;
  data?: T;
}

export async function billingRequest<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<BillingResult<T>> {
  const res = await fetch(`${BILLING_API}${path}`, {
    method,
    headers: authHeaders(method === "POST" ? { "Content-Type": "application/json" } : {}),
    body: method === "POST" ? JSON.stringify(body || {}) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, code: json?.code, message: json?.message, data: json?.data };
}

export function getSubscription() {
  return billingRequest<BillingSubscription>("/subscription");
}

/** Starts a Stripe Checkout for the plan; `data.url` is where to send the owner. */
export function startCheckout(billingCycle?: BillingCycle) {
  return billingRequest<{ url: string }>("/checkout", "POST", billingCycle ? { billingCycle } : {});
}

/** The Stripe customer portal: card, invoices, cancellation. */
export function openPortal() {
  return billingRequest<{ url: string }>("/portal", "POST");
}

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment overdue",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    // An unusual code the browser does not know is still worth showing.
    return `${currency} ${Number(amount || 0).toLocaleString()}`;
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "3 days left", "1 day left", "today", "2 days ago". */
export function daysLeftLabel(days: number | null): string {
  if (days === null || days === undefined) return "";
  if (days === 0) return "today";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} ago`;
  return `${days} day${days === 1 ? "" : "s"} left`;
}
