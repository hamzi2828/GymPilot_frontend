"use client";

// The class's own upcoming sessions, bookable where they are listed. This is
// the site's timetable: a visitor picks a class first, then a session of it.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

// Two weeks ahead. The server clamps this to the gym's booking horizon.
const DAYS_AHEAD = 14;

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

// "Mon 12 Jan" -- the card's heading, since every card is the same class.
const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
};

export default function ClassSessionsSection({ classId }: { classId: string }) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [rules, setRules] = useState<BookingRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { t } = useLanguage();

  // Only the latest request may fill the list (a quick book-then-cancel
  // reloads twice).
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    const from = localDateKey();
    try {
      // The timetable filtered to this class: it also carries the gym's
      // booking rules, which say when a cancellation is a late one.
      const res = await getTimetable({ from, to: addDays(from, DAYS_AHEAD - 1), classId });
      if (request !== latestRequest.current) return;
      setSessions(res.data || []);
      setRules(res.rules || null);
      setLoadError(null);
    } catch (e) {
      if (request !== latestRequest.current) return;
      setLoadError(e instanceof Error ? e.message : "Could not load the sessions");
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const booking = useSessionBooking({ reload: load, backTo: `/classdetail?id=${classId}`, rules });

  // Upcoming only: sessions that have already started today are left out.
  // Ones inside the booking cutoff stay, marked "Booking closed".
  const upcoming = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((s) => {
        const startsAt = new Date(s.starts_at).getTime();
        return !Number.isFinite(startsAt) || startsAt > now;
      })
      .sort(byDateThenTime);
  }, [sessions]);

  const today = localDateKey();

  return (
    <section id="sessions" aria-labelledby="sessions-title" className="scroll-mt-28 space-y-4 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="sessions-title" className="font-['Montserrat',sans-serif] font-bold text-2xl md:text-3xl leading-tight tracking-tight text-black">
          Upcoming sessions
        </h2>
        {upcoming.length > 0 && (
          <Link
            href="/user-detail?tab=bookings"
            className="text-sm font-semibold text-neutral-700 underline underline-offset-4 hover:text-black"
          >
            {t("tt.myBookings")}
          </Link>
        )}
      </div>

      <BookingNotice notice={booking.notice} />

      {loading ? (
        <p className="text-sm text-neutral-500">Loading sessions…</p>
      ) : loadError && upcoming.length === 0 ? (
        <p className="text-sm text-neutral-500">Sessions could not be loaded right now. Please try again later.</p>
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-neutral-500">No sessions scheduled yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {upcoming.map((s) => (
            <SessionCard
              key={sessionKey(s)}
              session={s}
              booking={booking}
              title={
                <>
                  {dayLabel(s.date)}
                  {s.date === today && (
                    <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 align-middle text-[11px] font-bold text-[var(--on-accent)]">
                      {t("tt.today")}
                    </span>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
