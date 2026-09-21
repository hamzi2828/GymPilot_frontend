"use client";

// The web check-in kiosk: a tablet or any PC at the door, no fingerprint
// reader needed. Staff sign in once with an account that has "Allow
// attendance app"; members then scan the QR code from their account page,
// or type their member number, and are checked in or out.
//
// It speaks the same /api/desktop endpoints as the Windows front-desk app,
// so the two record identical attendance rows.

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const TOKEN_KEY = "kiosk_token";
const CLIENT_APP = "GymPilotKiosk/1.0";
const RECEIPT_SECONDS = 8;
const SCAN_COOLDOWN_MS = 4000;

interface ReceiptRow { caption: string; value: string }
interface Receipt {
  action: "check_in" | "check_out";
  person_type: string;
  person_name: string;
  person_code: string;
  person_meta: string;
  status: string;
  status_label: string;
  warning: string | null;
  rows: ReceiptRow[];
  check_in_time: string | null;
  check_out_time: string | null;
}
interface Person { person_type: string; id: string; name: string; code: string; meta: string }
interface RecentEntry { person_type: string; name: string; code: string; check_in_time: string | null; check_out_time: string | null; still_in: boolean; status: string; status_label: string }

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function desk<T>(path: string, body: Record<string, unknown> = {}, token?: string | null): Promise<T & { success: boolean; message?: string; http_status?: number }> {
  const res = await fetch(`${API_BASE}/api/desktop/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...body, client_app: CLIENT_APP, device_label: "Web kiosk" }),
  });
  const json = await res.json().catch(() => ({}));
  return { ...json, http_status: res.status };
}

/** Two short tones through WebAudio -- no sound files to ship. */
function beep(good: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = good ? [880, 1320] : [330, 220];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.14);
    });
  } catch {
    /* no audio: fine */
  }
}

// Suspended is lapsed, as the desk counts it; pending and cancelled (still
// running) need a word rather than a refusal. Unlisted, they flashed green
// over a receipt whose warning said otherwise.
function tone(status: string) {
  if (status.includes("expired") || status.includes("none") || status.includes("frozen") || status.includes("past_due") || status.includes("suspended") || status === "late") return "bad";
  if (status.includes("expiring") || status.includes("pending") || status.includes("cancelled")) return "warn";
  return "good";
}

export default function KioskPage() {
  const [token, setToken] = useState<string | null>(null);
  const [operator, setOperator] = useState<{ name: string; location?: string } | null>(null);
  const [booting, setBooting] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [flash, setFlash] = useState<{ tone: "good" | "warn" | "bad"; text: string } | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [dateLabel, setDateLabel] = useState("");

  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const receiptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRecent = useCallback(async (t: string) => {
    const res = await desk<{ entries: RecentEntry[]; date_label: string }>("recent", { limit: 10 }, t);
    if (res.success) {
      setRecent(res.entries || []);
      setDateLabel(res.date_label || "");
    }
  }, []);

  // Resume a saved session.
  useEffect(() => {
    const saved = readToken();
    if (!saved) {
      setBooting(false);
      return;
    }
    desk<{ user: { name: string; location?: string } }>("session", {}, saved)
      .then((res) => {
        if (res.success) {
          setToken(saved);
          setOperator(res.user);
          loadRecent(saved);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .finally(() => setBooting(false));
  }, [loadRecent]);

  const showReceipt = (r: Receipt | null, message: { tone: "good" | "warn" | "bad"; text: string } | null) => {
    setReceipt(r);
    setFlash(message);
    if (receiptTimer.current) clearTimeout(receiptTimer.current);
    receiptTimer.current = setTimeout(() => {
      setReceipt(null);
      setFlash(null);
    }, RECEIPT_SECONDS * 1000);
  };

  const punch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!token) return;
      const res = await desk<{ detail: Receipt | null }>("punch", body, token);
      if (res.http_status === 401 || res.http_status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setOperator(null);
        setLoginError(res.message || "Please sign in again.");
        return;
      }
      if (res.success && res.detail) {
        const t = tone(res.detail.status || "");
        beep(t !== "bad");
        showReceipt(res.detail, { tone: t, text: res.message || "" });
        loadRecent(token);
      } else {
        beep(false);
        showReceipt(null, { tone: "bad", text: res.message || "Could not record attendance." });
      }
      setCode("");
      setQuery("");
      setPeople([]);
    },
    [token, loadRecent]
  );

  // Camera scanning.
  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("kiosk-scanner", { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (text) => {
          const now = Date.now();
          if (lastScanRef.current.text === text && now - lastScanRef.current.at < SCAN_COOLDOWN_MS) return;
          lastScanRef.current = { text, at: now };
          punch({ qr: text });
        },
        () => {
          /* no code in frame */
        }
      );
      setCameraOn(true);
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : "Could not start the camera. Check the browser's camera permission.");
      setCameraOn(false);
    }
  }, [punch]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await desk<{ token: string; user: { name: string; location?: string } }>("login", { email, password });
      if (!res.success || !res.token) throw new Error(res.message || "Sign in failed");
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setOperator(res.user);
      setPassword("");
      loadRecent(res.token);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    if (token) await desk("logout", {}, token).catch(() => {});
    await stopCamera();
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setOperator(null);
  };

  const search = async (q: string) => {
    setQuery(q);
    if (!token || q.trim().length < 2) {
      setPeople([]);
      return;
    }
    setSearching(true);
    try {
      const res = await desk<{ members: Person[]; staff: Person[] }>("people", { q: q.trim() }, token);
      if (res.success) setPeople([...(res.members || []), ...(res.staff || [])].slice(0, 8));
    } finally {
      setSearching(false);
    }
  };

  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
      </main>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-8 text-neutral-100 shadow-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">GymPilot</p>
          <h1 className="mt-1 text-xl font-semibold text-white">Check-in kiosk</h1>
          <p className="mt-1 text-sm text-neutral-400">Sign in with a staff account that is allowed to use the attendance app.</p>
          <label className="mt-6 block">
            <span className="text-xs font-semibold text-neutral-300">Email</span>
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30" />
          </label>
          <label className="mt-4 block">
            <span className="text-xs font-semibold text-neutral-300">Password</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30" />
          </label>
          {loginError && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{loginError}</p>}
          <button type="submit" disabled={loggingIn} className="mt-6 h-11 w-full rounded-lg bg-white text-sm font-semibold text-neutral-900 hover:opacity-90 disabled:opacity-50">
            {loggingIn ? "Signing in…" : "Start kiosk"}
          </button>
        </form>
      </main>
    );
  }

  const flashCls = flash?.tone === "bad" ? "bg-rose-600" : flash?.tone === "warn" ? "bg-amber-500 text-black" : "bg-emerald-600";

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">GymPilot check-in</p>
          <p className="text-sm text-neutral-300">
            {operator?.name}
            {operator?.location ? ` · ${operator.location}` : ""} · {dateLabel}
          </p>
        </div>
        <button type="button" onClick={logout} className="text-xs font-medium text-neutral-400 hover:text-white">
          Sign out
        </button>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: scanner + manual */}
        <section className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Scan your QR code</h2>
              {cameraOn ? (
                <button type="button" onClick={stopCamera} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5">
                  Stop camera
                </button>
              ) : (
                <button type="button" onClick={startCamera} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:opacity-90">
                  Start camera
                </button>
              )}
            </div>
            <div id="kiosk-scanner" className={`mt-4 overflow-hidden rounded-xl bg-black ${cameraOn ? "min-h-[280px]" : "hidden"}`} />
            {!cameraOn && (
              <div className="mt-4 flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-white/15 text-center text-sm text-neutral-500">
                {cameraError || "Start the camera, then hold the QR code from your account page in front of it."}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
            <h2 className="text-base font-semibold text-white">Or type your member number</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) punch({ code: code.trim() });
              }}
              className="mt-3 flex gap-2"
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. GP-0184"
                className="h-14 flex-1 rounded-xl border border-white/10 bg-neutral-950 px-4 text-2xl font-semibold tracking-wider text-white outline-none focus:border-white/30"
                autoComplete="off"
              />
              <button type="submit" disabled={!code.trim()} className="h-14 rounded-xl bg-emerald-500 px-6 text-base font-semibold text-black hover:opacity-90 disabled:opacity-40">
                Check in / out
              </button>
            </form>

            <div className="mt-4">
              <input
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder="Staff: find someone by name, phone or email…"
                className="h-10 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30"
              />
              {(people.length > 0 || searching) && (
                <ul className="mt-2 divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
                  {searching && !people.length && <li className="px-3 py-2 text-xs text-neutral-500">Searching…</li>}
                  {people.map((p) => (
                    <li key={`${p.person_type}:${p.id}`}>
                      <button type="button" onClick={() => punch({ person_type: p.person_type, person_id: p.id, method: "manual" })} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/5">
                        <span className="text-sm text-white">
                          {p.name} <span className="text-xs text-neutral-500">{p.code}</span>
                        </span>
                        <span className="text-xs text-neutral-500">{p.person_type} · {p.meta}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Right: receipt + today */}
        <section className="space-y-5">
          <div className={`min-h-[260px] rounded-2xl border border-white/10 p-5 transition-colors ${receipt ? "bg-neutral-900" : "bg-neutral-900/50"}`}>
            {flash && <div className={`mb-4 rounded-lg px-4 py-2 text-sm font-semibold text-white ${flashCls}`}>{flash.text}</div>}
            {receipt ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{receipt.action === "check_in" ? "Checked in" : "Checked out"}</p>
                <h3 className="mt-1 text-3xl font-bold text-white">{receipt.person_name}</h3>
                <p className="text-sm text-neutral-400">
                  {receipt.person_code} · {receipt.person_meta}
                </p>
                {receipt.warning && <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-300">{receipt.warning}</p>}
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {receipt.rows.map((r) => (
                    <React.Fragment key={r.caption}>
                      <dt className="text-neutral-500">{r.caption}</dt>
                      <dd className="text-right font-medium text-white">{r.value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>
            ) : (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
                <div className="mb-3 h-16 w-16 animate-pulse rounded-full border-2 border-emerald-500/40" />
                <p className="text-lg font-semibold text-white">Ready</p>
                <p className="text-sm text-neutral-500">Scan or type a member number to check in or out.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
            <h2 className="text-sm font-semibold text-white">Today</h2>
            {!recent.length ? (
              <p className="mt-2 text-xs text-neutral-500">Nobody yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-white/5">
                {recent.map((r, i) => (
                  <li key={`${r.code}-${i}`} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="text-white">{r.name}</p>
                      <p className="text-xs text-neutral-500">
                        {r.code} · {r.status_label}
                      </p>
                    </div>
                    <div className="text-right text-xs text-neutral-400">
                      <p>in {r.check_in_time || "—"}</p>
                      <p>{r.still_in ? <span className="text-emerald-400">still in</span> : `out ${r.check_out_time || "—"}`}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
