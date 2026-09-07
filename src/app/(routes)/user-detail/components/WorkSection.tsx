"use client";

// For staff accounts: my shifts, my leave (and asking for more), my
// payslips and, for trainers, this month's PT commission.

import React, { useCallback, useEffect, useState } from "react";
import { getAuthHeader } from "@/helper/helper";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export interface Work {
  job_title: string;
  schedule: { day: string; start_time: string; end_time: string }[];
  leave: { id: string; type: string; from: string; to: string; days: number; reason: string; status: string; decision_note: string }[];
  payslips: { id: string; number: string; period: { label: string }; currency: string; net: number; status: string; paid_on: string | null }[];
  pt_this_month: { scheduled: number; completed: number; commission: number } | null;
}

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, { method, headers: { "Content-Type": "application/json", ...getAuthHeader() }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.message || "Request failed");
  return json;
}

const today = () => new Date().toISOString().slice(0, 10);
const input = "w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-primary";
const btn = "rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const STATUS: Record<string, string> = { pending: "bg-amber-50 text-amber-800", approved: "bg-green-50 text-green-800", rejected: "bg-red-50 text-red-700", cancelled: "bg-gray-100 text-gray-600" };

export const WorkSection: React.FC<{ initial?: Work | null }> = ({ initial = null }) => {
  const [work, setWork] = useState<Work | null>(initial);
  const [draft, setDraft] = useState({ type: "annual", from: today(), to: today(), reason: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await call("/staff/me/work", "GET");
      setWork(r.data);
    } catch {
      /* not staff */
    }
  }, []);

  useEffect(() => {
    if (!initial) load();
  }, [initial, load]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setNotice(null);
    try {
      const m = await fn();
      if (m) setNotice({ tone: "ok", text: m });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  };

  const openPayslip = async (id: string, number: string) => {
    const res = await fetch(`${API_BASE}/staff/me/payslips/${id}/pdf`, { headers: getAuthHeader() });
    if (!res.ok) {
      setNotice({ tone: "error", text: "Could not open the payslip" });
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${number}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  if (!work) return null;

  return (
    <div className="space-y-8">
      {notice && <p className={`rounded-lg px-4 py-2 text-sm ${notice.tone === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{notice.text}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-2xl border-2 border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">My shifts{work.job_title ? ` · ${work.job_title}` : ""}</p>
          {work.schedule.length ? (
            <ul className="mt-2 text-sm text-gray-800">
              {work.schedule.map((s) => (
                <li key={s.day} className="flex justify-between py-1">
                  <span>{s.day}</span>
                  <span>
                    {s.start_time}–{s.end_time}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-600">No shifts rostered.</p>
          )}
        </section>
        {work.pt_this_month && (
          <section className="rounded-2xl border-2 border-gray-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Personal training this month</p>
            <p className="mt-2 text-lg font-bold text-black">{work.pt_this_month.completed} completed · {work.pt_this_month.scheduled} upcoming</p>
            <p className="text-sm text-gray-600">Commission so far: {work.pt_this_month.commission.toLocaleString()}</p>
          </section>
        )}
      </div>

      <section className="rounded-2xl border-2 border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-black">Leave</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <select className={input} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            <option value="annual">Annual leave</option>
            <option value="sick">Sick leave</option>
            <option value="unpaid">Unpaid leave</option>
            <option value="other">Other</option>
          </select>
          <input type="date" className={input} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          <input type="date" className={input} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          <input className={input} placeholder="Reason (optional)" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className={btn} disabled={busy === "leave"} onClick={() => run("leave", async () => (await call("/staff/me/leave", "POST", draft)).message)}>
            {busy === "leave" ? "Sending…" : "Request leave"}
          </button>
        </div>
        {work.leave.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100">
            {work.leave.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="capitalize">{l.type}</span> · {l.from}{l.to !== l.from ? ` → ${l.to}` : ""} ({l.days} day{l.days === 1 ? "" : "s"}){l.decision_note ? ` — ${l.decision_note}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[l.status] || ""}`}>{l.status === "cancelled" ? "withdrawn" : l.status}</span>
                  {l.status === "pending" && (
                    <button type="button" className="text-xs underline" disabled={busy === l.id} onClick={() => run(l.id, async () => (await call(`/staff/me/leave/${l.id}`, "DELETE")).message)}>
                      Withdraw
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border-2 border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-black">Payslips</h2>
        {work.payslips.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No payslips issued yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {work.payslips.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {p.period.label} · <span className="font-mono text-xs">{p.number}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">
                    {p.currency} {p.net.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500">{p.status}{p.paid_on ? ` · ${new Date(p.paid_on).toLocaleDateString()}` : ""}</span>
                  <button type="button" className="text-xs underline" onClick={() => openPayslip(p.id, p.number)}>
                    PDF
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default WorkSection;
