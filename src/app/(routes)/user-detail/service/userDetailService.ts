// src/app/(routes)/user-detail/service/userDetailService.ts
import { getAuthHeader } from "@/helper/helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// The 401 codes that mean the session itself is over (the API's
// middleware/auth.js; the admin panel reads the same list). A 401 without one
// of these -- a wrong current password, say -- is an ordinary refusal and must
// not sign anyone out.
const SESSION_END_CODES = new Set(["TOKEN_MISSING", "TOKEN_INVALID", "TOKEN_WRONG_GYM", "SESSION_ENDED"]);

/** The session is over; the page should send the member to sign in again. */
export class SessionEndedError extends Error {
  constructor() {
    super("Your session has ended. Please sign in again.");
    this.name = "SessionEndedError";
  }
}

/** A refused request. `message` is fit to show; `code` is the API's reason, when it gave one. */
export class RequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.code = code;
  }
}

// One request, with its failures turned into something a page can act on:
// no answer at all, an ended session, or a refusal with the API's own words.
async function send(path: string, init: RequestInit, fallback: string): Promise<Response> {
  if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new RequestError("We can't reach the server right now. Check your internet connection and try again.", 0);
  }
  if (res.ok) return res;

  const body = await res.json().catch(() => null);
  const code = body && typeof body.code === "string" ? (body.code as string) : undefined;
  if (res.status === 401 && code && SESSION_END_CODES.has(code)) throw new SessionEndedError();
  const message = body && (body.message || body.error);
  throw new RequestError(typeof message === "string" && message ? message : fallback, res.status, code);
}

const jsonHeaders = () => ({ "Content-Type": "application/json", ...getAuthHeader() });

export interface Address {
  id: string;
  type: "home" | "work" | "other";
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  profileImage: string;
  joinedDate: string;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  /** The phone-app sign-in name the API issues every account. */
  username?: string;
  /** False until the member opens the link emailed to a new or changed address. */
  emailVerified?: boolean;
}
export interface UpdateUserPayload {
  firstName: string;
  lastName: string;
  /**
   * Sent only when the member is changing it. Left out, the API leaves the
   * address alone -- which is how an account with no email saves its name
   * and phone.
   */
  email?: string;
  phone: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  /** Required by the API alongside a changed email; never sent otherwise. */
  currentPassword?: string;
}

/**
 * The API's refusals when a change needs the current password: none was
 * sent, it was wrong (or wrong too often: the account's password is then
 * paused for a while, and the message says so), or the account has none
 * because it only ever signed in with Google. Each comes with a sentence
 * fit to show; the API decides which applies, so the forms send what was
 * typed, even nothing, and show the answer.
 */
export const PASSWORD_REQUIRED = "PASSWORD_REQUIRED";
export const PASSWORD_INCORRECT = "PASSWORD_INCORRECT";
export const PASSWORD_NOT_SET = "PASSWORD_NOT_SET";
/** Where an account with no password sets one: the emailed "Forgot password" link. */
export const FORGOT_PASSWORD_PATH = "/authentication?mode=forgot";

export async function updateUser( payload: UpdateUserPayload) {
  const res = await send("/update/user", { method: "PUT", headers: jsonHeaders(), body: JSON.stringify(payload) }, "Update failed");
  return res.json();
}

/** Switches two-factor sign-in on or off. Switching it off needs the current password. */
export async function setTwoFactor(enabled: boolean, currentPassword?: string): Promise<{ message?: string }> {
  const res = await send(
    "/user/two-factor",
    { method: "PUT", headers: jsonHeaders(), body: JSON.stringify(currentPassword ? { enabled, currentPassword } : { enabled }) },
    "Could not update two-factor sign-in"
  );
  return res.json();
}

/**
 * Emails the signed-in member a fresh link to confirm their address.
 * `alreadyVerified` when there was nothing left to confirm. Refused (with
 * the API's sentence) for an account with no email, when the email could
 * not be sent, and when too many were asked for in an hour.
 */
export async function sendEmailConfirmation(): Promise<{ message?: string; alreadyVerified?: boolean }> {
  const res = await send("/user/verify-email/send", { method: "POST", headers: jsonHeaders() }, "We could not send the email just now. Please try again later.");
  return res.json();
}

export async function getUserDetailForProfile() {
  const res = await send("/userDetailForProfile", { method: "GET", headers: jsonHeaders() }, "Could not load your profile");
  return res.json();
}

/**
 * The member's bookings together with the gym's late-cancel rule, which the
 * same endpoint returns: cancel inside `cancelHours` of the start and the
 * session credit stays used.
 */
