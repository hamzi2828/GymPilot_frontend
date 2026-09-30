"use client";

// The Users table's membership columns: what each member holds, when it
// runs out, what they paid and still owe -- read from POST
// /package-orders/summary for the rows on the page (one call per page).

import { money, shortDate, type MembershipSummary } from "./membershipDesk";

/** How long before the end a running membership is flagged. */
export const EXPIRING_DAYS = 7;

/**
 * Where a member stands, for the colours and the filter:
 *   running   paid, live and running today
 *   expiring  running, and ends within EXPIRING_DAYS
 *   upcoming  starts later (on its start date, paid or not): never read as
 *             running now or ending soon
 *   ended     their latest membership has run out, or was cancelled or refunded
 *   unpaid    assigned but not paid (pending), or held up (past due, suspended)
 *   none      never had one
 */
export type Standing = "running" | "expiring" | "upcoming" | "ended" | "unpaid" | "none";

export function standingOf(m: MembershipSummary | null | undefined): Standing {
  if (!m) return "none";
  const days = typeof m.daysLeft === "number" ? m.daysLeft : null;
  if (m.current) return days !== null && days <= EXPIRING_DAYS ? "expiring" : "running";
  if (["expired", "cancelled"].includes(m.status) || m.paymentStatus === "refunded" || (days !== null && days < 0)) return "ended";
  if (m.startDate && new Date(m.startDate).getTime() > Date.now()) return "upcoming";
  return "unpaid";
}

/** The membership filter. `balance` is its own question: anyone owing money. */
export type MembershipFilter = Standing | "balance" | "";

export const MEMBERSHIP_FILTER_OPTIONS: { value: MembershipFilter; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "expiring", label: `Ending within ${EXPIRING_DAYS} days` },
  { value: "ended", label: "Ended" },
  { value: "upcoming", label: "Starts later" },
  { value: "unpaid", label: "Not paid / on hold" },
  { value: "balance", label: "Balance due" },
  { value: "none", label: "No membership" },
];

export function matchesMembership(filter: MembershipFilter, m: MembershipSummary | null | undefined): boolean {
  if (!filter) return true;
  if (filter === "balance") return !!m && (m.balanceDue || 0) > 0;
  const standing = standingOf(m);
  // Ending soon is still running.
  if (filter === "running") return standing === "running" || standing === "expiring";
  return standing === filter;
}

const muted = <span className="text-xs text-neutral-400">—</span>;

/** Not loaded yet (undefined), or loading failed: a placeholder, never a wrong "none". */
function pending(m: MembershipSummary | null | undefined) {
  return m === undefined ? <span className="text-xs text-neutral-300">…</span> : null;
}

export function PackageCell({ m }: { m: MembershipSummary | null | undefined }) {
  if (m === undefined) return pending(m);
  if (!m) return <span className="text-xs text-neutral-400">none</span>;
  const standing = standingOf(m);
  const unpaid = m.paymentStatus !== "paid";
  const label: Partial<Record<Standing, string>> = {
    upcoming: `Starts ${shortDate(m.startDate)}${unpaid ? " · not paid" : ""}`,
    unpaid: m.status === "pending" ? "not paid" : m.status.replace("_", " "),
  };
  return (
    <div className="min-w-[8rem]">
      <p className="font-medium text-neutral-900">{m.packageName || "—"}</p>
      {(label[standing] || m.trainerName) && (
        <p className="text-[11px] text-neutral-500">
          {label[standing] && <span className="font-medium text-amber-700">{label[standing]}</span>}
          {label[standing] && m.trainerName ? " · " : ""}
          {m.trainerName ? `Trainer ${m.trainerName}` : ""}
        </p>
      )}
    </div>
  );
}

export function ExpiryCell({ m }: { m: MembershipSummary | null | undefined }) {
  if (m === undefined) return pending(m);
  if (!m || !m.endDate) return muted;
  const standing = standingOf(m);
  const days = typeof m.daysLeft === "number" ? m.daysLeft : null;
  let note = "";
  if (standing === "upcoming") note = `starts ${shortDate(m.startDate)}`;
  else if (standing === "ended" && (days === null || days >= 0)) note = m.paymentStatus === "refunded" ? "refunded" : m.status;
  else if (days !== null && days > 0) note = `${days} day${days === 1 ? "" : "s"} left`;
  else if (days === 0) note = "ends today";
  else if (days !== null && days < 0) note = `ended ${-days} day${days === -1 ? "" : "s"} ago`;
  const tone =
    standing === "ended"
      ? "bg-rose-50 text-rose-700"
      : standing === "expiring"
        ? "bg-amber-50 text-amber-800"
        : "text-neutral-800";
  return (
    <div className={`inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 ${tone}`}>
      <p className="text-sm">{shortDate(m.endDate)}</p>
      {note && <p className="text-[11px] opacity-80">{note}</p>}
    </div>
  );
}

export function PaidCell({ m }: { m: MembershipSummary | null | undefined }) {
  if (m === undefined) return pending(m);
  if (!m) return muted;
  return <span className="whitespace-nowrap tabular-nums">{money(m.amountPaid ?? 0, m.currency)}</span>;
}

export function DiscountCell({ m }: { m: MembershipSummary | null | undefined }) {
  if (m === undefined) return pending(m);
  if (!m || !(m.discountAmount || 0)) return muted;
  return <span className="whitespace-nowrap tabular-nums">{money(m.discountAmount, m.currency)}</span>;
}

export function BalanceCell({ m }: { m: MembershipSummary | null | undefined }) {
  if (m === undefined) return pending(m);
  if (!m || !(m.balanceDue || 0)) return muted;
  return (
    <span className="whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-rose-700">
      {money(m.balanceDue, m.currency)}
    </span>
  );
}
