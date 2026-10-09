import React from "react";
import { MyAttendance, AttendanceVisit } from "../service/userDetailService";

// ---------------------------------------------------------------------------
// How much the member has actually used their membership: the headline totals
// and the visit-level table.
//
// The month-by-month breakdown lives on the History tab (MonthByMonth) -- it is
// history, not a live view. Picking a month there lands here with that month
// loaded.
// ---------------------------------------------------------------------------

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

export interface VisitsSectionProps {
  attendance: MyAttendance | null;
  loading: boolean;
  /** Why the visits could not be loaded, when they could not. */
  error?: string | null;
  onRetry?: () => void;
  /** Which month is drilled into, or null for the recent-visits view. */
  selectedMonth: string | null;
  onSelectMonth: (key: string | null) => void;
  monthLoading: boolean;
}

export const VisitsSection: React.FC<VisitsSectionProps> = ({
  attendance,
  loading,
  error = null,
  onRetry,
  onSelectMonth,
  monthLoading,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-2 text-gray-500">Loading your visits…</p>
        </div>
      </div>
    );
  }

  // A failed request is not "No visits recorded yet".
  if (error && !attendance) {
    return (
      <section>
        <h2 className="mb-4 text-xl font-bold text-black sm:text-2xl">Your visits</h2>
        <div role="alert" className="rounded-2xl border-2 border-red-200 bg-red-50 p-8 text-center">
          <h3 className="text-lg font-bold text-gray-900">We could not load your visits</h3>
          <p className="mt-1 text-sm text-gray-700">{error}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-5 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-black hover:opacity-90">
              Try again
            </button>
          )}
        </div>
      </section>
    );
  }

  const summary = attendance?.summary;
  const selected = attendance?.selected_month || null;

  return (
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
            <Tile
              label="Time in the gym"
              value={summary.total_label}
              hint={summary.average_label ? `avg ${summary.average_label} a visit` : undefined}
            />
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
  );
};

export default VisitsSection;
