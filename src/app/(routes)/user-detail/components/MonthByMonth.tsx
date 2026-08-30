import React from "react";
import { AttendanceMonth, MembershipOrder } from "../service/userDetailService";

// ---------------------------------------------------------------------------
// Every month the member has trained, newest first, with the package they were
// on at the time. This lives on the History tab rather than beside the visit
// table: it IS the history, and it is the one place that answers "what was I
// paying for back then, and did I use it?".
//
// Picking a month hands off to the Recent visits tab, which is where the
// visit-level detail lives.
// ---------------------------------------------------------------------------

/**
 * Fallback for which packages were running during a `YYYY-MM` month.
 *
 * The server aggregates the package snapshot each visit was taken on
 * (`month.packages`), which is the authoritative answer. This covers the two
 * cases that leaves: visits recorded before snapshotting existed, and an older
 * API build that does not send the field. A package term overlaps a month
 * whenever it starts before the month ends and finishes after it begins.
 */
export function packagesForMonth(monthKey: string, memberships: MembershipOrder[]): string[] {
  const [year, month] = monthKey.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return [];

  const monthStart = new Date(year, month - 1, 1).getTime();
  // Last millisecond of the month: day 0 of the next month is the last day.
  const monthEnd = new Date(year, month, 1).getTime() - 1;

  const names = memberships
    .filter((entry) => {
      const startMs = entry.startDate ? new Date(entry.startDate).getTime() : NaN;
      const endMs = entry.endDate ? new Date(entry.endDate).getTime() : NaN;
      // A term with neither end pinned tells us nothing about this month.
      if (!Number.isFinite(startMs) && !Number.isFinite(endMs)) return false;
      // An open-ended term runs from its start onwards (or up to its end).
      const from = Number.isFinite(startMs) ? startMs : -Infinity;
      const to = Number.isFinite(endMs) ? endMs : Infinity;
      return from <= monthEnd && to >= monthStart;
    })
    .map((entry) => entry.packageName)
    .filter((name): name is string => Boolean(name));

  return Array.from(new Set(names));
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
  packages,
  onSelect,
}: {
  month: AttendanceMonth;
  busiest: number;
  selected: boolean;
  packages: string[];
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
        <p className={`text-sm font-semibold ${selected ? "text-primary" : "text-gray-900"}`}>
          {month.label}
        </p>
        <p className="text-xs text-gray-500">
          {month.visits} visit{month.visits === 1 ? "" : "s"}
        </p>
      </div>

      {/* Which package the member was on that month. A visit count means very
          little without knowing what they were paying for at the time. */}
      <div className="hidden w-40 shrink-0 md:block">
        {packages.length ? (
          <div className="flex flex-wrap gap-1">
            {packages.map((name) => (
              <span
                key={name}
                title={name}
                className="max-w-full truncate rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700"
              >
                {name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-gray-400">No package</span>
        )}
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
        className="fas fa-chevron-right w-3 shrink-0 text-xs text-gray-300"
        aria-hidden="true"
      />
    </button>
  );
}

export interface MonthByMonthProps {
  months: AttendanceMonth[];
  /** Fallback source for the package chip when a month carries no snapshot. */
  memberships: MembershipOrder[];
  selectedMonth: string | null;
  /** Opens that month's visits — the caller moves to the Recent visits tab. */
  onSelectMonth: (key: string) => void;
}

export const MonthByMonth: React.FC<MonthByMonthProps> = ({
  months,
  memberships,
  selectedMonth,
  onSelectMonth,
}) => {
  if (!months.length) return null;

  const busiest = Math.max(1, ...months.map((month) => month.visits));

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-black sm:text-2xl">Month by month</h2>
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-5">
        <p className="mb-3 text-xs text-gray-500">
          Every month you have trained, with the package you were on. Tap a month to see every
          visit in it.
        </p>
        <div>
          {months.map((month) => (
            <MonthRow
              key={month.key}
              month={month}
              busiest={busiest}
              packages={
                month.packages?.length
                  ? month.packages
                  : packagesForMonth(month.key, memberships)
              }
              selected={selectedMonth === month.key}
              onSelect={onSelectMonth}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default MonthByMonth;
