// src/app/(routes)/user-detail/service/userDetailService.ts
import { getAuthHeader } from "@/helper/helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

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
}
export interface UpdateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
}

export async function updateUser( payload: UpdateUserPayload) {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }
  const res = await fetch(`${API_BASE_URL}/update/user`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "Update failed";
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function getUserDetailForProfile() {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }
  const res = await fetch(`${API_BASE_URL}/userDetailForProfile`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    let msg = "Get user detail failed";
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
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

async function membershipPost(orderId: string, action: string, body?: unknown): Promise<{ message: string; url?: string }> {
  if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  const res = await fetch(`${API_BASE_URL}/api/gymfolio/package-orders/${orderId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.message || "Request failed");
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
  if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");

  const res = await fetch(`${API_BASE_URL}/api/gymfolio/package-orders/me?limit=100`, {
    method: "GET",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
  });

  if (!res.ok) {
    let msg = "Failed to load your membership history";
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }

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
      const billing = (pkg.billing as Record<string, unknown>) || {};

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
        recurring: billing.mode === "recurring" || !!payment.stripeSubscriptionId,
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
  if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");

  const query = month ? `month=${encodeURIComponent(month)}` : "limit=180";
  const res = await fetch(`${API_BASE_URL}/api/attendance/me?${query}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
  });

  if (!res.ok) {
    let msg = "Failed to load your attendance";
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}
