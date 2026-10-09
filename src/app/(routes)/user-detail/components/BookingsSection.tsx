"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cancelBooking } from "../../classes/services/bookingService";
import { getMyBookingsWithRules, type MyBookingRow } from "../service/userDetailService";

const STATUS_STYLE: Record<MyBookingRow["status"], string> = {
  booked: "bg-emerald-50 text-emerald-700 border-emerald-200",
  attended: "bg-emerald-50 text-emerald-700 border-emerald-200",
  waitlisted: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-neutral-100 text-neutral-600 border-neutral-200",
  no_show: "bg-rose-50 text-rose-700 border-rose-200",
};

const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const hoursLabel = (hours: number) => `${hours} hour${hours === 1 ? "" : "s"}`;

/**
 * What cancelling this booking costs, in the member's words. A cancellation
 * inside the gym's late-cancel window frees the place but keeps the session
 * credit used -- the API decides which side of the line it falls (on the
 * gym's clock, not this phone's), so both outcomes are spelled out rather
 * than guessed at.
 */
function cancelConsequence(booking: MyBookingRow, cancelHours: number): string {
  if (booking.status === "waitlisted") return "You will lose your place on the waiting list.";
  if (!booking.credit_used) return "Your place is given up and may go to someone on the waiting list.";
  if (cancelHours > 0) {
    return `This booking used one session from your pack. Cancel ${hoursLabel(cancelHours)} or more before the class starts and you get the session back. Cancel later than that and the session stays used.`;
  }
  return "This booking used one session from your pack. You get the session back.";
}

export const BookingsSection: React.FC = () => {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [rows, setRows] = useState<MyBookingRow[]>([]);
  const [cancelHours, setCancelHours] = useState(0);
  const [loading, setLoading] = useState(true);
  // A failed load is not "No classes booked".
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // The booking whose "are you sure" is open.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMyBookingsWithRules(scope);
      setRows(result.rows);
      setCancelHours(result.cancelHours);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load bookings");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const onCancel = async (booking: MyBookingRow) => {
    setBusy(booking.id);
    setNotice(null);
    try {
      const res = await cancelBooking(booking.id);
      setNotice({ tone: "ok", text: res.message });
      setConfirming(null);
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not cancel" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 p-1">
          {(["upcoming", "past"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setConfirming(null);
                setScope(s);
              }}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md capitalize ${
                scope === s ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <Link
          href="/timetable"
          className="ml-auto text-sm font-semibold underline underline-offset-4 text-gray-700"
        >
          Book a class
        </Link>
      </div>

      {notice && (
        <div
          role="status"
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading your bookings…</p>
      ) : loadError ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">We could not load your bookings</p>
          <p className="mt-1 text-sm text-gray-700">{loadError}</p>
          <button type="button" onClick={load} className="mt-4 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-bold text-white">
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center">
          <p className="font-semibold text-gray-700">
            {scope === "upcoming" ? "No classes booked" : "Nothing here yet"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {scope === "upcoming"
              ? "Pick a session from the timetable to reserve your place."
              : "Classes you have attended will show up here."}
          </p>
          {scope === "upcoming" && (
            <Link
              href="/timetable"
              className="mt-4 inline-block rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-bold text-white"
            >
              View the timetable
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => (
            <li key={b.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900">{b.class_name}</p>
                  <p className="text-sm text-gray-600">
                    {dayLabel(b.date)} · {b.start_time}
                    {b.end_time ? `–${b.end_time}` : ""}
                    {b.instructor_name ? ` · ${b.instructor_name}` : ""}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${STATUS_STYLE[b.status]}`}
                >
                  {b.status === "waitlisted"
                    ? `Waiting list #${b.waitlist_position}`
                    : b.status === "no_show"
                    ? "Missed"
                    : b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                </span>

                {/* Only a live booking can be given up. A past or already
                    cancelled one has nothing to cancel. */}
                {["booked", "waitlisted"].includes(b.status) && scope === "upcoming" && confirming !== b.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setConfirming(b.id);
                    }}
                    disabled={busy !== null}
                    className="text-sm font-semibold text-gray-600 underline underline-offset-4 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Asked first: a place given up may be gone for good, and a late
                  cancellation does not give the session credit back. */}
              {confirming === b.id && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">
                    Cancel {b.class_name} on {dayLabel(b.date)} at {b.start_time}?
                  </p>
                  <p className="mt-1 text-sm text-gray-700">{cancelConsequence(b, cancelHours)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onCancel(b)}
                      disabled={busy === b.id}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === b.id ? "Cancelling…" : "Yes, cancel my booking"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      disabled={busy === b.id}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Keep my booking
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BookingsSection;
