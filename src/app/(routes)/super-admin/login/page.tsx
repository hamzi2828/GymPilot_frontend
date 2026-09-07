"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { platformFetch, setPlatformToken } from "../_shared/api";

const input = "mt-1 h-10 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30";

// A demo super admin for reviewers, taken from the environment so no real
// credentials ever sit in the code. Both variables must be set for the
// shortcut to appear.
const DEMO_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_DEMO_EMAIL || "";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_SUPER_ADMIN_DEMO_PASSWORD || "";
const HAS_DEMO = !!(DEMO_EMAIL && DEMO_PASSWORD);

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<{ challengeId: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Arriving from the sign-in page's "Super admin" card pre-fills the demo
  // account, when one is configured.
  useEffect(() => {
    if (HAS_DEMO && params.get("demo") === "1") {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
    }
  }, [params]);

  const finish = (token: string) => {
    setPlatformToken(token);
    router.replace("/super-admin");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (challenge) {
        const res = await platformFetch<{ token: string }>("/auth/login/2fa", { method: "POST", body: { challengeId: challenge.challengeId, code: code.replace(/\D/g, "") } });
        finish(res.token);
        return;
      }
      const res = await platformFetch<{ token?: string; requires2fa?: boolean; challengeId?: string; message?: string }>("/auth/login", { method: "POST", body: { email, password } });
      if (res.requires2fa && res.challengeId) {
        setChallenge({ challengeId: res.challengeId, message: res.message || "Enter the code we emailed you." });
        setPassword("");
        return;
      }
      if (res.token) finish(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-8 text-neutral-100 shadow-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">GymPilot</p>
      <h1 className="mt-1 text-xl font-semibold text-white">Platform panel</h1>

      {challenge ? (
        <>
          <p className="mt-1 text-sm text-neutral-400">{challenge.message}</p>
          <label className="mt-6 block">
            <span className="text-xs font-semibold text-neutral-300">6-digit code</span>
            <input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className={`${input} text-center text-2xl tracking-[0.4em]`} placeholder="••••••" />
          </label>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-neutral-400">Sign in with your super admin account.</p>
          <label className="mt-6 block">
            <span className="text-xs font-semibold text-neutral-300">Email</span>
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <label className="mt-4 block">
            <span className="text-xs font-semibold text-neutral-300">Password</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </label>
          {HAS_DEMO && (
            <button
              type="button"
              onClick={() => {
                setEmail(DEMO_EMAIL);
                setPassword(DEMO_PASSWORD);
                setError(null);
              }}
              className="mt-4 w-full rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-neutral-300 transition-colors hover:border-white/30 hover:text-white"
            >
              <span className="block font-semibold">Quick demo login</span>
              <span className="block text-neutral-500">{DEMO_EMAIL} — tap to fill, then Sign in</span>
            </button>
          )}
        </>
      )}

      {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

      <button type="submit" disabled={busy || (challenge ? code.replace(/\D/g, "").length !== 6 : false)} className="mt-6 h-10 w-full rounded-lg bg-white text-sm font-semibold text-neutral-900 transition-opacity hover:opacity-90 disabled:opacity-50">
        {busy ? "Please wait…" : challenge ? "Verify" : "Sign in"}
      </button>

      <div className="mt-4 flex justify-between text-xs text-neutral-500">
        {challenge ? (
          <button type="button" onClick={() => { setChallenge(null); setCode(""); setError(null); }} className="underline">
            Back
          </button>
        ) : (
          <>
            <Link href="/super-admin/forgot" className="underline">
              Forgot password?
            </Link>
            <Link href="/authentication" className="underline">
              Gym sign in
            </Link>
          </>
        )}
      </div>
    </form>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
