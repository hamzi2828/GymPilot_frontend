"use client";

// The web check-in kiosk: a tablet or any PC at the door, no fingerprint
// reader needed. Staff sign in once with an account that has "Allow
// attendance app"; members then scan the QR code from their account page,
// or type their member number, and are checked in or out.
//
// It speaks the same /api/desktop endpoints as the Windows front-desk app,
// so the two record identical attendance rows.
//
// The screen faces the public, so finding someone by name -- a list with
// phone numbers and emails -- checking them in by hand, and signing the kiosk
// out are behind a "Staff" unlock: the desk account's password typed again.
// The server holds the kiosk to that too (kioskStaffOnly in the backend's
// desktopAuth), and the kiosk locks itself again after a minute without a
// tap.

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const TOKEN_KEY = "kiosk_token";
const CLIENT_APP = "GymPilotKiosk/1.0";
const RECEIPT_SECONDS = 8;
const SCAN_COOLDOWN_MS = 4000;
// A staff unlock lasts while someone is using it. The server's own ceiling
// on one unlock is longer; this is what keeps it from being left open.
const STAFF_IDLE_MS = 60 * 1000;
const STAFF_UNLOCK_REQUIRED = "STAFF_UNLOCK_REQUIRED";
// How often the kiosk asks the server "are you there": every half minute
// while all is well, so a dropped connection is noticed before the next
// member walks up, and every few seconds while it is down, so it comes back
// by itself.
const HEARTBEAT_MS = 30 * 1000;
const RECONNECT_MS = 5 * 1000;
const NOT_CONNECTED = "Not connected. Check the internet connection and try again.";

interface ReceiptRow { caption: string; value: string }
// Which sound a member's punch gets and what to say after it -- decided by the
// server (punchService.memberAlert), so this kiosk and the Windows desk agree.
// Null for staff and for a repeat scan.
interface PunchAlert { level: "ok" | "warning" | "problem"; speech: string | null }
interface Receipt {
  action: "check_in" | "check_out";
  person_type: string;
  person_name: string;
  person_code: string;
  person_meta: string;
  status: string;
  status_label: string;
  warning: string | null;
  alert?: PunchAlert | null;
  // Money still owed on the member's package ("Balance due £25"); the
  // warning line already says it, amber, and entry is never refused for it.
  balance_due?: number;
  balance_due_label?: string | null;
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

type DeskAnswer<T> = T & { success: boolean; message?: string; code?: string; http_status?: number; offline?: boolean };

// Never throws. A request that got no answer -- the network is down, or the
// proxy in front of the API answered for it (502/503/504) -- comes back as
// `offline`, which every caller checks: it used to be an unhandled rejection,
// so a scan with the network down did nothing at all, no message, no sound.
async function desk<T>(path: string, body: Record<string, unknown> = {}, token?: string | null): Promise<DeskAnswer<T>> {
  const unreachable = { success: false, offline: true, http_status: 0, message: NOT_CONNECTED } as unknown as DeskAnswer<T>;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/desktop/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...body, client_app: CLIENT_APP, device_label: "Web kiosk" }),
    });
  } catch {
    return unreachable;
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) return { ...unreachable, http_status: res.status };
  const json = await res.json().catch(() => ({}));
  return { ...json, http_status: res.status };
}

type Tone = "good" | "warn" | "bad";

// One tune per tone, so the three can be told apart without looking: rising
// for all good, two level notes for "have a word" (expiring soon, balance
// due), falling and low for a problem (expired, unpaid, frozen).
const TONES: Record<Tone, number[]> = {
  good: [880, 1320],
  warn: [660, 660],
  bad: [330, 220],
};

// How long a tune lasts, so speech starts after it rather than over it.
const TONE_MS = 400;

/** Two short tones through WebAudio -- no sound files to ship. */
function beep(kind: Tone) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    TONES[kind].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.14);
    });
    // A context per beep would otherwise pile up until the browser refuses
    // to open another.
    setTimeout(() => ctx.close().catch(() => {}), TONE_MS + 200);
  } catch {
    /* no audio: fine */
  }
}

/** The gym's message, read out by the browser. Silent where it cannot speak. */
function speak(text: string) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
    // The newest punch wins: a queue of stale messages would be read out to
    // the wrong people.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch {
    /* no speech: the tone has already played */
  }
}

const ALERT_TONE: Record<PunchAlert["level"], Tone> = { ok: "good", warning: "warn", problem: "bad" };

