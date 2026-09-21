"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getTimetable,
  bookSession,
  cancelBooking,
  type ClassSession,
} from "../classes/services/bookingService";
import { isAuthenticated } from "@/helper/helper";
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

// A class page links here as /timetable?class=<id> to show that class only.
const isObjectId = (value: string | null): value is string => !!value && /^[a-f\d]{24}$/i.test(value);

/**
 * Sends the visitor to a page of this site in the whole browser window.
 *
 * Inside the embed (an <iframe> on another website) signing in cannot happen
 * in the frame -- it is a few hundred pixels tall and the session would stay
 * behind in it -- so the top window goes instead. If the host page forbids
 * that, a new tab does.
 */
function openInTopWindow(path: string) {
  const url = new URL(path, window.location.origin).toString();
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
  } catch {
    window.open(url, "_blank", "noopener");
    return;
  }
  window.location.href = url;
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawClass = searchParams.get("class");
  const classId = isObjectId(rawClass) ? rawClass : null;
  const [from, setFrom] = useState(todayKey());
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Framed on another website (/embed/timetable): links to the member area
  // open in the whole window rather than inside the frame.
  const [embedded, setEmbedded] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    setEmbedded(window.top !== window.self);
  }, []);

  const to = useMemo(() => addDays(from, DAYS_SHOWN - 1), [from]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTimetable({ from, to, classId: classId || undefined });
      setSessions(res.data || []);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load the timetable" });
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, classId]);

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
      const back = classId ? `/timetable?class=${classId}` : "/timetable";
      const signIn = `/authentication?redirect=${encodeURIComponent(back)}`;
      if (window.top !== window.self) openInTopWindow(signIn);
      else router.push(signIn);
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
        {classId && (
          <p className="mt-3 text-sm text-neutral-600">
            Showing one class only.{" "}
            <Link href="/timetable" className="font-semibold underline underline-offset-4 text-neutral-800">
              Show all classes
            </Link>
          </p>
        )}
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
          {t("tt.prev")}
        </button>
        <button
          type="button"
          onClick={() => setFrom(todayKey())}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-400"
        >
          {t("tt.thisWeek")}
        </button>
        <button
          type="button"
          onClick={() => setFrom(addDays(from, DAYS_SHOWN))}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-400"
        >
          {t("tt.next")}
        </button>
        <Link
          href="/user-detail?tab=bookings"
          target={embedded ? "_top" : undefined}
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
                              ? t("tt.full", { n: s.waitlist_count })
                              : t("tt.left", { n: s.spots_left, cap: s.capacity })
                            : t("tt.open")}
                        </p>

                        <div className="mt-4">
                          {mine ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-emerald-700">
                                {mine.status === "waitlisted"
                                  ? t("tt.waitingPos", { n: mine.waitlist_position ?? "" })
                                  : t("tt.booked")}
                              </span>
                              {!s.is_closed && (
                                <button
                                  type="button"
                                  onClick={() => onCancel(s)}
                                  disabled={busy === key}
                                  className="text-sm font-semibold text-neutral-600 underline underline-offset-4 disabled:opacity-40"
                                >
                                  {busy === key ? t("tt.cancelling") : t("tt.cancel")}
                                </button>
                              )}
                            </div>
                          ) : s.is_cancelled ? (
                            <span className="text-sm text-neutral-400">{t("tt.notRunning")}</span>
                          ) : s.is_closed ? (
                            <span className="text-sm text-neutral-400">{t("tt.closed")}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onBook(s)}
                              disabled={busy === key}
                              className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
                            >
                              {busy === key
                                ? t("tt.booking")
                                : s.is_full
                                ? t("tt.waitlist")
                                : t("tt.book")}
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

// useSearchParams (the ?class= filter) needs a Suspense boundary above it.
export default function TimetablePage() {
  return (
    <Suspense fallback={<main className="pt-24 pb-20 px-4 sm:px-8 lg:px-20 bg-white min-h-screen" />}>
      <TimetableContent />
    </Suspense>
  );
}
