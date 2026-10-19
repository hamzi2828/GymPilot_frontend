"use client";

// Security and privacy controls for the member's own account: two-factor
// sign-in, ending every session, consent to fingerprint storage, the face
// registered for face check-in (and deleting it), and a copy of their data.

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuthHeader, removeToken } from "@/helper/helper";
import { localDateKey } from "@/helper/date";
import { FORGOT_PASSWORD_PATH, PASSWORD_NOT_SET, RequestError, setTwoFactor as saveTwoFactor } from "../service/userDetailService";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";
import { startNavigationProgress } from "@/components/NavigationProgress";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface Consent { given: boolean; at?: string | null; source?: string }
// GET /api/attendance/me/face: whether the desk has a face on file for them.
interface FaceStatus { enrolled: boolean; enrolledAt: string | null }

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

const btn = "inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50";

export const PrivacySection: React.FC<{ twoFactorEnabled?: boolean; biometricConsent?: Consent | null; onChanged?: () => void }> = ({
  twoFactorEnabled = false,
  biometricConsent = null,
  onChanged,
}) => {
  const router = useRouter();
  const [twoFactor, setTwoFactor] = useState(twoFactorEnabled);
  const [consent, setConsent] = useState<Consent | null>(biometricConsent);
  // One change at a time: while one runs, every button here waits, and the
  // one that was pressed spins.
  const { busyKey: busy, run: runAction, leave } = useAsyncAction();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Switching two-factor OFF makes the account easier to get into, so the API
  // asks for the current password first. This is the box for it.
  const [turningOff, setTurningOff] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // The account has no password (it signs in with Google): the refusal is
  // shown with the way to set one.
  const [setPasswordFirst, setSetPasswordFirst] = useState(false);
  // Face check-in. Null until the API has said; deleting asks first.
  const [face, setFace] = useState<FaceStatus | null>(null);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [confirmingFace, setConfirmingFace] = useState(false);

  useEffect(() => setTwoFactor(twoFactorEnabled), [twoFactorEnabled]);
  useEffect(() => setConsent(biometricConsent), [biometricConsent]);

  const loadFace = useCallback(async () => {
    setFaceError(null);
    try {
      const r = await call("/api/attendance/me/face", "GET");
      setFace({ enrolled: !!r?.data?.enrolled, enrolledAt: typeof r?.data?.enrolled_at === "string" ? r.data.enrolled_at : null });
    } catch (e) {
      setFaceError(e instanceof Error && e.message !== "Request failed" ? e.message : "We could not check your face check-in just now.");
    }
  }, []);

  useEffect(() => {
    loadFace();
  }, [loadFace]);

  const run = (key: string, fn: () => Promise<string | void>) =>
    runAction(async () => {
      setNotice(null);
      try {
        const message = await fn();
        if (message) setNotice({ tone: "ok", text: message });
        onChanged?.();
      } catch (e) {
        setNotice({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong" });
      }
    }, key);

  const closeTurnOff = () => {
    setTurningOff(false);
    setPassword("");
    setPasswordError(null);
    setSetPasswordFirst(false);
  };

  // An empty box is sent as it is: the API answers whether a password is
  // missing or the account has none to give, and only it knows which.
  const turnOff = (e: React.FormEvent) => {
    e.preventDefault();
    runAction(async () => {
      setNotice(null);
      setPasswordError(null);
      setSetPasswordFirst(false);
      try {
        const r = await saveTwoFactor(false, password);
        setTwoFactor(false);
        closeTurnOff();
        setNotice({ tone: "ok", text: r.message || "Two-factor sign-in is off." });
        onChanged?.();
      } catch (err) {
        // The API's own sentence: a missing or wrong password (and, after too
        // many wrong ones, that the password is paused), or no password at all.
        setPasswordError(err instanceof Error ? err.message : "Something went wrong. Two-factor sign-in is still on.");
        setSetPasswordFirst(err instanceof RequestError && err.code === PASSWORD_NOT_SET);
      }
    }, "2fa");
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
                <button type="button" disabled={!!busy || turningOff} className={btn} onClick={() => { setNotice(null); setTurningOff(true); }}>
                  Turn off
                </button>
              ) : (
                <button type="button" disabled={!!busy} aria-busy={busy === "2fa" || undefined} className={btn} onClick={() => run("2fa", async () => { const r = await saveTwoFactor(true); setTwoFactor(true); return r.message; })}>
                  {busy === "2fa" && <Spinner />}
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
              {passwordError && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {passwordError}
                  {setPasswordFirst && (
                    <>
                      {" "}
                      <Link href={FORGOT_PASSWORD_PATH} className="font-semibold underline">
                        Set a password
                      </Link>
                    </>
                  )}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="submit" disabled={!!busy} aria-busy={busy === "2fa" || undefined} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {busy === "2fa" && <Spinner />}
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
            <button
              type="button"
              disabled={!!busy}
              aria-busy={busy === "logout" || undefined}
              className={btn}
              onClick={() =>
                run("logout", async () => {
                  await call("/user/logout-all", "POST");
                  removeToken();
                  // Stays busy until the sign-in page is up.
                  leave();
                  startNavigationProgress();
                  router.replace("/authentication");
                })
              }
            >
              {busy === "logout" && <Spinner />}
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
            <button type="button" disabled={!!busy} aria-busy={busy === "consent" || undefined} className={btn} onClick={() => run("consent", async () => { const r = await call("/user/consents", "PUT", { biometric: !consent?.given }); setConsent(r.data?.biometric || null); loadFace(); return r.message; })}>
              {busy === "consent" && <Spinner />}
              {consent?.given ? "Withdraw consent" : "I agree"}
            </button>
          }
        />
        <div>
          <Row
            title={face ? `Face check-in: ${face.enrolled ? "On" : "Off"}` : "Face check-in"}
            hint={
              !face
                ? faceError || "Checking…"
                : face.enrolled
                ? `The front desk recognises your face${face.enrolledAt ? ` (registered ${new Date(face.enrolledAt).toLocaleDateString()})` : ""}. It keeps numbers that describe your face, never a photo. You can delete them at any time.`
                : "No face data is stored for you. To check in by face, ask at the front desk: they register it only with your consent."
            }
            action={
              face?.enrolled ? (
                <button type="button" disabled={!!busy || confirmingFace} className={btn} onClick={() => { setNotice(null); setConfirmingFace(true); }}>
                  Remove my face data
                </button>
              ) : !face && faceError ? (
                <button type="button" className={btn} onClick={loadFace}>
                  Try again
                </button>
              ) : null
            }
          />
          {confirmingFace && face?.enrolled && (
            <div className="mb-4 rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Remove your face data?</p>
              <p className="mt-1 text-sm text-gray-600">
                The front desk will no longer recognise you by your face. This cannot be undone: to use face check-in again, register at the desk.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  aria-busy={busy === "face" || undefined}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  onClick={() =>
                    run("face", async () => {
                      const r = await call("/api/attendance/me/face", "DELETE");
                      setConfirmingFace(false);
                      setFace({ enrolled: false, enrolledAt: null });
                      return r.message || "Your face data has been deleted.";
                    })
                  }
                >
                  {busy === "face" && <Spinner />}
                  {busy === "face" ? "Removing…" : "Remove my face data"}
                </button>
                <button type="button" disabled={busy === "face"} className={btn} onClick={() => setConfirmingFace(false)}>
                  Keep it
                </button>
              </div>
            </div>
          )}
        </div>
        <Row
          title="Download my data"
          hint="A copy of everything the gym holds about you: account, memberships, bookings and visits."
          action={
            <button
              type="button"
              disabled={!!busy}
              aria-busy={busy === "export" || undefined}
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
              {busy === "export" && <Spinner />}
              Download
            </button>
          }
        />
      </div>
    </section>
  );
};

export default PrivacySection;
