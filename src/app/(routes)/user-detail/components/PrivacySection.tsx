"use client";

// Security and privacy controls for the member's own account: two-factor
// sign-in, ending every session, consent to fingerprint storage, and a copy
// of their data.

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeader, removeToken } from "@/helper/helper";
import { localDateKey } from "@/helper/date";
import { PASSWORD_INCORRECT, PASSWORD_REQUIRED, RequestError, setTwoFactor as saveTwoFactor } from "../service/userDetailService";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface Consent { given: boolean; at?: string | null; source?: string }

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.message || "Request failed");
  return json;
}

// At module level, not inside the component: defined in there it was a new
// component on every render, and anything typed into inside it lost focus
// with each key.
const Row = ({ title, hint, action }: { title: string; hint: string; action: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-4 py-4">
    <div className="max-w-xl">
      <p className="text-sm font-semibold text-black">{title}</p>
      <p className="text-sm text-gray-600">{hint}</p>
    </div>
    {action}
  </div>
);

const btn = "rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50";

export const PrivacySection: React.FC<{ twoFactorEnabled?: boolean; biometricConsent?: Consent | null; onChanged?: () => void }> = ({
  twoFactorEnabled = false,
  biometricConsent = null,
  onChanged,
}) => {
  const router = useRouter();
  const [twoFactor, setTwoFactor] = useState(twoFactorEnabled);
  const [consent, setConsent] = useState<Consent | null>(biometricConsent);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Switching two-factor OFF makes the account easier to get into, so the API
  // asks for the current password first. This is the box for it.
  const [turningOff, setTurningOff] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => setTwoFactor(twoFactorEnabled), [twoFactorEnabled]);
  useEffect(() => setConsent(biometricConsent), [biometricConsent]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setNotice(null);
    try {
      const message = await fn();
      if (message) setNotice({ tone: "ok", text: message });
      onChanged?.();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  };

  const closeTurnOff = () => {
    setTurningOff(false);
    setPassword("");
    setPasswordError(null);
  };

  const turnOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setPasswordError("Enter your current password to turn two-factor sign-in off.");
      return;
    }
    setBusy("2fa");
    setNotice(null);
    setPasswordError(null);
    try {
      const r = await saveTwoFactor(false, password);
      setTwoFactor(false);
      closeTurnOff();
      setNotice({ tone: "ok", text: r.message || "Two-factor sign-in is off." });
      onChanged?.();
    } catch (err) {
      if (err instanceof RequestError && err.code === PASSWORD_INCORRECT) {
        setPasswordError("That password is not right. Two-factor sign-in is still on.");
      } else if (err instanceof RequestError && err.code === PASSWORD_REQUIRED) {
        setPasswordError("Enter your current password to turn two-factor sign-in off.");
      } else {
        setPasswordError(err instanceof Error ? err.message : "Something went wrong. Two-factor sign-in is still on.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-6">
      <h2 className="text-xl font-bold text-black">Security &amp; privacy</h2>
      {notice && <p className={`mt-3 rounded-lg px-4 py-2 text-sm ${notice.tone === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{notice.text}</p>}
      <div className="mt-2 divide-y divide-gray-100">
        <div>
          <Row
            title="Two-factor sign-in"
            hint={twoFactor ? "On — we email you a 6-digit code every time you sign in." : "Off — add a 6-digit emailed code to every sign-in."}
            action={
              twoFactor ? (
                <button type="button" disabled={busy === "2fa" || turningOff} className={btn} onClick={() => { setNotice(null); setTurningOff(true); }}>
                  Turn off
                </button>
              ) : (
                <button type="button" disabled={busy === "2fa"} className={btn} onClick={() => run("2fa", async () => { const r = await saveTwoFactor(true); setTwoFactor(true); return r.message; })}>
                  Turn on
                </button>
              )
            }
          />
          {turningOff && twoFactor && (
            <form onSubmit={turnOff} className="mb-4 rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
              <label className="block text-sm font-semibold text-gray-900" htmlFor="twofactor-current-password">
                Current password
              </label>
              <p className="mt-1 text-sm text-gray-600">
                Without two-factor sign-in, your password alone opens your account. Enter it to confirm it is you.
              </p>
              <input
                id="twofactor-current-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full max-w-sm rounded-lg border-2 border-gray-200 bg-white px-4 py-3 focus:border-primary focus:outline-none"
              />
              {passwordError && <p role="alert" className="mt-2 text-sm text-red-700">{passwordError}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="submit" disabled={busy === "2fa"} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {busy === "2fa" ? "Turning off…" : "Turn off two-factor sign-in"}
                </button>
                <button type="button" disabled={busy === "2fa"} className={btn} onClick={closeTurnOff}>
                  Keep it on
                </button>
              </div>
            </form>
          )}
        </div>
        <Row
          title="Sign out everywhere"
          hint="Ends every session on every device, including this one."
          action={
            <button type="button" disabled={busy === "logout"} className={btn} onClick={() => run("logout", async () => { await call("/user/logout-all", "POST"); removeToken(); router.replace("/authentication"); })}>
              Sign out everywhere
            </button>
          }
        />
        <Row
          title="Fingerprint check-in"
          hint={
            consent?.given
              ? `You have agreed to fingerprint storage${consent.at ? ` (${new Date(consent.at).toLocaleDateString()})` : ""}. Withdrawing deletes any stored fingerprints.`
              : "To check in with a fingerprint at reception, agree to the gym storing an encrypted template of it. You can withdraw this at any time."
          }
          action={
            <button type="button" disabled={busy === "consent"} className={btn} onClick={() => run("consent", async () => { const r = await call("/user/consents", "PUT", { biometric: !consent?.given }); setConsent(r.data?.biometric || null); return r.message; })}>
              {consent?.given ? "Withdraw consent" : "I agree"}
            </button>
          }
        />
        <Row
          title="Download my data"
          hint="A copy of everything the gym holds about you: account, memberships, bookings and visits."
          action={
            <button
              type="button"
              disabled={busy === "export"}
              className={btn}
              onClick={() =>
                run("export", async () => {
                  const res = await fetch(`${API_BASE}/user/export`, { headers: getAuthHeader() });
                  if (!res.ok) throw new Error("Could not export your data");
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `my-data-${localDateKey()}.json`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                  return "Your data is downloading.";
                })
              }
            >
              Download
            </button>
          }
        />
      </div>
    </section>
  );
};

export default PrivacySection;
