"use client";

import { useState } from "react";
import Link from "next/link";
import { platformFetch } from "../_shared/api";

export default function SuperAdminForgotPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await platformFetch<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } });
      setDone(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-8 text-neutral-100 shadow-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">GymPilot</p>
        <h1 className="mt-1 text-xl font-semibold text-white">Reset your password</h1>
        {done ? (
          <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{done}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-neutral-400">We will email you a link that works for one hour.</p>
            <label className="mt-6 block">
              <span className="text-xs font-semibold text-neutral-300">Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30" />
            </label>
            {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
            <button type="submit" disabled={busy} className="mt-6 h-10 w-full rounded-lg bg-white text-sm font-semibold text-neutral-900 hover:opacity-90 disabled:opacity-50">
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}
        <p className="mt-4 text-xs text-neutral-500">
          <Link href="/super-admin/login" className="underline">Back to sign in</Link>
        </p>
      </form>
    </main>
  );
}
