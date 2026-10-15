"use client";

// Booking a class session: the card for one session (Book a place, Join the
// waiting list, Cancel with a yes/no) and the hook that does the booking.
// Shared by the class page's upcoming sessions and the embeddable timetable
// (/embed/timetable), so both book, sign in and cancel the same way.

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { bookSession, cancelBooking, type BookingRules, type ClassSession } from "../services/bookingService";
import { isAuthenticated } from "@/helper/helper";
import { useLanguage } from "@/i18n/LanguageProvider";

export type BookingNoticeValue = { tone: "ok" | "error"; text: string };

/** The key a session goes by: sessions have no id of their own. */
export const sessionKey = (s: ClassSession) => `${s.class_id}|${s.date}|${s.start_time}`;

/** Date, then start time -- the order a member reads a list of sessions in. */
export const byDateThenTime = (a: ClassSession, b: ClassSession) =>
  a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || a.class_name.localeCompare(b.class_name);

/**
 * Sends the visitor to a page of this site in the whole browser window.
 *
 * Inside the embed (an <iframe> on another website) signing in cannot happen
 * in the frame -- it is a few hundred pixels tall and the session would stay
 * behind in it -- so the top window goes instead. If the host page forbids
 * that, a new tab does.
 */
export function openInTopWindow(path: string) {
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

/**
 * Booking and cancelling, with the message the server gave back.
 *
 * @param reload  fetches the sessions again after a change, so places left
 *                and "Booked" are the server's, not a guess
 * @param backTo  where signing in returns to
 */
export function useSessionBooking({
  reload,
  backTo,
  rules,
}: {
  reload: () => Promise<void> | void;
  backTo: string;
  rules: BookingRules | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  // The session whose Cancel was tapped and is waiting for a yes or no.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<BookingNoticeValue | null>(null);

  const onBook = async (s: ClassSession) => {
    if (!isAuthenticated()) {
      const signIn = `/authentication?redirect=${encodeURIComponent(backTo)}`;
      if (window.top !== window.self) openInTopWindow(signIn);
      else router.push(signIn);
      return;
    }
    setBusy(sessionKey(s));
    setNotice(null);
    try {
      const res = await bookSession({ classId: s.class_id, date: s.date, startTime: s.start_time });
      // The server's own wording: it distinguishes a place from a waiting-list
      // position, and it is the only thing that knows which one you got.
      setNotice({ tone: "ok", text: res.membership_warning ? `${res.message} ${res.membership_warning}` : res.message });
      await reload();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not book" });
    } finally {
      setBusy(null);
    }
  };

  const onCancel = async (s: ClassSession) => {
    if (!s.my_booking) return;
    setConfirming(null);
    setBusy(sessionKey(s));
    setNotice(null);
    try {
      const res = await cancelBooking(s.my_booking.id);
      setNotice({ tone: "ok", text: res.message });
      await reload();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not cancel" });
    } finally {
      setBusy(null);
    }
  };

  // Whether cancelling now is inside the gym's cancel-by window, where the
  // place is freed but a session credit is not handed back. Only a held place
  // can have used one; leaving a waiting list costs nothing.
  const isLateCancel = (s: ClassSession) => {
    if (!rules || !rules.use_credits || rules.cancel_hours <= 0) return false;
    if (s.my_booking?.status !== "booked") return false;
    const startsAt = new Date(s.starts_at).getTime();
    return Number.isFinite(startsAt) && startsAt - rules.cancel_hours * 3600 * 1000 < Date.now();
  };

  return { busy, confirming, setConfirming, notice, setNotice, onBook, onCancel, isLateCancel };
}

export type SessionBooking = ReturnType<typeof useSessionBooking>;

/** The server's answer to the last book or cancel, read out to screen readers. */
export function BookingNotice({ notice, className = "" }: { notice: BookingNoticeValue | null; className?: string }) {
  if (!notice) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 text-sm ${
        notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
      } ${className}`}
    >
      {notice.text}
    </div>
  );
}

/**
 * One session and what the visitor can do about it.
 *
 * @param title    the card's heading -- the class name on a timetable of
 *                 every class, the day and date on one class's own page
 */
export function SessionCard({
  session: s,
  booking,
  title,
}: {
  session: ClassSession;
  booking: SessionBooking;
  title: React.ReactNode;
}) {
  const { t } = useLanguage();
  const { busy, confirming, setConfirming, onBook, onCancel, isLateCancel } = booking;
  const key = sessionKey(s);
  const mine = s.my_booking;

  return (
    <article
      className={`flex flex-col rounded-xl border p-4 transition-colors ${
        s.is_closed || s.is_cancelled
          ? "border-neutral-200 bg-neutral-50 opacity-60"
          : mine
          ? "border-emerald-300 bg-emerald-50/40"
          : "border-neutral-200 bg-white hover:border-neutral-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-neutral-900">{title}</h3>
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

      <div className="mt-auto pt-4">
        {mine && confirming === key ? (
          // Asked on the page rather than with a browser dialog: inside the
          // embed (a frame on another website) browsers suppress those.
          <div role="group" aria-label={t("tt.cancelAsk")}>
            <p className="text-sm font-semibold text-neutral-900">{t("tt.cancelAsk")}</p>
            {isLateCancel(s) && <p className="mt-1 text-[13px] text-amber-800">{t("tt.cancelLate")}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCancel(s)}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800"
              >
                {t("tt.cancelYes")}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-400"
              >
                {t("tt.cancelNo")}
              </button>
            </div>
          </div>
        ) : mine ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-emerald-700">
              {mine.status === "waitlisted" ? t("tt.waitingPos", { n: mine.waitlist_position ?? "" }) : t("tt.booked")}
            </span>
            {!s.is_closed && (
              <button
                type="button"
                onClick={() => setConfirming(key)}
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
            {busy === key ? t("tt.booking") : s.is_full ? t("tt.waitlist") : t("tt.book")}
          </button>
        )}
      </div>
    </article>
  );
}
