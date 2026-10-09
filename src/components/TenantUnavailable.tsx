"use client";

// Shown instead of the site when the API says this domain does not lead to a
// gym, or the gym it leads to is not being served right now. Plain and
// unbranded on purpose: there is no gym to take the branding from.
//
// A lapsed subscription (SUBSCRIPTION_INACTIVE, `renewable`) is the one case
// the gym can fix from here: the API still lets its owner sign in and pay, so
// this page offers exactly that. Stripe then sends them back with
// ?billing=success, and the page waits for the webhook to switch the gym
// back on before reloading into the admin's Billing tab.

import { useEffect, useState } from "react";
import { login, verifyTwoFactor, type LoginResponse } from "@/app/(routes)/authentication/service/authService";
import { getCurrentUser, removeToken, setRole, setToken } from "@/helper/helper";
import { API_BASE } from "@/app/(routes)/admin/_shared/api";
import { openPortal, startCheckout } from "@/app/(routes)/admin/settings/billingApi";

const COPY: Record<string, { title: string; body: string }> = {
  TENANT_NOT_FOUND: {
    title: "This domain isn't connected to a gym yet",
    body: "If you are setting this gym up, add this domain to the gym in the GymPilot platform panel. It usually takes effect within a minute.",
  },
  TENANT_SUSPENDED: {
    title: "This gym's website is currently suspended",
    body: "Please contact GymPilot support to restore access.",
  },
  SUBSCRIPTION_INACTIVE: {
    title: "This gym's GymPilot subscription is not active",
    body: "Please contact GymPilot support to renew the subscription and bring the website back.",
  },
};

const RENEWABLE_BODY =
  "Nothing has been deleted. If you run this gym, sign in to renew and the website, member app and admin come back exactly as you left them.";

// After paying: how often to ask whether the gym is back, and for how long.
const REACTIVATE_EVERY_MS = 4000;
const REACTIVATE_TIMEOUT_MS = 3 * 60 * 1000;

