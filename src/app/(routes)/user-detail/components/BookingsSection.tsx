"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getMyBookings,
  cancelBooking,
  type MyBooking,
} from "../../classes/services/bookingService";

const STATUS_STYLE: Record<MyBooking["status"], string> = {
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

export const BookingsSection: React.FC = () => {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [rows, setRows] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getMyBookings(scope));
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load bookings" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const onCancel = async (booking: MyBooking) => {
    setBusy(booking.id);
    setNotice(null);
    try {
      const res = await cancelBooking(booking.id);
      setNotice({ tone: "ok", text: res.message });
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
              onClick={() => setScope(s)}
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
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4"
            >
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
              {["booked", "waitlisted"].includes(b.status) && scope === "upcoming" && (
                <button
                  type="button"
                  onClick={() => onCancel(b)}
                  disabled={busy === b.id}
                  className="text-sm font-semibold text-gray-600 underline underline-offset-4 disabled:opacity-40"
                >
                  {busy === b.id ? "Cancelling…" : "Cancel"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BookingsSection;
