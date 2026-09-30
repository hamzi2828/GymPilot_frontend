// What the fee desk reads from the API, and the formatting its screen and
// receipts share. The shapes are the backend's services/feeDesk.js and
// services/membershipLists.js, field for field.

import { GYMFOLIO_API } from "../_shared/api";

export const DESK_API = `${GYMFOLIO_API}/package-orders/desk/members`;

/** The membership a member holds, as the summary and search rows give it. */
export interface HeldMembership {
  orderId: string;
  orderNumber: string;
  packageName: string;
  status: string;
  paymentStatus: string;
  method: string;
  current: boolean;
  startDate: string | null;
  endDate: string | null;
  daysLeft: number | null;
  amount: number;
  balanceDue: number;
  currency: string;
}

export interface DeskSearchRow {
  id: string;
  name: string;
  memberCode: string | null;
  phone: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  membership: HeldMembership | null;
}

export interface DeskMember {
  id: string;
  name: string;
  memberCode: string | null;
  phone: string;
  email: string;
  gender: string | null;
  avatarUrl: string | null;
  isActive: boolean;
}

/** One membership at the desk (feeDesk.membershipOf). */
export interface DeskMembership {
  orderId: string;
  orderNumber: string;
  packageId: string | null;
  packageName: string;
  status: string;
  paymentStatus: string;
  method: string;
  startDate: string | null;
  endDate: string | null;
  /** Whole days at the gym to the end; negative once it has ended. */
  daysLeft: number | null;
  live: boolean;
  /** Paid for in advance and not begun yet. */
  startsLater: boolean;
  amount: number;
  discountAmount: number;
  discountNote: string;
  joiningFee: number;
  trainerFee: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  trainerName: string;
  autoRenews: boolean;
  stripeBilled: boolean;
  cardPaymentFailed: boolean;
}

export interface DeskDue {
  orderId: string;
  orderNumber: string;
  packageName: string;
  status: string;
  method: string;
  amount: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  stripeBilled: boolean;
}

export interface DeskPackage {
  id: string;
  name: string;
  /** null when the package's price cannot be read. */
  price: number | null;
  currency: string;
  period: string;
  kind: string;
  isActive: boolean;
}

export interface DeskView {
  member: DeskMember;
  /** The membership a renewal follows: the paid, live one that runs latest, else the latest. */
  membership: DeskMembership | null;
  /** The one running today, when a later term is already paid for. */
  running: DeskMembership | null;
  package: DeskPackage | null;
  dues: DeskDue[];
  joiningFeeDue: boolean;
  currency: string;
}

/** An order as renew, assign and payments answer it -- only what the receipt reads. */
export interface OrderResult {
  _id: string;
  orderNumber: string;
  packageDetails: { name: string; price: string; period?: string };
  payment: {
    amount: number;
    joiningFee?: number;
    trainerFee?: number;
    subtotal?: number;
    discountAmount?: number;
    discountNote?: string;
    currency: string;
    method: string;
    paidAt?: string;
    amountPaid?: number | null;
    balanceDue?: number;
    installments?: { amount: number; method?: string; at: string }[];
  };
  subscription?: { startDate?: string; endDate?: string };
  invoice?: { number?: string | null };
  status: string;
}

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
// paid through online checkout (the API refuses it here with a 422).
export const DESK_METHODS = Object.keys(METHOD_LABELS).filter((method) => method !== "stripe");

/** The method a desk form starts on: the one the member paid by last, if the desk can take it. */
export function deskMethod(method?: string | null): string {
  return method && DESK_METHODS.includes(method) ? method : "cash";
}

export const methodLabel = (method?: string | null) => (method ? METHOD_LABELS[method] || method : "");

export const STATUS_COLORS: Record<string, "neutral" | "green" | "amber" | "rose" | "blue"> = {
  pending: "amber",
  processing: "blue",
  paid: "green",
  active: "green",
  frozen: "blue",
  past_due: "amber",
  expired: "rose",
  failed: "rose",
  cancelled: "neutral",
  suspended: "rose",
  refunded: "neutral",
};

export function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function money(amount: number | null | undefined, currency: string) {
  return `${(currency || "").toUpperCase()} ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`.trim();
}

export function fmtDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** "12 days left", "Ends today", "Expired 3 days ago". */
export function daysLabel(daysLeft: number | null | undefined): string {
  if (daysLeft === null || daysLeft === undefined) return "";
  if (daysLeft === 0) return "Ends today";
  if (daysLeft > 0) return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
  const ago = -daysLeft;
  return `Expired ${ago} day${ago === 1 ? "" : "s"} ago`;
}

/** Red once ended, amber within a week, green otherwise. */
export function daysTone(daysLeft: number | null | undefined): string {
  if (daysLeft === null || daysLeft === undefined) return "text-neutral-500";
  if (daysLeft < 0) return "text-rose-700";
  if (daysLeft <= 7) return "text-amber-700";
  return "text-emerald-700";
}

/**
 * A price as the package's display string holds it ("5,000", "Rs. 5,000",
 * "40.00"): the first number in it, thousands separators dropped.
 */
export function priceNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value ?? "").match(/\d[\d,]*(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** A typed amount, or null when blank or unreadable. */
export function typedAmount(value: string): number | null {
  const text = value.trim().replace(/,/g, "");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

