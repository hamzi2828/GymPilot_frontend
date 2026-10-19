// The gym's own subscription to GymsPilotPro, as the backend's /api/billing
// routes describe it (GymPilot_backend src/platform/controllers/billingController.js).
// Used by Settings → Billing, the admin shell's billing banner, and the
// "sign in to renew" page a lapsed gym shows instead of its site.

import { API_BASE, authHeaders } from "../_shared/api";

export const BILLING_API = `${API_BASE}/api/billing`;

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "expired" | "cancelled";
export type BillingCycle = "monthly" | "yearly";

/** How much of one plan limit the gym is using. `limit` null is unlimited. */
export interface PlanUsage {
  key: string;
  label: string;
  used: number;
  limit: number | null;
}

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
  /** One entry per plan limit; null (or missing, from an older API) when it could not be counted. */
  usage?: PlanUsage[] | null;
  /** How this gym pays GymsPilotPro, as the super admin chose. Missing from an older API (Stripe only). */
  pay?: BillingPay | null;
}

/** The way gyms pay GymsPilotPro: one at a time, chosen by the super admin. */
export type PayProvider = "safepay" | "stripe" | "generic" | "none";

/** One of GymsPilotPro's own bank accounts, for a gym paying by bank transfer. */
export interface PlatformBankAccount {
  bank_name: string;
  account_title: string;
  account_number: string;
  iban: string;
  qr_code_url: string;
}

/** The gym's last bank-transfer receipt, while GymsPilotPro checks it or after it turned it down. */
export interface PendingPayRequest {
  status: "pending" | "rejected" | null;
  reason?: string | null;
  submitted_at?: string | null;
  amount?: number | null;
}

export interface BillingPay {
  provider: PayProvider;
  label?: string;
  amount_due: number;
  currency: string;
  /** YYYY-MM-DD. */
  due_date: string | null;
  /** Bank transfer only. */
  bank_accounts?: PlatformBankAccount[];
  pending_request?: PendingPayRequest | null;
}

/** The way this gym pays, read from an older API (no `pay`) as it worked there: Stripe or nothing. */
export function payProviderOf(sub: BillingSubscription): PayProvider {
  const provider = sub.pay?.provider;
  if (provider === "safepay" || provider === "stripe" || provider === "generic" || provider === "none") return provider;
  return sub.stripeConfigured ? "stripe" : "none";
}

/** A plan on sale, as the Billing tab's plan picker shows it. Limits of 0 are unlimited. */
export interface BillingPlan {
  slug: string;
  name: string;
  description: string;
  price: { monthly: number; yearly: number; currency: string };
  limits: { maxMembers: number; maxStaff: number; maxTrainers: number; maxClasses: number };
  features: string[];
  trialDays: number;
  /** The gym's own plan. */
  current: boolean;
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
  return readResult<T>(res);
}

async function readResult<T>(res: Response): Promise<BillingResult<T>> {
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, code: json?.code, message: json?.message, data: json?.data };
}

/** `usage: false` skips the plan-usage counts (the admin banner needs only the status). */
export function getSubscription({ usage = true }: { usage?: boolean } = {}) {
  return billingRequest<BillingSubscription>(usage ? "/subscription" : "/subscription?usage=0");
}

/**
 * Starts a Stripe Checkout for the gym's plan, or for `planSlug` when the
 * owner picked another; `data.url` is where to send the owner.
 */
export function startCheckout(billingCycle?: BillingCycle, planSlug?: string) {
  return billingRequest<{ url: string }>("/checkout", "POST", {
    ...(billingCycle ? { billingCycle } : {}),
    ...(planSlug ? { planSlug } : {}),
  });
}

/**
 * Opens a Safepay checkout for the gym's plan (or `planSlug`) with
 * GymsPilotPro's own Safepay account; `data.url` is where to send the owner.
 * Safepay sends them back with ?paid=1. 409 BANK_TRANSFER_ONLY or
 * ONLINE_PAYMENT_OFF when the super admin chose another way to pay.
 */
export function startPay(billingCycle?: BillingCycle, planSlug?: string) {
  return billingRequest<{ url: string }>("/pay", "POST", {
    ...(billingCycle ? { billingCycle } : {}),
    ...(planSlug ? { planSlug } : {}),
  });
}

/** The receipt files GymsPilotPro takes, and how big one may be. */
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Sends a bank-transfer receipt for GymsPilotPro to check. A new one replaces
 * the gym's pending one.
 */
export async function uploadReceipt(file: File, { reference, note }: { reference?: string; note?: string } = {}) {
  const form = new FormData();
  form.append("receipt", file);
  if (reference?.trim()) form.append("reference", reference.trim());
  if (note?.trim()) form.append("note", note.trim());
  const res = await fetch(`${BILLING_API}/receipt`, { method: "POST", headers: authHeaders(), body: form, cache: "no-store" });
  return readResult<{ pending_request: PendingPayRequest | null }>(res);
}

/** The Stripe customer portal: card, invoices, cancellation. Not plan changes -- see changePlan. */
export function openPortal() {
  return billingRequest<{ url: string }>("/portal", "POST");
}

/** The plans on sale, the gym's own marked `current`. */
export function getPlans() {
  return billingRequest<BillingPlan[]>("/plans");
}

/**
 * Moves a gym Stripe already bills to another plan or cycle, prorated. 409
 * NO_STRIPE_SUBSCRIPTION means it must subscribe through startCheckout instead.
 */
export function changePlan(planSlug: string, billingCycle?: BillingCycle) {
  return billingRequest<{ plan: { name: string; slug: string }; billingCycle: BillingCycle; amount: number; currency: string }>(
    "/change-plan",
    "POST",
    { planSlug, ...(billingCycle ? { billingCycle } : {}) }
  );
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

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  // A bare YYYY-MM-DD is a calendar day: read as midnight UTC it shows the day before west of Greenwich.
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(iso);
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
