"use client";

import React from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { SecondaryButton, SelectField } from "./ui";

/**
 * One editable week, shared by the two screens that need one.
 *
 * Classes and trainers describe their week with the same {day, startTime,
 * endTime} shape, and the code that reads them relies on that: the attendance
 * verdicts judge a trainer's shift against `availability`, and the booking
 * system expands a class's `schedule` into dated sessions. One editor rather
 * than two keeps them producing identical data.
 *
 * The difference between the two callers is whether a row also names an
 * instructor — classes do, trainers do not — which is what `withInstructor`
 * switches on.
 */

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface ScheduleRow {
  day: Weekday | string;
  startTime: string;
  endTime: string;
  instructor?: string | null;
  instructorName?: string;
}

export interface InstructorOption {
  _id: string;
  name: string;
}

/** Minutes since midnight, or null when the clock string is unusable. */
function minutes(clock: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(clock || "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * The problems worth blocking a save for. Returned as messages rather than
 * thrown, so the form can show them next to the row that caused them.
 *
 * Overnight slots (an end time before the start) are allowed deliberately: a
 * night-shift cleaner finishing at 02:00 is a real roster, and the attendance
 * module already files that visit against the day it started.
 */
export function validateSchedule(rows: ScheduleRow[]): string[] {
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const label = `${row.day || "Row " + (i + 1)}`;
    if (!row.day) errors.push(`Row ${i + 1}: pick a day.`);
    if (minutes(row.startTime) === null) errors.push(`${label}: start time must be HH:MM.`);
    if (row.endTime && minutes(row.endTime) === null) {
      errors.push(`${label}: end time must be HH:MM.`);
    }
  });

  // Two slots for the same class at the same time on the same day would
  // produce two identical sessions that both look bookable.
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.day || !row.startTime) continue;
    const key = `${row.day}|${row.startTime}`;
    if (seen.has(key)) errors.push(`${row.day} ${row.startTime} appears twice.`);
    seen.add(key);
  }

  return errors;
}

export function WeekScheduleEditor({
  rows,
  onChange,
  withInstructor = false,
  instructors = [],
  addLabel = "Add a session",
  emptyHint,
}: {
  rows: ScheduleRow[];
  onChange: (next: ScheduleRow[]) => void;
  withInstructor?: boolean;
  instructors?: InstructorOption[];
  addLabel?: string;
  emptyHint?: string;
}) {
  const update = (index: number, patch: Partial<ScheduleRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const add = () => {
    // Copies the previous row's times, because a week is usually the same
    // hour on several days and retyping it is the tedious part.
    const last = rows[rows.length - 1];
    const used = new Set(rows.map((r) => r.day));
    const nextDay = WEEKDAYS.find((d) => !used.has(d)) || "Monday";
    onChange([
      ...rows,
      {
        day: nextDay,
        startTime: last?.startTime || "18:00",
        endTime: last?.endTime || "19:00",
        instructor: last?.instructor ?? null,
      },
    ]);
  };

  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));

  const errors = validateSchedule(rows);

  return (
    <div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
          {emptyHint || "Nothing scheduled yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 items-end gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[1.2fr_0.8fr_0.8fr_auto]"
              style={withInstructor ? { gridTemplateColumns: undefined } : undefined}
            >
              <SelectField
                label="Day"
                value={row.day}
                onChange={(v) => update(i, { day: v })}
                allowClear={false}
                options={WEEKDAYS.map((d) => ({ value: d, label: d }))}
              />

              <label className="block">
                <span className="text-xs font-medium text-neutral-600">Starts</span>
                <input
                  type="time"
                  value={row.startTime || ""}
                  onChange={(e) => update(i, { startTime: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-neutral-600">Ends</span>
                <input
                  type="time"
                  value={row.endTime || ""}
                  onChange={(e) => update(i, { endTime: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </label>

              {withInstructor && (
                <div className="sm:col-span-3">
                  <SelectField
                    label="Instructor"
                    value={row.instructor || ""}
                    onChange={(v) =>
                      update(i, {
                        instructor: v || null,
                        instructorName: instructors.find((t) => t._id === v)?.name || "",
                      })
                    }
                    placeholder="Not assigned"
                    options={instructors.map((t) => ({ value: t._id, label: t.name }))}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${row.day} ${row.startTime}`}
                className="mb-0.5 rounded-lg border border-neutral-300 px-3 py-2 text-neutral-500 hover:border-rose-300 hover:text-rose-600"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1">
          {errors.map((e) => (
            <li key={e} className="text-[12px] text-rose-600">
              {e}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <SecondaryButton onClick={add}>
          <FiPlus className="h-3.5 w-3.5" /> {addLabel}
        </SecondaryButton>
      </div>
    </div>
  );
}

export default WeekScheduleEditor;
