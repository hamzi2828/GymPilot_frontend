// src/helper/date.ts
//
// Calendar-date helpers. A "date key" is YYYY-MM-DD with no time or zone,
// which is how the API exchanges class dates, birthdays and leave days.

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Today's (or `date`'s) calendar date on the visitor's own clock.
 *
 * Not `toISOString().slice(0, 10)`: that is the date in UTC, which is already
 * tomorrow (or still yesterday) for anyone far enough from Greenwich late in
 * the evening, and a timetable that opens on the wrong day.
 */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A stored date as the value an <input type="date"> expects, or "" when there
 * is none. Empty must stay empty: filling in today would be saved as the
 * person's birthday the next time they edit anything else.
 */
export function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  // Date-only values are stored as midnight UTC, so the UTC date is the one meant.
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}