export interface MyBookingRow {
  id: string;
  class_id: string;
  class_name: string;
  date: string;
  start_time: string;
  end_time: string;
  instructor_name: string;
  status: "booked" | "waitlisted" | "cancelled" | "attended" | "no_show";
  waitlist_position: number | null;
  /** The booking took a session from a pack. */
  credit_used?: boolean;
}

export async function getMyBookingsWithRules(scope: "upcoming" | "past"): Promise<{ rows: MyBookingRow[]; cancelHours: number }> {
  const res = await send(`/api/gymfolio/bookings/me?scope=${scope}`, { method: "GET", headers: getAuthHeader() }, "Could not load your bookings");
  const body = await res.json();
  const hours = Number(body?.rules?.cancel_hours);
  return { rows: body?.data || [], cancelHours: Number.isFinite(hours) && hours > 0 ? hours : 0 };
}

// ---------------------------------------------------------------------------
// Removed: the product-order types and fetchers (Order, OrderItem, OrderStatus,
// statusStyles, getUserOrders, getOrderById).
//
// They existed to squeeze gym packages into the clothing store's Order shape
// so an OrdersSection component could render them, which is how a membership
// ended up with a "size" and a "colour". That component is gone, and the
// History tab below reads memberships in their own shape.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Membership history and attendance
//
// The older getUserOrders() above squeezes gym packages into the e-commerce
// Order shape so the product-order component can render them -- which is why a
// membership ends up with a "size" and a "colour". These two fetch the same
// data in its own shape instead, for the History tab.
// ---------------------------------------------------------------------------

export interface MembershipOrder {
  id: string;
  orderNumber: string;
  packageName: string;
  period: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  paymentMethod: string;
  status: string;
  purchasedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  daysLeft: number | null;
  /** Stripe renews it; cancelling means "stop renewing". */
  recurring: boolean;
  /** A card is on file at Stripe, so the billing portal can be opened. */
  manageable: boolean;
  cancelAtPeriodEnd: boolean;
  freezeResumeAt: string | null;
  sessionsTotal: number;
  sessionsLeft: number;
  invoiceNumber: string | null;
  lastPaymentError: string;
  kind: string;
}

export interface MembershipRules {
  allowMemberFreeze: boolean;
  maxFreezeDays: number;
  allowMemberCancel: boolean;
}

export interface AttendanceVisit {
  id: string;
  shift_date: string;
  date_label: string;
  day_name: string;
  check_in_time: string | null;
  check_out_time: string | null;
  still_in: boolean;
  minutes: number | null;
  duration_label: string | null;
  package_name: string;
  status: string;
  status_label: string;
}

export interface AttendanceMonth {
  key: string;
  label: string;
  visits: number;
  days: number;
  minutes: number;
  total_label: string;
  average_label: string | null;
  /**
   * Package name(s) the month's visits were taken on, from the snapshot the
   * reader writes at check-in. Absent on older API builds, and empty for
   * visits recorded before package snapshotting.
   */
  packages?: string[];
}

export interface MyAttendance {
  timezone: string;
  today: string;
  /** Set only when a month was requested; describes that month in full. */
  selected_month: AttendanceMonth | null;
  summary: {
    visits: number;
    days_present: number;
    total_minutes: number;
    total_label: string;
    average_label: string | null;
    first_visit_label: string | null;
    last_visit_label: string | null;
    streak_days: number;
    this_month: { label: string; visits: number; minutes: number; total_label: string };
    checked_in_now: boolean;
  };
  months: AttendanceMonth[];
  visits: AttendanceVisit[];
  note: string | null;
}

const DAY_MS = 86400000;

/* ----------------------- membership self-service ----------------------- */

// Why a card membership cannot be frozen, in words for the member: the
// server's own message is written for the gym's staff (it points at Stripe).
// Any other refusal is shown as the server words it.
const FREEZE_REFUSED: Record<string, string> = {
  FREEZE_PAYMENT_OUTSTANDING: "Your last card payment didn't go through — update your card below before freezing.",
  FREEZE_STRIPE_PAUSED: "Your membership can't be frozen online right now. Please ask at reception.",
  FREEZE_STRIPE_UNSUPPORTED: "Your membership can't be frozen online right now. Please ask at reception.",
};

