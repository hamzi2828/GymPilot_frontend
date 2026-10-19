"use client";

// The week-by-week timetable of every class, for an <iframe> on another
// website (/embed/timetable). The site itself has no timetable page: a
// visitor picks a class and books from its own page. Booking works the same
// way here; signing in opens in the whole browser window (openInTopWindow).

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getTimetable, type BookingRules, type ClassSession } from "../../classes/services/bookingService";
import {
  BookingNotice,
  SessionCard,
  byDateThenTime,
  sessionKey,
  useSessionBooking,
} from "../../classes/components/SessionBooking";
import { localDateKey } from "@/helper/date";
import { useLanguage } from "@/i18n/LanguageProvider";

// Seven days at a time. A month of sessions in one scroll is unreadable, and
// the booking horizon is thirty days anyway.
const DAYS_SHOWN = 7;

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

// The visitor's own date, not UTC's: late in the evening east of Greenwich
// (or early morning west of it) the UTC date is a different day, and the week
// would open on it.
const todayKey = () => localDateKey();

// /embed/timetable?class=<id> shows that class only.
const isObjectId = (value: string | null): value is string => !!value && /^[a-f\d]{24}$/i.test(value);

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

function TimetableContent() {
  const searchParams = useSearchParams();
  const rawClass = searchParams.get("class");
  const classId = isObjectId(rawClass) ? rawClass : null;
  const [from, setFrom] = useState(todayKey());
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  // The gym's booking policy, for saying when a cancellation is a late one.
  const [rules, setRules] = useState<BookingRules | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { t } = useLanguage();

  const to = useMemo(() => addDays(from, DAYS_SHOWN - 1), [from]);

  // Only the latest request may fill the page. Paging through the weeks
  // quickly, a slow answer for an earlier week used to land after the newer
  // one and put the wrong week's classes under this week's dates.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    try {
      const res = await getTimetable({ from, to, classId: classId || undefined });
      if (request !== latestRequest.current) return;
      setSessions(res.data || []);
      setRules(res.rules || null);
      setLoadError(null);
    } catch (e) {
      if (request !== latestRequest.current) return;
      setLoadError(e instanceof Error ? e.message : "Could not load the timetable");
      setSessions([]);
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [from, to, classId]);

  useEffect(() => {
    load();
  }, [load]);

  // Signing in returns to the gym's own site, not to the frame.
  const booking = useSessionBooking({
    reload: load,
    backTo: classId ? `/classdetail?id=${classId}` : "/classes",
    rules,
  });

  // Grouped by day so the page reads as a week, not as a list of rows.
  const byDay = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (let i = 0; i < DAYS_SHOWN; i++) map.set(addDays(from, i), []);
    for (const s of [...sessions].sort(byDateThenTime)) {
      if (map.has(s.date)) map.get(s.date)!.push(s);
    }
    return [...map.entries()];
  }, [sessions, from]);

  const notice = booking.notice || (loadError ? { tone: "error" as const, text: loadError } : null);

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
        {classId && (
          <p className="mt-3 text-sm text-neutral-600">
            Showing one class only.{" "}
            <Link href="/embed/timetable" className="font-semibold underline underline-offset-4 text-neutral-800">
              Show all classes
            </Link>
          </p>
        )}
      </header>

      <BookingNotice notice={notice} className="mb-6" />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFrom(addDays(from, -DAYS_SHOWN))}
          // Nothing before today is bookable, so there is no reason to page
          // backwards past it. Each week waits for the one being loaded.
          disabled={loading || from <= todayKey()}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-40 hover:border-neutral-400"
        >
          {t("tt.prev")}
        </button>
        <button
          type="button"
          onClick={() => setFrom(todayKey())}
          disabled={loading}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-40 hover:border-neutral-400"
        >
          {t("tt.thisWeek")}
        </button>
        <button
          type="button"
          onClick={() => setFrom(addDays(from, DAYS_SHOWN))}
          disabled={loading}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-40 hover:border-neutral-400"
        >
          {t("tt.next")}
        </button>
        {/* The member area opens in the whole window, not inside the frame. */}
        <Link
          href="/user-detail?tab=bookings"
          target="_top"
          className="ml-auto text-sm font-semibold underline underline-offset-4 text-neutral-700"
        >
          {t("tt.myBookings")}
        </Link>
      </div>

      {loading ? (
        <p className="text-neutral-500">{t("tt.loading")}</p>
      ) : (
        <div className="space-y-8">
          {byDay.map(([date, list]) => (
            <section key={date}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">
                {dayLabel(date)}
                {date === todayKey() && (
                  <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-black">
                    {t("tt.today")}
                  </span>
                )}
              </h2>

              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-400">
                  {t("tt.none")}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((s) => (
                    <SessionCard key={sessionKey(s)} session={s} booking={booking} title={s.class_name} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

// useSearchParams (the ?class= filter) needs a Suspense boundary above it.
export default function EmbedTimetable() {
  return (
    <Suspense fallback={<main className="pt-24 pb-20 px-4 sm:px-8 lg:px-20 bg-white min-h-screen" />}>
      <TimetableContent />
    </Suspense>
  );
}
