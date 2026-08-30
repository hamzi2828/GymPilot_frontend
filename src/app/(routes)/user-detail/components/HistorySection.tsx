import React from "react";
import Link from "next/link";
import { AttendanceMonth, MembershipOrder } from "../service/userDetailService";
import { MonthByMonth } from "./MonthByMonth";

// ---------------------------------------------------------------------------
// A member's history, in the order they care about it:
//
//   1. What is running RIGHT NOW  -- the only thing most visits here are for
//   2. What they have bought before
//   3. Every month they have trained, and the package they were on then
//
// The visit-by-visit table lives in its own tab (VisitsSection); picking a
// month below opens it there.
//
// Deliberately no "order" language. A gym membership is not a parcel: it has no
// size, no colour and nothing to track in the post, which is what the previous
// tab was rendering because it reused the apparel order component.
// ---------------------------------------------------------------------------

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

// "month" is the period stored on the package; "monthly" is how a person says
// it. Without this the card reads "Billed month".
function billingLabel(period: string) {
  const p = (period || "").toLowerCase();
  if (p.includes("year")) return "Yearly";
  if (p.includes("week")) return "Weekly";
  if (p.includes("day")) return "Daily";
  if (p.includes("month")) return "Monthly";
  return period || "—";
}

// How far through the term they are. Returned as whole days so the caption and
// the bar agree, and clamped so a lapsed membership shows a full bar rather
// than one that overflows its track.
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

// One labelled fact. The membership card is read for these four values, so
// they get labels rather than being run together in a subtitle.
function Fact({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className={`mt-1 text-base font-bold ${accent ? "text-primary" : "text-black"}`}>{value}</dd>
    </div>
  );
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
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  memberships,
  months,
  loading,
  selectedMonth,
  onSelectMonth,
  onViewVisits,
}) => {
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

  const current = memberships.find((entry) => entry.isActive) || null;
  const progress = current ? termProgress(current.startDate, current.endDate) : null;
  const past = memberships.filter((entry) => entry !== current);

  return (
    <div className="space-y-10">
      {/* ---- What is running now ---- */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-black sm:text-2xl">Your membership</h2>

        {current ? (
          <div className="rounded-2xl border-2 border-primary bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Current package
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-bold text-black">{current.packageName}</h3>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
                    Active
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-4xl font-bold leading-none text-primary">
                  {current.daysLeft !== null ? current.daysLeft : "—"}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  day{current.daysLeft === 1 ? "" : "s"} left
                </p>
              </div>
            </div>

            {/* How much of the term has run. A bar answers "how much is left"
                faster than two dates and a subtraction. */}
            {progress && (
              <div className="mt-5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Day {progress.used} of {progress.total} in this billing period
                </p>
              </div>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
              <Fact label="Started" value={dateLabel(current.startDate)} />
              <Fact label="Expires" value={dateLabel(current.endDate)} />
              <Fact
                label="Days left"
                accent
                value={current.daysLeft !== null ? `${current.daysLeft} day${current.daysLeft === 1 ? "" : "s"}` : "—"}
              />
              <Fact label="Billing" value={billingLabel(current.period)} />
            </dl>

            {onViewVisits && (
              <button
                type="button"
                onClick={onViewVisits}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-2"
              >
                See how much you have used it
                <i className="fas fa-arrow-right text-xs" aria-hidden="true" />
              </button>
            )}

            {/* A week or less is the moment renewing is easy -- worth saying
                plainly rather than leaving them to do the date arithmetic. */}
            {current.daysLeft !== null && current.daysLeft <= 7 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-900">
                  Your membership ends in {current.daysLeft} day{current.daysLeft === 1 ? "" : "s"}.
                </p>
                <Link
                  href="/packages"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
                >
                  Renew now
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
            <h3 className="text-lg font-bold text-gray-900">No active membership</h3>
            <p className="mt-1 text-sm text-gray-500">
              {memberships.length
                ? "Your last package has run out. Pick one up to get back in."
                : "You have not bought a package yet."}
            </p>
            <Link
              href="/packages"
              className="mt-5 inline-block rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-black hover:opacity-90"
            >
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
                    {["Package", "Ran from", "Until", "Paid", "Status"].map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                      >
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
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        {dateLabel(entry.startDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        {dateLabel(entry.endDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-black">
                        {money(entry.amount, entry.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                            entry.paymentStatus === "paid"
                              ? "bg-gray-100 text-gray-600 ring-gray-500/20"
                              : entry.paymentStatus === "refunded"
                              ? "bg-red-50 text-red-700 ring-red-600/20"
                              : "bg-amber-50 text-amber-800 ring-amber-600/20"
                          }`}
                        >
                          {entry.paymentStatus === "paid" ? "Expired" : entry.paymentStatus}
                        </span>
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
