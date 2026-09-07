import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AttendanceMonth,
  MembershipOrder,
  MembershipRules,
  cancelMembership,
  downloadInvoice,
  freezeMembership,
  getMembershipRules,
  openBillingPortal,
  resumeMembership,
  unfreezeMembership,
} from "../service/userDetailService";
import { MonthByMonth } from "./MonthByMonth";

function money(amount: number, currency: string) {
  if (!amount) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function billingLabel(entry: MembershipOrder) {
  if (entry.recurring) return "Auto-renews";
  const p = (entry.period || "").toLowerCase();
  if (p.includes("year")) return "Yearly";
  if (p.includes("week")) return "Weekly";
  if (p.includes("day")) return "Daily";
  if (p.includes("month")) return "Monthly";
  return entry.period || "—";
}

function termProgress(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const day = 86400000;
  const total = Math.round((end - start) / day);
  const used = Math.min(total, Math.max(0, Math.round((Date.now() - start) / day)));
  return { total, used, percent: Math.min(100, Math.max(0, (used / total) * 100)) };
}

function Fact({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className={`mt-1 text-base font-bold ${accent ? "text-primary" : "text-black"}`}>{value}</dd>
    </div>
  );
}

function StatusPill({ entry }: { entry: MembershipOrder }) {
  const map: Record<string, string> = {
    active: "bg-green-50 text-green-700 ring-green-600/20",
    frozen: "bg-sky-50 text-sky-700 ring-sky-600/20",
    past_due: "bg-amber-50 text-amber-800 ring-amber-600/20",
    pending: "bg-amber-50 text-amber-800 ring-amber-600/20",
    expired: "bg-gray-100 text-gray-600 ring-gray-500/20",
    cancelled: "bg-red-50 text-red-700 ring-red-600/20",
  };
  const label =
    entry.status === "past_due"
      ? "Payment overdue"
      : entry.status === "pending"
      ? entry.paymentStatus === "processing"
        ? "Awaiting confirmation"
        : "Awaiting payment"
      : entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${map[entry.status] || map.expired}`}>{label}</span>;
}

export interface HistorySectionProps {
  memberships: MembershipOrder[];
  /** Every month with recorded visits, newest first. */
  months: AttendanceMonth[];
  loading: boolean;
  selectedMonth: string | null;
  /** Opens a month's visits — the caller switches to the visits tab. */
  onSelectMonth: (key: string) => void;
  /** Sends the member to the visits tab, which lives next door. */
  onViewVisits?: () => void;
  /** Re-fetches memberships after the member changes one. */
  onRefresh?: () => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  memberships,
  months,
  loading,
  selectedMonth,
  onSelectMonth,
  onViewVisits,
  onRefresh,
}) => {
  const [rules, setRules] = useState<MembershipRules | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [panel, setPanel] = useState<"" | "freeze" | "cancel">("");
  const [freezeDays, setFreezeDays] = useState("7");
  const [reason, setReason] = useState("");

  useEffect(() => {
    getMembershipRules().then(setRules).catch(() => setRules(null));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-2 text-gray-500">Loading your history…</p>
        </div>
      </div>
    );
  }

  const current = memberships.find((entry) => entry.isActive || entry.status === "frozen" || entry.status === "past_due") || null;
  const pending = memberships.filter((entry) => entry.status === "pending" && entry.paymentStatus !== "failed");
  const progress = current ? termProgress(current.startDate, current.endDate) : null;
  const past = memberships.filter((entry) => entry !== current && !pending.includes(entry));

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setNotice(null);
    try {
      const message = await fn();
      if (message) setNotice({ tone: "ok", text: message });
      setPanel("");
      setReason("");
      onRefresh?.();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  };

  const canFreeze = !!current && current.status === "active" && rules?.allowMemberFreeze;
  const canCancel = !!current && current.status !== "cancelled" && rules?.allowMemberCancel && !current.cancelAtPeriodEnd;

  return (
    <div className="space-y-10">
      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm ${notice.tone === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{notice.text}</div>
      )}

      {/* ---- Waiting on a bank transfer ---- */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold text-black sm:text-2xl">Awaiting payment</h2>
          <div className="space-y-3">
            {pending.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
                <div>
                  <p className="text-base font-bold text-black">{entry.packageName}</p>
                  <p className="text-sm text-amber-900">
                    {entry.paymentMethod === "bank_transfer"
                      ? entry.paymentStatus === "processing"
                        ? "We have your transfer details and are confirming the payment."
                        : `Send ${money(entry.amount, entry.currency)} by bank transfer to activate this membership.`
                      : "This order has not been paid yet."}
                  </p>
                  <p className="text-xs text-gray-500">#{entry.orderNumber}</p>
                </div>
                {entry.paymentMethod === "bank_transfer" && (
                  <Link href={`/checkout/bank-transfer?order=${entry.id}`} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black hover:opacity-90">
                    {entry.paymentStatus === "processing" ? "View details" : "Bank details & receipt"}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- What is running now ---- */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-black sm:text-2xl">Your membership</h2>
        {current ? (
          <div className="rounded-2xl border-2 border-primary bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Current package</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-bold text-black">{current.packageName}</h3>
                  <StatusPill entry={current} />
                  {current.cancelAtPeriodEnd && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-500/20">Ends {dateLabel(current.endDate)}</span>}
                </div>
              </div>
              <div className="text-right">
                {current.sessionsTotal ? (
                  <>
                    <p className="text-4xl font-bold leading-none text-primary">{current.sessionsLeft}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">session{current.sessionsLeft === 1 ? "" : "s"} left</p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl font-bold leading-none text-primary">{current.daysLeft !== null ? current.daysLeft : "—"}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">day{current.daysLeft === 1 ? "" : "s"} left</p>
                  </>
                )}
              </div>
            </div>

            {current.status === "frozen" && (
              <p className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Frozen until {dateLabel(current.freezeResumeAt)}. The days you are away are added to the end of your membership.
              </p>
            )}
            {current.status === "past_due" && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                We could not charge your card{current.lastPaymentError ? ` (${current.lastPaymentError})` : ""}. Please update it below to keep your membership.
              </p>
            )}

            {progress && !current.sessionsTotal && (
              <div className="mt-5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Day {progress.used} of {progress.total} in this {current.recurring ? "billing" : "membership"} period
                </p>
              </div>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
              <Fact label="Started" value={dateLabel(current.startDate)} />
              <Fact label={current.recurring && !current.cancelAtPeriodEnd ? "Renews" : "Expires"} value={dateLabel(current.endDate)} />
              <Fact label="Days left" accent value={current.daysLeft !== null ? `${current.daysLeft} day${current.daysLeft === 1 ? "" : "s"}` : "—"} />
              <Fact label="Billing" value={billingLabel(current)} />
            </dl>

            {/* Self-service */}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              {current.invoiceNumber && (
                <button type="button" disabled={busy === "invoice"} onClick={() => run("invoice", () => downloadInvoice(current.id, current.invoiceNumber!))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  <i className="fas fa-file-invoice mr-2" />Invoice {current.invoiceNumber}
                </button>
              )}
              {current.manageable && (
                <button type="button" disabled={busy === "portal"} onClick={() => run("portal", () => openBillingPortal(current.id))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  <i className="fas fa-credit-card mr-2" />{current.status === "past_due" ? "Update card" : "Manage card & receipts"}
                </button>
              )}
              {canFreeze && (
                <button type="button" onClick={() => setPanel(panel === "freeze" ? "" : "freeze")} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  <i className="fas fa-snowflake mr-2" />Freeze
                </button>
              )}
              {current.status === "frozen" && (
                <button type="button" disabled={busy === "unfreeze"} onClick={() => run("unfreeze", () => unfreezeMembership(current.id))} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50">
                  Resume now
                </button>
              )}
              {current.cancelAtPeriodEnd && current.recurring && (
                <button type="button" disabled={busy === "resume"} onClick={() => run("resume", () => resumeMembership(current.id))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Keep renewing
                </button>
              )}
              {canCancel && (
                <button type="button" onClick={() => setPanel(panel === "cancel" ? "" : "cancel")} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                  {current.recurring ? "Cancel renewal" : "Cancel"}
                </button>
              )}
            </div>

            {panel === "freeze" && (
              <div className="mt-4 grid gap-3 rounded-xl border border-gray-200 p-4 sm:grid-cols-[1fr_2fr_auto]">
                <label className="text-sm">
                  <span className="block text-xs font-semibold text-gray-600">Days (max {rules?.maxFreezeDays ?? 30})</span>
                  <input type="number" min={1} max={rules?.maxFreezeDays ?? 30} value={freezeDays} onChange={(e) => setFreezeDays(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                </label>
                <label className="text-sm">
                  <span className="block text-xs font-semibold text-gray-600">Reason (optional)</span>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Travel, injury…" />
                </label>
                <div className="flex items-end">
                  <button type="button" disabled={busy === "freeze"} onClick={() => run("freeze", () => freezeMembership(current.id, Number(freezeDays), reason))} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50">
                    Freeze
                  </button>
                </div>
                <p className="sm:col-span-3 text-xs text-gray-500">Your end date moves out by the number of days you freeze. You can resume early at any time.</p>
              </div>
            )}

            {panel === "cancel" && (
              <div className="mt-4 grid gap-3 rounded-xl border border-red-200 p-4 sm:grid-cols-[2fr_auto]">
                <label className="text-sm">
                  <span className="block text-xs font-semibold text-gray-600">Tell us why (optional)</span>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                </label>
                <div className="flex items-end">
                  <button type="button" disabled={busy === "cancel"} onClick={() => run("cancel", () => cancelMembership(current.id, reason))} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    Confirm
                  </button>
                </div>
                <p className="sm:col-span-2 text-xs text-gray-500">
                  {current.recurring ? "Your card will not be charged again. You keep access until the end of the paid period." : `You keep access until ${dateLabel(current.endDate)}.`}
                </p>
              </div>
            )}

            {onViewVisits && (
              <button type="button" onClick={onViewVisits} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-2">
                See how much you have used it
                <i className="fas fa-arrow-right text-xs" aria-hidden="true" />
              </button>
            )}

            {current.daysLeft !== null && current.daysLeft <= 7 && !current.recurring && current.status === "active" && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-900">
                  Your membership ends in {current.daysLeft} day{current.daysLeft === 1 ? "" : "s"}. Renew now and the new term starts when this one ends.
                </p>
                <Link href="/packages" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black hover:opacity-90">
                  Renew now
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
            <h3 className="text-lg font-bold text-gray-900">No active membership</h3>
            <p className="mt-1 text-sm text-gray-500">
              {memberships.length ? "Your last package has run out. Pick one up to get back in." : "You have not bought a package yet."}
            </p>
            <Link href="/packages" className="mt-5 inline-block rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-black hover:opacity-90">
              See packages
            </Link>
          </div>
        )}
      </section>

      {/* ---- What they have bought before ---- */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold text-black sm:text-2xl">Previous packages</h2>
          <div className="overflow-hidden rounded-2xl border-2 border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {["Package", "Ran from", "Until", "Paid", "Status", ""].map((column) => (
                      <th key={column} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {past.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">{entry.packageName}</p>
                        <p className="text-xs text-gray-500">#{entry.orderNumber}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{dateLabel(entry.startDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{dateLabel(entry.endDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-black">{money(entry.amount, entry.currency)}</td>
                      <td className="px-4 py-3">
                        <StatusPill entry={{ ...entry, status: entry.paymentStatus === "paid" && entry.status === "active" ? "expired" : entry.status }} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry.invoiceNumber && (
                          <button type="button" disabled={busy === `inv-${entry.id}`} onClick={() => run(`inv-${entry.id}`, () => downloadInvoice(entry.id, entry.invoiceNumber!))} className="text-xs font-semibold text-primary underline underline-offset-2 disabled:opacity-50">
                            Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ---- Every month they have trained ---- */}
      <MonthByMonth
        months={months}
        memberships={memberships}
        selectedMonth={selectedMonth}
        onSelectMonth={onSelectMonth}
      />
    </div>
  );
};

export default HistorySection;
