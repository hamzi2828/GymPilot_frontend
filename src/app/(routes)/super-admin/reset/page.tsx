"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { platformFetch } from "../_shared/api";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const email = params.get("email") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("The passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await platformFetch("/auth/reset-password", { method: "POST", body: { email, token, password } });
      router.replace("/super-admin/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setBusy(false);
    }
  };

  const input = "mt-1 h-10 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30";

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-8 text-neutral-100 shadow-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">GymPilot</p>
      <h1 className="mt-1 text-xl font-semibold text-white">Choose a new password</h1>
      <p className="mt-1 text-sm text-neutral-400">{email}</p>
      {!token && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">This link is missing its token. Request a new one.</p>}
      <label className="mt-6 block">
        <span className="text-xs font-semibold text-neutral-300">New password (min 10 characters)</span>
        <input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </label>
      <label className="mt-4 block">
        <span className="text-xs font-semibold text-neutral-300">Confirm</span>
        <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
      </label>
      {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
      <button type="submit" disabled={busy || !token} className="mt-6 h-10 w-full rounded-lg bg-white text-sm font-semibold text-neutral-900 hover:opacity-90 disabled:opacity-50">
        {busy ? "Saving…" : "Set password"}
      </button>
      <p className="mt-4 text-xs text-neutral-500">
        <Link href="/super-admin/forgot" className="underline">Request a new link</Link>
      </p>
    </form>
  );
}

export default function SuperAdminResetPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6">
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
