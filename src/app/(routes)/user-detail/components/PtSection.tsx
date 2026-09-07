"use client";

// Personal training from the member's side: their trainer, their pack,
// upcoming sessions, and booking a new one against a trainer's free slots.

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getPtTrainers, getPtAvailability, bookPtSession, getMyPtSessions, cancelPtSession, type PtTrainer, type PtRules, type PtSlot, type PtSession, type PtPack } from "../../classes/services/ptService";

const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};
const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE: Record<PtSession["status"], string> = {
  scheduled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-neutral-100 text-neutral-700 border-neutral-200",
  cancelled: "bg-neutral-100 text-neutral-500 border-neutral-200",
  no_show: "bg-rose-50 text-rose-700 border-rose-200",
};

export const PtSection: React.FC = () => {
  const params = useSearchParams();
  const [trainers, setTrainers] = useState<PtTrainer[]>([]);
  const [rules, setRules] = useState<PtRules | null>(null);
  const [sessions, setSessions] = useState<PtSession[]>([]);
  const [past, setPast] = useState<PtSession[]>([]);
  const [pack, setPack] = useState<PtPack | null>(null);
  const [assigned, setAssigned] = useState<{ id: string; name: string } | null>(null);
  const [trainerId, setTrainerId] = useState(params.get("trainer") || "");
  const [weekStart, setWeekStart] = useState(today());
  const [slots, setSlots] = useState<PtSlot[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, mine, old] = await Promise.all([getPtTrainers(), getMyPtSessions("upcoming"), getMyPtSessions("past")]);
      setTrainers(t.data.filter((x) => x.has_availability));
      setRules(t.rules);
      setSessions(mine.data);
      setPast(old.data.slice(0, 10));
      setPack(mine.pack);
      setAssigned(mine.assigned_trainer);
      setTrainerId((current) => current || (mine.assigned_trainer ? mine.assigned_trainer.id : ""));
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load personal training" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!trainerId) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    getPtAvailability(trainerId, weekStart, addDays(weekStart, 6))
      .then((s) => {
        if (!cancelled) setSlots(s);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [trainerId, weekStart, sessions]);

  const book = async (slot: PtSlot) => {
    const trainer = trainers.find((t) => t.id === trainerId);
    if (!trainer) return;
    if (!confirm(`Book ${trainer.name} on ${dayLabel(slot.date)} at ${slot.start_time}?${pack ? " One session will be taken from your pack." : trainer.rate ? ` Pay ${trainer.rate} at reception.` : ""}`)) return;
    setBusy(`${slot.date}|${slot.start_time}`);
    setNotice(null);
    try {
      const res = await bookPtSession({ trainerId, date: slot.date, startTime: slot.start_time });
      setNotice({ tone: "ok", text: res.message });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not book" });
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (s: PtSession) => {
    if (!confirm(`Cancel your session with ${s.trainer_name} on ${dayLabel(s.date)} at ${s.start_time}?${rules && rules.cancel_hours ? ` Cancelling less than ${rules.cancel_hours} hours before loses the session credit.` : ""}`)) return;
    setBusy(s.id);
    setNotice(null);
    try {
      const res = await cancelPtSession(s.id);
      setNotice({ tone: "ok", text: res.message });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not cancel" });
    } finally {
      setBusy(null);
    }
  };

  const byDay = new Map<string, PtSlot[]>();
  for (const s of slots) {
    if (!byDay.has(s.date)) byDay.set(s.date, []);
    byDay.get(s.date)!.push(s);
  }
  const chosen = trainers.find((t) => t.id === trainerId);

  if (loading) return <p className="py-10 text-center text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-8">
      {notice && <p className={`rounded-lg px-4 py-2 text-sm ${notice.tone === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{notice.text}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Your trainer</p>
          <p className="mt-1 text-lg font-bold text-black">{assigned ? assigned.name : "Not assigned yet"}</p>
          {!assigned && <p className="text-sm text-gray-600">Ask at reception to be paired with a coach, or book any trainer below.</p>}
        </div>
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Session pack</p>
          {pack ? (
            <>
              <p className="mt-1 text-lg font-bold text-black">
                {pack.left} of {pack.total} sessions left
              </p>
              <p className="text-sm text-gray-600">
                {pack.name}
                {pack.ends_at ? ` · valid until ${new Date(pack.ends_at).toLocaleDateString()}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-600">{rules?.require_pack ? "A personal training pack is needed to book. See our packages." : "No pack — sessions are paid at reception at the trainer's rate."}</p>
          )}
        </div>
      </div>

      <section className="rounded-2xl border-2 border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-black">Upcoming sessions</h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">Nothing booked yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-black">
                    {dayLabel(s.date)} · {s.start_time}–{s.end_time}
                  </p>
                  <p className="text-sm text-gray-600">
                    with {s.trainer_name}
                    {s.credit_used ? " · from your pack" : s.price ? ` · ${s.currency} ${s.price}` : ""}
                  </p>
                </div>
                <button type="button" disabled={busy === s.id} onClick={() => cancel(s)} className="text-sm font-semibold text-gray-600 underline underline-offset-4 disabled:opacity-40">
                  {busy === s.id ? "Cancelling…" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rules?.allow_member_booking && (
        <section className="rounded-2xl border-2 border-gray-200 bg-white p-6">
          <h2 className="text-xl font-bold text-black">Book a session</h2>
          {trainers.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">No trainers are taking online bookings right now — ask at reception.</p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {trainers.map((t) => (
                  <button key={t.id} type="button" onClick={() => setTrainerId(t.id)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${trainerId === t.id ? "border-black bg-black text-white" : "border-gray-300 text-gray-700 hover:border-gray-500"}`}>
                    {t.name}
                    {t.rate && !pack ? <span className="ml-1 font-normal opacity-70">· {t.rate}/session</span> : null}
                  </button>
                ))}
              </div>
              {chosen && (
                <>
                  <div className="mt-5 flex items-center justify-between">
                    <button type="button" onClick={() => setWeekStart((w) => (w > today() ? addDays(w, -7) : w))} className="text-sm font-semibold text-gray-600 underline">
                      ← Earlier
                    </button>
                    <p className="text-sm text-gray-600">
                      {dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}
                    </p>
                    <button type="button" onClick={() => setWeekStart((w) => addDays(w, 7))} className="text-sm font-semibold text-gray-600 underline">
                      Later →
                    </button>
                  </div>
                  {byDay.size === 0 ? (
                    <p className="mt-4 text-sm text-gray-600">{chosen.name} has no free slots this week.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {[...byDay.entries()].map(([date, list]) => (
                        <div key={date}>
                          <p className="text-sm font-semibold text-black">{dayLabel(date)}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {list.map((slot) => {
                              const key = `${slot.date}|${slot.start_time}`;
                              return (
                                <button key={key} type="button" disabled={busy === key} onClick={() => book(slot)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:border-black disabled:opacity-40">
                                  {busy === key ? "Booking…" : slot.start_time}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

      {past.length > 0 && (
        <section className="rounded-2xl border-2 border-gray-200 bg-white p-6">
          <h2 className="text-xl font-bold text-black">Past sessions</h2>
          <ul className="mt-3 divide-y divide-gray-100">
            {past.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {dayLabel(s.date)} · {s.start_time} with {s.trainer_name}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[s.status]}`}>{s.status.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default PtSection;