type Phase = "idle" | "signin" | "code" | "reactivating" | "slow";

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none";
const primaryClass =
  "inline-flex h-10 w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function RenewPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Where Stripe sent us back from, and whether a session is already here.
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get("billing");
    if (outcome === "success") setPhase("reactivating");
    else if (outcome === "cancelled") setInfo("Checkout was cancelled — nothing was charged.");
    setSignedIn(!!getCurrentUser());
  }, []);

  // Paid: the gym comes back once Stripe's webhook has landed. Until then the
  // API keeps answering 402; the first answer that is not (and is not a
  // server hiccup) means there is something new to show, so reload.
  useEffect(() => {
    if (phase !== "reactivating") return;
    let stopped = false;
    (async () => {
      const startedAt = Date.now();
      while (!stopped && Date.now() - startedAt < REACTIVATE_TIMEOUT_MS) {
        await wait(REACTIVATE_EVERY_MS);
        if (stopped) return;
        try {
          const res = await fetch(`${API_BASE}/settings/public`, { cache: "no-store" });
          if (res.status !== 402 && res.status < 500) {
            window.location.reload();
            return;
          }
        } catch {
          /* offline for a moment: keep waiting */
        }
      }
      if (!stopped) setPhase("slow");
    })();
    return () => {
      stopped = true;
    };
  }, [phase]);

  // The same two calls the sign-in page makes with the token it gets back.
  // From here on the page is in its signed-in state, so a refusal below is
  // shown beside "Renew now" and "Use a different account".
  const keepSession = (res: LoginResponse) => {
    setToken(res.token);
    try {
      if (res?.data?.role) setRole(res.data.role);
    } catch {}
    setSignedIn(true);
    setPhase("idle");
    setChallenge(null);
    setCode("");
    setPassword("");
  };

  // Signed in: straight to Stripe. A gym Stripe already bills (a card that
  // kept failing) goes to the portal to fix the card instead.
  const renew = async () => {
    setBusy(true);
    setError(null);
    try {
      let res = await startCheckout();
      if (res.status === 401) {
        // The stored session has ended; sign in afresh.
        removeToken();
        setSignedIn(false);
        setPhase("signin");
        setError("Your session has ended. Please sign in again.");
        setBusy(false);
        return;
      }
      if (res.code === "ALREADY_SUBSCRIBED") res = await openPortal();
      if (res.ok && res.data?.url) {
        window.location.assign(res.data.url);
        return;
      }
      if (res.status === 403) setError("Only the gym's owner or an admin with Settings access can renew.");
      else if (res.code === "PLATFORM_STRIPE_NOT_CONFIGURED") setError("Online payment isn't set up yet. Please contact GymPilot support to renew.");
      else setError(res.message || "Could not start the payment. Please try again.");
    } catch {
      setError("Could not reach the server. Please try again.");
    }
    setBusy(false);
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email or username, and your password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await login({ email: email.trim(), password });
      if (res.requires2fa && res.challengeId) {
        // Password accepted; the emailed code comes next.
        setChallenge({ id: res.challengeId, message: res.message });
        setPhase("code");
        setBusy(false);
        return;
      }
      keepSession(res);
      await renew();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (!challenge || digits.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      keepSession(await verifyTwoFactor({ challengeId: challenge.id, code: digits }));
      await renew();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code");
      setBusy(false);
    }
  };

  if (phase === "reactivating") {
    return (
      <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
        <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />
        Payment received — reactivating your gym…
      </div>
    );
  }

  if (phase === "slow") {
    return (
      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        <p>Payment received, but switching your gym back on is taking longer than usual.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-3 text-sm font-semibold underline underline-offset-2">
          Check again
        </button>
        <p className="mt-2 text-xs">Still showing this in a few minutes? Contact GymPilot support.</p>
      </div>
    );
  }

  const messages = (
    <>
      {info && <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{info}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </>
  );

  if (phase === "code" && challenge) {
    return (
      <form onSubmit={verify} className="mt-8 rounded-xl border border-neutral-200 bg-white p-5 text-left">
        <p className="text-sm font-semibold text-neutral-900">Enter your sign-in code</p>
        <p className="mt-1 text-xs text-neutral-500">{challenge.message}</p>
        <label className="mt-4 block">
          <span className="text-xs font-medium text-neutral-600">6-digit code</span>
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} text-center text-lg tracking-[0.3em]`}
          />
        </label>
        {messages}
        <button type="submit" disabled={busy || code.replace(/\D/g, "").length !== 6} className={`mt-4 ${primaryClass}`}>
          {busy ? "Working…" : "Continue to payment"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPhase("signin");
            setChallenge(null);
            setCode("");
            setError(null);
          }}
          className="mt-3 w-full text-xs text-neutral-500 underline underline-offset-2"
        >
          Back
        </button>
      </form>
    );
  }

  if (phase === "signin") {
    return (
      <form onSubmit={signIn} className="mt-8 rounded-xl border border-neutral-200 bg-white p-5 text-left">
        <p className="text-sm font-semibold text-neutral-900">Sign in to renew</p>
        <p className="mt-1 text-xs text-neutral-500">Use the gym owner&apos;s account, or an admin&apos;s with Settings access.</p>
        <label className="mt-4 block">
          <span className="text-xs font-medium text-neutral-600">Email or username</span>
          <input type="text" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-neutral-600">Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </label>
        {messages}
        <button type="submit" disabled={busy} className={`mt-4 ${primaryClass}`}>
          {busy ? "Working…" : "Sign in and pay"}
        </button>
      </form>
    );
  }

  // Idle: one button. Already signed in, it goes straight to payment.
  return (
    <div className="mt-8">
      {messages}
      <button type="button" disabled={busy} onClick={() => (signedIn ? renew() : setPhase("signin"))} className={`mt-4 ${primaryClass}`}>
        {busy ? "Working…" : signedIn ? "Renew now" : "Sign in to renew"}
      </button>
      {signedIn && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setInfo(null);
            setPhase("signin");
          }}
          className="mt-3 w-full text-xs text-neutral-500 underline underline-offset-2"
        >
          Use a different account
        </button>
      )}
    </div>
  );
}

export default function TenantUnavailable({
  code,
  message,
  host,
  renewable,
}: {
  code: string;
  message?: string;
  host?: string | null;
  renewable?: boolean;
}) {
  const canRenew = code === "SUBSCRIPTION_INACTIVE" && !!renewable;
  const copy = COPY[code] || { title: "This website is unavailable", body: message || "Please try again later." };

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-6 py-24 text-neutral-900">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">GymPilot</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm text-neutral-600">{canRenew ? RENEWABLE_BODY : copy.body}</p>
        {canRenew && <RenewPanel />}
        {host && (
          <p className="mt-6 rounded-lg border border-neutral-200 bg-white px-4 py-2 font-mono text-xs text-neutral-500">
            {host}
          </p>
        )}
      </div>
    </main>
  );
}
