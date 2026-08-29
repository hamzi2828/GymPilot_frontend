import React from "react";
import Link from "next/link";
import {
  MembershipOrder,
  MyAttendance,
  AttendanceMonth,
  AttendanceVisit,
} from "../service/userDetailService";

// ---------------------------------------------------------------------------
// A member's own history, in the order they care about it:
//
//   1. What is running RIGHT NOW  -- the only thing most visits here are for
//   2. What they have bought before
//   3. How much they have actually used it
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

function Tile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${accent ? "text-primary" : "text-black"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

// The horizontal bar beside each month. One hue, sized against the busiest
// month, so a glance says "I trained more in June than July" without reading.
//
// The whole row is the click target rather than the label alone: the row is
// what reads as one thing, and a small text link inside a chart row is a miss
// waiting to happen.
function MonthRow({
  month,
  busiest,
  selected,
  onSelect,
}: {
  month: AttendanceMonth;
  busiest: number;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(month.key)}
      aria-pressed={selected}
      className={`flex w-full items-center gap-4 border-b border-gray-100 px-2 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50 ${
        selected ? "bg-gray-50" : ""
      }`}
    >
      <div className="w-28 shrink-0">
        <p className={`text-sm font-semibold ${selected ? "text-primary" : "text-gray-900"}`}>{month.label}</p>
        <p className="text-xs text-gray-500">
          {month.visits} visit{month.visits === 1 ? "" : "s"}
        </p>
      </div>

      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(3, (month.visits / Math.max(1, busiest)) * 100)}%` }}
        />
      </div>

      <div className="w-32 shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-900">{month.total_label}</p>
        {month.average_label && <p className="text-xs text-gray-500">avg {month.average_label}</p>}
      </div>

      <i
        className={`fas fa-chevron-right w-3 shrink-0 text-xs transition-transform ${
          selected ? "rotate-90 text-primary" : "text-gray-300"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

function VisitRow({ visit }: { visit: AttendanceVisit }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">{visit.date_label}</p>
        <p className="text-xs text-gray-500">{visit.day_name}</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{visit.check_in_time || "—"}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        {visit.still_in ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-green-600">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            In the gym
          </span>
        ) : (
          <span className="text-gray-700">{visit.check_out_time || "—"}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-black">
        {visit.duration_label || <span className="font-normal text-gray-400">—</span>}
      </td>
      <td className="hidden px-4 py-3 text-sm text-gray-500 sm:table-cell">{visit.package_name || "—"}</td>
    </tr>
  );
}

export interface HistorySectionProps {
  memberships: MembershipOrder[];
  attendance: MyAttendance | null;
  loading: boolean;
  /** Which month is drilled into, or null for the recent-visits view. */
  selectedMonth: string | null;
  onSelectMonth: (key: string | null) => void;
  monthLoading: boolean;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  memberships,
  attendance,
  loading,
  selectedMonth,
  onSelectMonth,
  monthLoading,
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
  const summary = attendance?.summary;
  const busiest = Math.max(1, ...(attendance?.months || []).map((month) => month.visits));
  const selected = attendance?.selected_month || null;

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

      {/* ---- How much they have used it ---- */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-bold text-black sm:text-2xl">Your visits</h2>
          {summary?.checked_in_now && (
            <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              You are checked in right now
            </span>
          )}
        </div>

        {!summary || summary.visits === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <i className="fas fa-clock text-2xl text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No visits recorded yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              {attendance?.note || "Your visits appear here once the front desk records them."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile
                label="Total visits"
                value={summary.visits}
                hint={summary.first_visit_label ? `since ${summary.first_visit_label}` : undefined}
              />
              <Tile label="Time in the gym" value={summary.total_label} hint={summary.average_label ? `avg ${summary.average_label} a visit` : undefined} />
              <Tile
                label={summary.this_month.label}
                value={summary.this_month.visits}
                hint={`${summary.this_month.total_label} this month`}
              />
              <Tile
                label="Current streak"
                value={summary.streak_days ? `${summary.streak_days} day${summary.streak_days === 1 ? "" : "s"}` : "—"}
                hint={summary.last_visit_label ? `last in ${summary.last_visit_label}` : undefined}
                accent={summary.streak_days > 1}
              />
            </div>

            {attendance!.months.length > 1 && (
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-5">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-500">Month by month</h3>
                <p className="mb-2 text-xs text-gray-400">Tap a month to see every visit in it.</p>
                <div>
                  {attendance!.months.map((month) => (
                    <MonthRow
                      key={month.key}
                      month={month}
                      busiest={busiest}
                      selected={selectedMonth === month.key}
                      onSelect={(key) => onSelectMonth(selectedMonth === key ? null : key)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border-2 border-gray-200 bg-white">
              {/* Says which set of visits is on screen. Without it, drilling
                  into a month silently swaps the table underneath you. */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {selected ? selected.label : "Recent visits"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selected
                      ? `${selected.visits} visit${selected.visits === 1 ? "" : "s"} over ${selected.days} day${
                          selected.days === 1 ? "" : "s"
                        } | ${selected.total_label}${selected.average_label ? ` | avg ${selected.average_label}` : ""}`
                      : `Your last ${attendance!.visits.length} visit${attendance!.visits.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                {selected && (
                  <button
                    type="button"
                    onClick={() => onSelectMonth(null)}
                    className="text-xs font-semibold text-gray-500 underline underline-offset-2 hover:text-gray-900"
                  >
                    Back to recent visits
                  </button>
                )}
              </div>

              <div className={`overflow-x-auto transition-opacity ${monthLoading ? "opacity-50" : ""}`}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {["Day", "Checked in", "Checked out", "Time spent", "On package"].map((column, index) => (
                        <th
                          key={column}
                          className={`whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${
                            index === 4 ? "hidden sm:table-cell" : ""
                          }`}
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attendance!.visits.map((visit) => (
                      <VisitRow key={visit.id} visit={visit} />
                    ))}
                    {!attendance!.visits.length && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                          No visits recorded in {selected ? selected.label : "this period"}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400">
              Times are the gym&apos;s local clock, exactly as the front desk recorded them.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default HistorySection;
