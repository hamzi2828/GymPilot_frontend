"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getTimetable,
  bookSession,
  cancelBooking,
  type ClassSession,
} from "../classes/services/bookingService";
import { isAuthenticated } from "@/helper/helper";

// Seven days at a time. A month of sessions in one scroll is unreadable, and
// the booking horizon is thirty days anyway.
const DAYS_SHOWN = 7;

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
};

export default function TimetablePage() {
  const router = useRouter();
  const [from, setFrom] = useState(todayKey());
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const to = useMemo(() => addDays(from, DAYS_SHOWN - 1), [from]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTimetable({ from, to });
      setSessions(res.data || []);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load the timetable" });
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // Grouped by day so the page reads as a week, not as a list of rows.
  const byDay = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (let i = 0; i < DAYS_SHOWN; i++) map.set(addDays(from, i), []);
    for (const s of sessions) {
      if (map.has(s.date)) map.get(s.date)!.push(s);
    }
    return [...map.entries()];
  }, [sessions, from]);

  const sessionKey = (s: ClassSession) => `${s.class_id}|${s.date}|${s.start_time}`;

  const onBook = async (s: ClassSession) => {
    if (!isAuthenticated()) {
      router.push(`/authentication?redirect=${encodeURIComponent("/timetable")}`);
      return;
    }
    setBusy(sessionKey(s));
    setNotice(null);
    try {
      const res = await bookSession({
        classId: s.class_id,
        date: s.date,
        startTime: s.start_time,
      });
      // The server's own wording: it distinguishes a place from a waiting-list
      // position, and it is the only thing that knows which one you got.
      setNotice({ tone: "ok", text: res.message });
      if (res.membership_warning) {
        setNotice({ tone: "ok", text: `${res.message} ${res.membership_warning}` });
      }
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not book" });
    } finally {
      setBusy(null);
    }
  };

  const onCancel = async (s: ClassSession) => {
    if (!s.my_booking) return;
    setBusy(sessionKey(s));
    setNotice(null);
    try {
      const res = await cancelBooking(s.my_booking.id);
      setNotice({ tone: "ok", text: res.message });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not cancel" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="pt-24 pb-20 px-4 sm:px-8 lg:px-20 bg-white min-h-screen">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          <span className="text-sm font-semibold text-neutral-500">Timetable</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-neutral-900">Book a class</h1>
        <p className="mt-2 text-neutral-600 max-w-2xl">
          Pick a session and reserve your place. If a class is full you can join the
          waiting list — you are moved up automatically when someone cancels.
        </p>
      </header>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFrom(addDays(from, -DAYS_SHOWN))}
          // Nothing before today is bookable, so there is no reason to page
          // backwards past it.
          disabled={from <= todayKey()}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-40 hover:border-neutral-400"
        >
          ← Previous week
        </button>
        <button
          type="button"
          onClick={() => setFrom(todayKey())}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-400"
        >
          This week
        </button>
        <button
          type="button"
          onClick={() => setFrom(addDays(from, DAYS_SHOWN))}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-400"
        >
          Next week →
        </button>
        <Link
          href="/user-detail?tab=bookings"
          className="ml-auto text-sm font-semibold underline underline-offset-4 text-neutral-700"
        >
          My bookings
        </Link>
      </div>

      {loading ? (
        <p className="text-neutral-500">Loading the timetable…</p>
      ) : (
        <div className="space-y-8">
          {byDay.map(([date, list]) => (
            <section key={date}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">
                {dayLabel(date)}
                {date === todayKey() && (
                  <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-black">
                    Today
                  </span>
                )}
              </h2>

              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-400">
                  No classes scheduled.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((s) => {
                    const key = sessionKey(s);
                    const mine = s.my_booking;
                    return (
                      <article
                        key={key}
                        className={`rounded-xl border p-4 transition-colors ${
                          s.is_closed || s.is_cancelled
                            ? "border-neutral-200 bg-neutral-50 opacity-60"
                            : mine
                            ? "border-emerald-300 bg-emerald-50/40"
                            : "border-neutral-200 bg-white hover:border-neutral-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-neutral-900">{s.class_name}</h3>
                            <p className="text-sm text-neutral-600">
                              {s.start_time}
                              {s.end_time ? `–${s.end_time}` : ""}
                              {s.instructor_name ? ` · ${s.instructor_name}` : ""}
                              {s.room ? ` · ${s.room}` : ""}
                            </p>
                            {s.is_cancelled && (
                              <p className="mt-1 text-xs font-semibold text-rose-600">
                                Cancelled{s.change_note ? ` — ${s.change_note}` : ""}
                              </p>
                            )}
                            {!s.is_cancelled && s.is_substitute && (
                              <p className="mt-1 text-xs font-semibold text-amber-700">
                                Change this week{s.change_note ? ` — ${s.change_note}` : ""}
                              </p>
                            )}
                          </div>
                          {s.difficulty && (
                            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                              {s.difficulty}
                            </span>
                          )}
                        </div>

                        <p className="mt-3 text-[13px] text-neutral-500">
                          {s.capacity > 0
                            ? s.is_full
                              ? `Full · ${s.waitlist_count} on the waiting list`
                              : `${s.spots_left} of ${s.capacity} places left`
                            : "Open session"}
                        </p>

                        <div className="mt-4">
                          {mine ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-emerald-700">
                                {mine.status === "waitlisted"
                                  ? `Waiting list #${mine.waitlist_position}`
                                  : "Booked"}
                              </span>
                              {!s.is_closed && (
                                <button
                                  type="button"
                                  onClick={() => onCancel(s)}
                                  disabled={busy === key}
                                  className="text-sm font-semibold text-neutral-600 underline underline-offset-4 disabled:opacity-40"
                                >
                                  {busy === key ? "Cancelling…" : "Cancel"}
                                </button>
                              )}
                            </div>
                          ) : s.is_cancelled ? (
                            <span className="text-sm text-neutral-400">Not running</span>
                          ) : s.is_closed ? (
                            <span className="text-sm text-neutral-400">Booking closed</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onBook(s)}
                              disabled={busy === key}
                              className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
                            >
                              {busy === key
                                ? "Booking…"
                                : s.is_full
                                ? "Join waiting list"
                                : "Book a place"}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
