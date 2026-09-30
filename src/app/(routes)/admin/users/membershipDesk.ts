// What the Users screens need to talk about memberships and money: the
// payment methods the desk records, amounts read the way the API reads them,
// and the membership the summary endpoint reports for each member.

// The backend's services/paymentMethods.js, label for label.
export const METHOD_LABELS: Record<string, string> = {
  stripe: "Card (Stripe)",
  card: "Card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  wallet: "Other mobile wallet",
};

// What the desk records by hand: every method but Stripe, which is only ever
// paid through online checkout (the API refuses it at the desk with a 422).
export const DESK_METHOD_OPTIONS = Object.entries(METHOD_LABELS)
  .filter(([value]) => value !== "stripe")
  .map(([value, label]) => ({ value, label }));

export function methodLabel(method?: string | null): string {
  return (method && METHOD_LABELS[method]) || method || "";
}

/**
 * An amount as typed: "5,000" reads as 5000, as the API reads it. Blank is
 * null; anything that is not a number of 0 or more is NaN, so a check can
 * say which field is wrong rather than treat it as nothing.
 */
export function readAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/,/g, "").trim();
  if (!text) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : NaN;
}

export function money(amount: number | null | undefined, currency?: string | null): string {
  const value = Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${(currency || "").toUpperCase()} ${value}`.trim();
}

export function shortDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** A day as a date input holds it: YYYY-MM-DD in this browser's calendar. */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A member's membership as POST /package-orders/summary reports it: the one
 * running today, else their latest, else null.
 */
export interface MembershipSummary {
  orderId: string;
  orderNumber: string;
  packageName: string;
  status: string;
  paymentStatus: string;
  method?: string | null;
  /** Paid, live and running today. */
  current: boolean;
  startDate?: string | null;
  endDate?: string | null;
  /** Whole days until it ends (negative once it has ended), or null. */
  daysLeft?: number | null;
  amount: number;
  discountAmount?: number;
  joiningFee?: number;
  trainerFee?: number;
  amountPaid?: number | null;
  balanceDue?: number;
  currency: string;
  trainerName?: string | null;
}
