// How long a one-off package lasts, as a short list rather than free text.
//
// A package's `period` is two things at once. The site shows it after the
// price ("49 / 3 months"), and for a one-off package the server reads the
// length of the term out of it (GymPilot_backend
// src/gymfolio/services/membershipService.js, termEnd): a leading number,
// then the word year, week, day or month -- and thirty days for anything it
// does not recognise, which is how a package typed in as "Annual" came to
// last a month. Each `label` below is one the server reads correctly.
//
// A `durationDays` above zero wins over the period altogether; the form
// offers that as "A set number of days" and writes a matching label with it,
// so the two can never disagree.

export const PACKAGE_TERMS: { label: string; name: string }[] = [
  { label: "day", name: "1 day" },
  { label: "week", name: "1 week" },
  { label: "month", name: "1 month" },
  { label: "3 months", name: "3 months" },
  { label: "6 months", name: "6 months" },
  { label: "year", name: "1 year" },
];

/** The select's value for "A set number of days". Never stored. */
export const TERM_IN_DAYS = "__days";

/** The label stored beside a length given in days. */
export const daysLabel = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

/** True for a label this form wrote for a length in days, so it may rewrite it. */
export const isDaysLabel = (period: string) => /^\d+ days?$/.test(period.trim());

/**
 * The choices for one package: the standard terms, then the label the
 * package already has if it is not one of them (kept until changed), then
 * the length in days.
 */
export function termOptions(period: string): { value: string; label: string }[] {
  const current = period.trim();
  const custom = current && !PACKAGE_TERMS.some((t) => t.label === current) && !isDaysLabel(current);
  return [
    ...PACKAGE_TERMS.map((t) => ({ value: t.label, label: t.name })),
    ...(custom ? [{ value: current, label: `“${current}” (as it is now)` }] : []),
    { value: TERM_IN_DAYS, label: "A set number of days" },
  ];
}
