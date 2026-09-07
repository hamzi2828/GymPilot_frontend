"use client";

// The rest of a member's profile: photo, emergency contact, health details
// with the PAR-Q, and the membership agreement to sign.

import React, { useCallback, useEffect, useState } from "react";
import { getAuthHeader } from "@/helper/helper";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const PARQ_QUESTIONS = [
  "Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?",
  "Do you feel pain in your chest when you do physical activity?",
  "In the past month, have you had chest pain when you were not doing physical activity?",
  "Do you lose your balance because of dizziness, or do you ever lose consciousness?",
  "Do you have a bone or joint problem that could be made worse by a change in your physical activity?",
  "Is your doctor currently prescribing drugs for your blood pressure or a heart condition?",
  "Do you know of any other reason why you should not do physical activity?",
];

interface Health {
  emergencyContact: { name: string; phone: string; relationship: string };
  medical: { conditions: string; medications: string; injuries: string; parq: { completedAt: string | null; answers: { question: string; answer: boolean }[]; flagged: boolean } };
}
interface Waiver {
  required: boolean;
  version: string;
  text: string;
  signed: { signedAt: string; version: string; signature: string } | null;
  needs_signature: boolean;
}

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, { method, headers: { "Content-Type": "application/json", ...getAuthHeader() }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.message || "Request failed");
  return json;
}

const input = "w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-primary";
const btn = "rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const primary = "px-5 py-3 bg-primary text-black font-semibold rounded-lg hover:opacity-90 disabled:opacity-60";

export const ProfileExtrasSection: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [health, setHealth] = useState<Health | null>(null);
  const [waiver, setWaiver] = useState<Waiver | null>(null);
  const [answers, setAnswers] = useState<boolean[]>(PARQ_QUESTIONS.map(() => false));
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, w] = await Promise.all([call("/user/health", "GET"), call("/user/waiver", "GET")]);
      setHealth(h.data);
      setWaiver(w.data);
      const saved = h.data?.medical?.parq?.answers || [];
      if (saved.length === PARQ_QUESTIONS.length) setAnswers(saved.map((a: { answer: boolean }) => !!a.answer));
    } catch {
      /* the sections just stay hidden */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setNotice(null);
    try {
      const message = await fn();
      if (message) setNotice({ tone: "ok", text: message });
      await load();
      onChanged?.();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  };

  const uploadPhoto = (file: File | null) => {
    if (!file) return;
    run("photo", async () => {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`${API_BASE}/user/photo`, { method: "POST", headers: getAuthHeader(), body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Could not upload the photo");
      return "Photo updated.";
    });
  };

  const saveHealth = () =>
    run("health", async () => {
      if (!health) return;
      await call("/user/health", "PUT", { emergencyContact: health.emergencyContact, medical: { conditions: health.medical.conditions, medications: health.medical.medications, injuries: health.medical.injuries }, parq: { answers } });
      return "Health details saved.";
    });

  const sign = () =>
    run("waiver", async () => {
      const res = await call("/user/waiver/sign", "POST", { signature, agreed });
      setSignature("");
      setAgreed(false);
      return res.message;
    });

  if (!health || !waiver) return null;
  const setEC = (k: keyof Health["emergencyContact"], v: string) => setHealth({ ...health, emergencyContact: { ...health.emergencyContact, [k]: v } });
  const setMed = (k: "conditions" | "medications" | "injuries", v: string) => setHealth({ ...health, medical: { ...health.medical, [k]: v } });

  return (
    <>
      {waiver.needs_signature && (
        <div className="mt-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Please sign the membership agreement</p>
          <p>The gym needs your signed agreement before you can train. Scroll down to read and sign it.</p>
        </div>
      )}
      {notice && <p className={`mt-6 rounded-lg px-4 py-2 text-sm ${notice.tone === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{notice.text}</p>}

      <section className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-black">Profile photo</h2>
        <p className="mt-1 text-sm text-gray-600">Shown at reception when you check in.</p>
        <label className={`${btn} mt-4 inline-block cursor-pointer`}>
          {busy === "photo" ? "Uploading…" : "Choose a photo"}
          <input type="file" accept="image/*" className="hidden" disabled={busy === "photo"} onChange={(e) => uploadPhoto(e.target.files?.[0] || null)} />
        </label>
      </section>

      <section className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-black">Emergency contact &amp; health</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Emergency contact name</label>
            <input className={input} value={health.emergencyContact.name} onChange={(e) => setEC("name", e.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Their phone</label>
            <input className={input} value={health.emergencyContact.phone} onChange={(e) => setEC("phone", e.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Relationship</label>
            <input className={input} value={health.emergencyContact.relationship} onChange={(e) => setEC("relationship", e.target.value)} placeholder="Partner, parent…" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Medical conditions</label>
            <textarea className={input} rows={2} value={health.medical.conditions} onChange={(e) => setMed("conditions", e.target.value)} placeholder="Asthma, diabetes…" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Medications</label>
            <textarea className={input} rows={2} value={health.medical.medications} onChange={(e) => setMed("medications", e.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Injuries</label>
            <textarea className={input} rows={2} value={health.medical.injuries} onChange={(e) => setMed("injuries", e.target.value)} placeholder="Knee, lower back…" />
          </div>
        </div>

        <h3 className="mt-6 text-base font-bold text-black">Readiness questionnaire (PAR-Q)</h3>
        <p className="text-sm text-gray-600">Answer honestly; a “yes” means we will ask you to check with a doctor before strenuous exercise.</p>
        <div className="mt-3 divide-y divide-gray-100">
          {PARQ_QUESTIONS.map((q, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="max-w-2xl text-gray-800">{q}</span>
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" onClick={() => setAnswers(answers.map((a, j) => (j === i ? v : a)))} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${answers[i] === v ? (v ? "border-red-500 bg-red-50 text-red-700" : "border-green-600 bg-green-50 text-green-800") : "border-gray-300 text-gray-600"}`}>
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {health.medical.parq.completedAt && (
          <p className="mt-2 text-xs text-gray-500">
            Last completed {new Date(health.medical.parq.completedAt).toLocaleDateString()}
            {health.medical.parq.flagged ? " — please speak to a doctor before strenuous exercise." : "."}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button type="button" className={primary} disabled={busy === "health"} onClick={saveHealth}>
            {busy === "health" ? "Saving…" : "Save health details"}
          </button>
        </div>
      </section>

      {(waiver.text || waiver.signed) && (
        <section className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-6" id="waiver">
          <h2 className="text-xl font-bold text-black">Membership agreement</h2>
          {waiver.signed && !waiver.needs_signature ? (
            <p className="mt-2 text-sm text-green-800">
              Signed by {waiver.signed.signature} on {new Date(waiver.signed.signedAt).toLocaleDateString()} (version {waiver.signed.version}).
            </p>
          ) : (
            <>
              {waiver.signed && <p className="mt-2 text-sm text-amber-800">The agreement has changed since you signed version {waiver.signed.version}. Please sign the new one.</p>}
              <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">{waiver.text}</div>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Type your full name to sign</label>
                  <input className={input} value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Full name" />
                </div>
                <label className="flex items-center gap-3 text-sm text-gray-800 lg:mt-9">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4" />I have read and agree to the membership agreement (version {waiver.version}).
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="button" className={primary} disabled={busy === "waiver" || !agreed || signature.trim().length < 3} onClick={sign}>
                  {busy === "waiver" ? "Signing…" : "Sign agreement"}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
};

export default ProfileExtrasSection;