async function membershipPost(orderId: string, action: string, body?: unknown): Promise<{ message: string; url?: string }> {
  if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  const res = await fetch(`${API_BASE_URL}/api/gymfolio/package-orders/${orderId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    const refused = typeof json?.code === "string" ? FREEZE_REFUSED[json.code] : undefined;
    throw new Error(refused || json?.message || "Request failed");
  }
  return json;
}

/** What this gym lets members do to their own membership. */
export async function getMembershipRules(): Promise<MembershipRules> {
  const res = await fetch(`${API_BASE_URL}/api/gymfolio/membership/rules`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "Could not load membership rules");
  return json.data;
}

export async function freezeMembership(orderId: string, days: number, reason: string): Promise<string> {
  return (await membershipPost(orderId, "freeze", { days, reason })).message;
}

export async function unfreezeMembership(orderId: string): Promise<string> {
  return (await membershipPost(orderId, "unfreeze")).message;
}

export async function cancelMembership(orderId: string, reason: string): Promise<string> {
  return (await membershipPost(orderId, "cancel", { reason })).message;
}

export async function resumeMembership(orderId: string): Promise<string> {
  return (await membershipPost(orderId, "resume")).message;
}

/** Sends the member to Stripe's billing portal to update their card. */
export async function openBillingPortal(orderId: string): Promise<void> {
  const { url } = await membershipPost(orderId, "billing-portal");
  if (!url) throw new Error("Could not open the billing portal");
  window.location.href = url;
}

/** Fetches the invoice PDF with the member's token and opens it. */
export async function downloadInvoice(orderId: string, number: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/gymfolio/package-orders/${orderId}/invoice.pdf`, { headers: getAuthHeader() });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.message || "Could not load the invoice");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${number}.pdf`;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** The member's package purchases, newest first, in gym terms. */
export async function getMembershipHistory(): Promise<MembershipOrder[]> {
  const res = await send("/api/gymfolio/package-orders/me?limit=100", { method: "GET", headers: jsonHeaders() }, "We could not load your membership.");

  const json = await res.json();
  const raw: Array<Record<string, unknown>> = json?.data || json?.orders || [];
  const now = Date.now();

  return raw
    .map((order) => {
      const pkg = (order.packageDetails as Record<string, unknown>) || {};
      const payment = (order.payment as Record<string, unknown>) || {};
      const subscription = (order.subscription as Record<string, unknown>) || {};
      const freeze = (order.freeze as Record<string, unknown>) || {};
      const sessions = (order.sessions as Record<string, unknown>) || {};
      const invoice = (order.invoice as Record<string, unknown>) || {};

      const endDate = subscription.endDate ? String(subscription.endDate) : null;
      const end = endDate ? new Date(endDate).getTime() : null;

      return {
        id: String(order._id || ""),
        orderNumber: String(order.orderNumber || ""),
        packageName: String(pkg.name || "Membership"),
        period: String(pkg.period || ""),
        amount: Number(payment.amount || 0),
        currency: String(payment.currency || "").toUpperCase(),
        paymentStatus: String(payment.status || ""),
        paymentMethod: String(payment.method || ""),
        status: String(order.status || ""),
        purchasedAt: payment.paidAt ? String(payment.paidAt) : order.createdAt ? String(order.createdAt) : null,
        startDate: subscription.startDate ? String(subscription.startDate) : null,
        endDate,
        // "Currently running" means paid, not cancelled, and still in date --
        // the same three conditions the front desk checks on the way in.
        isActive:
          String(payment.status) === "paid" &&
          String(order.status) !== "cancelled" &&
          !!end &&
          end >= now,
        daysLeft: end ? Math.ceil((end - now) / DAY_MS) : null,
        // Only a Stripe subscription renews by itself. A "recurring" package
        // paid by bank transfer or cash still has to be renewed by hand, and
        // showing it as auto-renewing hid "Renew now" until it lapsed.
        recurring: !!payment.stripeSubscriptionId,
        manageable: !!payment.stripeCustomerId,
        cancelAtPeriodEnd: !!subscription.cancelAtPeriodEnd,
        freezeResumeAt: freeze.resumeAt ? String(freeze.resumeAt) : null,
        sessionsTotal: Number(sessions.total || 0),
        sessionsLeft: Math.max(0, Number(sessions.total || 0) - Number(sessions.used || 0)),
        invoiceNumber: invoice.number ? String(invoice.number) : null,
        lastPaymentError: String(payment.lastPaymentError || ""),
        kind: String(pkg.kind || "membership"),
      };
    })
    .sort((a, b) => new Date(b.purchasedAt || 0).getTime() - new Date(a.purchasedAt || 0).getTime());
}

/**
 * The signed-in member's own gym visits. Never takes a person parameter.
 *
 * With `month` ("YYYY-MM") the visit list is that month COMPLETE rather than
 * the recent-visits window, so drilling into a month never shows part of it.
 */
export async function getMyAttendance(month?: string): Promise<MyAttendance> {
  const query = month ? `month=${encodeURIComponent(month)}` : "limit=180";
  const res = await send(`/api/attendance/me?${query}`, { method: "GET", headers: jsonHeaders() }, "We could not load your visits.");
  return res.json();
}