// Suspended is lapsed, as the desk counts it; pending and cancelled (still
// running) need a word rather than a refusal. Unlisted, they flashed green
// over a receipt whose warning said otherwise.
function tone(status: string): Tone {
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

  // The staff unlock: the signed grant the server handed back, sent with
  // every people search and hand-picked punch until the kiosk locks again.
  const [staffUnlock, setStaffUnlock] = useState<{ grant: string; expiresAt: number } | null>(null);
  const [unlockPrompt, setUnlockPrompt] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const staffActivityRef = useRef(0);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const receiptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The server cannot be reached. While this is set nothing the kiosk is
  // shown gets recorded, so the screen says so in red until it is back.
  const [offline, setOffline] = useState(false);
  const offlineRef = useRef(false);

  // `sound`: the low tune once, at the moment the connection is found gone.
  // A failed punch plays its own, so it passes false.
  const markOffline = useCallback((sound = true) => {
    if (offlineRef.current) return;
    offlineRef.current = true;
    setOffline(true);
    if (sound) beep("bad");
  }, []);

  const markOnline = useCallback(() => {
    if (!offlineRef.current) return;
    offlineRef.current = false;
    setOffline(false);
  }, []);

  const loadRecent = useCallback(
    async (t: string) => {
      const res = await desk<{ entries: RecentEntry[]; date_label: string }>("recent", { limit: 10 }, t);
      if (res.offline) {
        markOffline();
        return;
      }
      if (res.success) {
        setRecent(res.entries || []);
        setDateLabel(res.date_label || "");
      }
    },
    [markOffline]
  );

  // Resume a saved session.
  useEffect(() => {
    const saved = readToken();
    if (!saved) {
      setBooting(false);
      return;
    }
    desk<{ user: { name: string; location?: string } }>("session", {}, saved)
      .then((res) => {
        if (res.offline) {
          // No answer is not a refusal: the kiosk keeps its sign-in, shows
          // "not connected", and checks the session as soon as it is back.
          setToken(saved);
          markOffline(false);
        } else if (res.success) {
          setToken(saved);
          setOperator(res.user);
          loadRecent(saved);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .finally(() => setBooting(false));
  }, [loadRecent, markOffline]);

  const showReceipt = (r: Receipt | null, message: { tone: "good" | "warn" | "bad"; text: string } | null) => {
    setReceipt(r);
    setFlash(message);
    if (receiptTimer.current) clearTimeout(receiptTimer.current);
    receiptTimer.current = setTimeout(() => {
      setReceipt(null);
      setFlash(null);
    }, RECEIPT_SECONDS * 1000);
  };

  // Back to the member-only screen: the grant is forgotten, and so is
  // whatever the search had on screen.
  const lockStaff = useCallback(() => {
    setStaffUnlock(null);
    setUnlockPrompt(false);
    setUnlockPassword("");
    setUnlockError(null);
    setQuery("");
    setPeople([]);
  }, []);

  const touchStaff = useCallback(() => {
    staffActivityRef.current = Date.now();
  }, []);

  // A minute with no tap -- or the server's grant running out -- locks it.
  // The password prompt closes on the same clock, so a half-typed unlock is
  // not left waiting for the next person.
  useEffect(() => {
    if (!staffUnlock && !unlockPrompt) return;
    const timer = setInterval(() => {
      const idle = Date.now() - staffActivityRef.current >= STAFF_IDLE_MS;
      const expired = staffUnlock !== null && Date.now() >= staffUnlock.expiresAt;
      if (idle || expired) lockStaff();
    }, 1000);
    return () => clearInterval(timer);
  }, [staffUnlock, unlockPrompt, lockStaff]);

  // The server refused the desk token itself: back to the sign-in form.
  const endSession = useCallback(
    (message?: string) => {
      localStorage.removeItem(TOKEN_KEY);
      lockStaff();
      setToken(null);
      setOperator(null);
      setLoginError(message || "Please sign in again.");
    },
    [lockStaff]
  );

  // Is the server there? Asked on a timer while signed in, and at once when
  // the browser reports the network going or coming back.
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    const probe = async () => {
      const res = await desk<{ user?: { name: string; location?: string } }>("session", {}, token);
      if (stopped) return;
      if (res.offline) {
        markOffline();
        return;
      }
      const wasOffline = offlineRef.current;
      markOnline();
      if (res.http_status === 401 || res.http_status === 403) {
        endSession(res.message);
        return;
      }
      if (res.success && res.user) setOperator(res.user);
      if (wasOffline) loadRecent(token);
    };
    const gone = () => markOffline();
    const timer = setInterval(probe, offline ? RECONNECT_MS : HEARTBEAT_MS);
    window.addEventListener("online", probe);
    window.addEventListener("offline", gone);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("online", probe);
      window.removeEventListener("offline", gone);
    };
  }, [token, offline, markOffline, markOnline, endSession, loadRecent]);

  const punch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!token) return;
      const res = await desk<{ detail: Receipt | null }>("punch", body, token);
      if (res.offline) {
        // Said out loud and in red: the person at the door must not walk in
        // believing they were checked in. What they typed is kept, to send
        // again once the connection is back.
        markOffline(false);
        if (speechTimer.current) clearTimeout(speechTimer.current);
        beep("bad");
        showReceipt(null, { tone: "bad", text: "Not connected, so this was NOT recorded. Please tell the front desk." });
        return;
      }
      markOnline();
      if (res.http_status === 401 || res.http_status === 403) {
        endSession(res.message);
        return;
      }
      // Whatever the last punch had queued up to say is stale now.
      if (speechTimer.current) clearTimeout(speechTimer.current);
      if (res.code === STAFF_UNLOCK_REQUIRED) {
        // The unlock ran out on the server between the pick and the punch.
        lockStaff();
        beep("bad");
        showReceipt(null, { tone: "bad", text: "Staff unlock expired. Unlock again to check someone in by name." });
        return;
      }
      if (res.success && res.detail) {
        // A member's punch comes with the server's alert; a staff punch (or an
        // older server) is judged from the status here, as it always was.
        const alert = res.detail.alert;
        const t = alert ? ALERT_TONE[alert.level] || tone(res.detail.status || "") : tone(res.detail.status || "");
        beep(t);
        const said = alert?.speech;
        if (said) speechTimer.current = setTimeout(() => speak(said), TONE_MS);
        showReceipt(res.detail, { tone: t, text: res.message || "" });
        loadRecent(token);
      } else {
        beep("bad");
        showReceipt(null, { tone: "bad", text: res.message || "Could not record attendance." });
      }
      setCode("");
      setQuery("");
      setPeople([]);
    },
    [token, loadRecent, endSession, lockStaff, markOffline, markOnline]
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
    lockStaff();
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setOperator(null);
  };

  const openUnlock = () => {
    touchStaff();
    setUnlockError(null);
    setUnlockPrompt(true);
  };

  // The desk account's password again. A wrong one is a 400 from the
  // server, not a 401 -- the kiosk stays signed in either way.
  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !unlockPassword) return;
    touchStaff();
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await desk<{ unlock: string; expires_in?: number }>("unlock", { password: unlockPassword }, token);
      if (res.offline) {
        markOffline();
        setUnlockError(NOT_CONNECTED);
        return;
      }
      if (res.http_status === 401 || res.http_status === 403) {
        endSession(res.message);
        return;
      }
      if (!res.success || !res.unlock) {
        setUnlockError(res.message || "Could not unlock.");
        return;
      }
      touchStaff();
      setPeople([]);
      setStaffUnlock({ grant: res.unlock, expiresAt: Date.now() + (res.expires_in || 600) * 1000 });
      setUnlockPrompt(false);
    } catch {
      setUnlockError("Could not reach the server. Try again.");
    } finally {
      setUnlockPassword("");
      setUnlocking(false);
    }
  };

  const search = async (q: string) => {
    setQuery(q);
    touchStaff();
    if (!token || !staffUnlock || q.trim().length < 2) {
      setPeople([]);
      return;
    }
    setSearching(true);
    try {
      const res = await desk<{ members: Person[]; staff: Person[] }>("people", { q: q.trim(), staff_unlock: staffUnlock.grant }, token);
      if (res.offline) {
        markOffline();
        setPeople([]);
        return;
      }
      if (res.http_status === 401 || res.http_status === 403) {
        endSession(res.message);
        return;
      }
      if (res.code === STAFF_UNLOCK_REQUIRED) {
        lockStaff();
        showReceipt(null, { tone: "bad", text: "Staff unlock expired. Unlock again to search." });
        return;
      }
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
            <span className="text-xs font-semibold text-neutral-300">Email or username</span>
            <input type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30" />
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
        {/* Staff only, like the search: a member at the screen must not be
            able to take the kiosk off its desk account. */}
        {staffUnlock && (
          <button type="button" onClick={logout} className="text-xs font-medium text-neutral-400 hover:text-white">
            Sign out
          </button>
        )}
      </header>

      {/* Nothing is being recorded while this shows, so it is not subtle. It
          clears by itself when the server answers again. */}
      {offline && (
        <div role="alert" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-rose-600 px-6 py-3 text-center text-white">
          <span className="text-base font-bold">Not connected</span>
          <span className="text-sm">Check-ins are not being recorded. Check the internet connection. The kiosk reconnects by itself.</span>
        </div>
      )}

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

            {/* Staff only. Locked, this is one quiet button: nothing a member
                can use to list other members or check them in. */}
            <div className="mt-4 border-t border-white/10 pt-4">
              {staffUnlock ? (
                <>
                  <input
                    value={query}
                    onChange={(e) => search(e.target.value)}
                    placeholder="Staff: find someone by name, phone or email…"
                    autoComplete="off"
                    autoFocus
                    className="h-10 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30"
                  />
                  {(people.length > 0 || searching) && (
                    <ul className="mt-2 divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
                      {searching && !people.length && <li className="px-3 py-2 text-xs text-neutral-500">Searching…</li>}
                      {people.map((p) => (
                        <li key={`${p.person_type}:${p.id}`}>
                          <button
                            type="button"
                            onClick={() => {
                              touchStaff();
                              punch({ person_type: p.person_type, person_id: p.id, method: "manual", staff_unlock: staffUnlock.grant });
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/5"
                          >
                            <span className="text-sm text-white">
                              {p.name} <span className="text-xs text-neutral-500">{p.code}</span>
                            </span>
                            <span className="text-xs text-neutral-500">
                              {p.person_type}
                              {p.meta ? ` · ${p.meta}` : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
                    <span>Staff unlocked · locks after a minute idle</span>
                    <button type="button" onClick={lockStaff} className="rounded-md border border-white/15 px-2 py-1 font-semibold text-neutral-300 hover:bg-white/5">
                      Lock now
                    </button>
                  </div>
                </>
              ) : unlockPrompt ? (
                <form onSubmit={unlock}>
                  <p className="text-xs text-neutral-400">
                    Staff only: enter the password for {operator?.name || "this desk account"} to find someone by name or sign the kiosk out.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="password"
                      name="kiosk-staff-unlock"
                      // Not "current-password": a browser that saved the desk
                      // password must not offer it to whoever taps here.
                      autoComplete="new-password"
                      autoFocus
                      value={unlockPassword}
                      onChange={(e) => {
                        touchStaff();
                        setUnlockPassword(e.target.value);
                      }}
                      placeholder="Desk password"
                      className="h-10 flex-1 rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30"
                    />
                    <button type="submit" disabled={unlocking || !unlockPassword} className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-neutral-900 hover:opacity-90 disabled:opacity-40">
                      {unlocking ? "Checking…" : "Unlock"}
                    </button>
                    <button type="button" onClick={lockStaff} className="h-10 rounded-lg border border-white/15 px-3 text-sm text-neutral-300 hover:bg-white/5">
                      Cancel
                    </button>
                  </div>
                  {unlockError && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{unlockError}</p>}
                </form>
              ) : (
                <button type="button" onClick={openUnlock} className="text-xs font-medium text-neutral-500 hover:text-neutral-300">
                  Staff: find someone by name, or sign out…
                </button>
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
                {/* Amber for a word at the desk (running out, a balance owing),
                    red for a problem: an expiry a week away or money still to
                    collect must not look like a lapsed membership. */}
                {receipt.warning && (
                  <p
                    className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                      flash?.tone === "warn" ? "bg-amber-400/15 text-amber-300" : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {receipt.warning}
                  </p>
                )}
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
                {offline ? (
                  <>
                    <div className="mb-3 h-16 w-16 rounded-full border-2 border-rose-500/60" />
                    <p className="text-lg font-semibold text-rose-300">Not connected</p>
                    <p className="text-sm text-neutral-400">Please see the front desk to check in.</p>
                  </>
                ) : (
                  <>
                    <div className="mb-3 h-16 w-16 animate-pulse rounded-full border-2 border-emerald-500/40" />
                    <p className="text-lg font-semibold text-white">Ready</p>
                    <p className="text-sm text-neutral-500">Scan or type a member number to check in or out.</p>
                  </>
                )}
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
