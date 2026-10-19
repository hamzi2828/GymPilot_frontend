"use client";

// The web check-in screen: a tablet or any PC at the door, no fingerprint
// reader needed. Staff sign in once with an account that has "Allow
// attendance app"; the screen then shows a check-in QR code that changes
// every few seconds. Members scan it with their signed-in phone -- the
// GymsPilotPro app, or the phone's camera, which opens the gym website's
// /checkin page -- and are checked in or out there, on their own phone.
//
// The code is fetched from the same /api/desktop endpoints the Windows
// front-desk app uses, and a phone that scans it is recorded against this
// screen's desk, so the two record identical attendance rows.
//
// The screen faces the public, so finding someone by name -- a list with
// phone numbers and emails -- checking them in by hand (the staff backup for
// a member without a phone), and signing the kiosk out are behind a "Staff"
// unlock: the desk account's password typed again. The server holds the
// kiosk to that too (kioskStaffOnly in the backend's desktopAuth), and the
// kiosk locks itself again after a minute without a tap.

import React, { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useSiteSettings } from "@/components/ThemeProvider";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const TOKEN_KEY = "kiosk_token";
const CLIENT_APP = "GymPilotKiosk/1.0";
const RECEIPT_SECONDS = 8;
// A staff unlock lasts while someone is using it. The server's own ceiling
// on one unlock is longer; this is what keeps it from being left open.
const STAFF_IDLE_MS = 60 * 1000;
const STAFF_UNLOCK_REQUIRED = "STAFF_UNLOCK_REQUIRED";
// A punch that got no answer may still have been recorded. The same person
// trying again inside this window goes out under the same request_id, so the
// server answers with the punch it already has instead of taking the retry
// for a check-out (punchService.repeatedPunch in the backend).
const PUNCH_REPEAT_MS = 2 * 60 * 1000;
// How often the kiosk asks the server "are you there": every half minute
// while all is well, so a dropped connection is noticed before the next
// member walks up, and every few seconds while it is down, so it comes back
// by itself.
const HEARTBEAT_MS = 30 * 1000;
const RECONNECT_MS = 5 * 1000;
const NOT_CONNECTED = "Not connected. Check the internet connection and try again.";

// The check-in code. The server says how long one lasts and when to ask for
// the next (60 s and 20 s today); these are the fallbacks for an answer that
// leaves them out. A code is taken off the screen a few seconds before it
// runs out, so a phone never scans one that has already stopped working.
const CODE_REFRESH_S = 20;
const CODE_VALID_S = 60;
const CODE_SAFETY_MS = 5 * 1000;
// After a refusal that is not a dropped connection (an API without the
// endpoint yet, a server error): try again, but not every few seconds.
const CODE_RETRY_MS = 15 * 1000;
const CODE_UNAVAILABLE = "Check-in code unavailable — use fingerprint or face at the desk";

interface ReceiptRow { caption: string; value: string }
// Which sound a member's punch gets and what to say after it -- decided by the
// server (punchService.memberAlert), so this kiosk and the Windows desk agree.
// Null for staff and for a repeat scan.
interface PunchAlert { level: "ok" | "warning" | "problem"; speech: string | null }
interface Receipt {
  // "refused": the gym's entry rules turned this member away; nothing was recorded.
  // "ignore": they were checked in or out a moment ago; nothing new was recorded.
  action: "check_in" | "check_out" | "refused" | "ignore";
  refused?: boolean;
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

// POST /api/desktop/checkin-code.
interface DeskCodeData {
  code: string;
  expires_at?: string;
  valid_seconds?: number;
  refresh_after_seconds?: number;
  checkin_path?: string;
}

// The code on screen, and the clock it runs on -- this kiosk's own, counted
// from when it arrived, so a kiosk whose clock is a minute out still shows
// the right countdown.
interface ShownCode {
  image: string;
  fetchedAt: number;
  refreshMs: number;
  validUntil: number;
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

type DeskAnswer<T> = T & { success: boolean; message?: string; code?: string; http_status?: number; offline?: boolean; refused?: boolean; ignored?: boolean };

// An id for one punch attempt: 8-100 letters, digits, hyphens or underscores.
function newRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* not a secure context: fall through */
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

// Never throws. A request that got no answer -- the network is down, or the
// proxy in front of the API answered for it (502/503/504) -- comes back as
// `offline`, which every caller checks: it used to be an unhandled rejection,
// so a punch with the network down did nothing at all, no message, no sound.
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

/** The server's number of seconds, within sane bounds, or the fallback. */
function seconds(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : fallback;
}

type Tone = "good" | "warn" | "bad";
// "info": nothing went wrong and nothing new was recorded (a repeat punch).
type FlashTone = Tone | "info";

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

const RECEIPT_CAPTION: Record<Receipt["action"], string> = {
  check_in: "Checked in",
  check_out: "Checked out",
  refused: "Entry refused",
  ignore: "Already recorded",
};

export default function KioskPage() {
  const { siteName } = useSiteSettings();
  const [token, setToken] = useState<string | null>(null);
  const [operator, setOperator] = useState<{ name: string; location?: string } | null>(null);
  const [booting, setBooting] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const loginAction = useAsyncAction();
  const loggingIn = loginAction.busy;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [flash, setFlash] = useState<{ tone: FlashTone; text: string } | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [dateLabel, setDateLabel] = useState("");

  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  // The staff unlock: the signed grant the server handed back, sent with
  // every people search and hand-picked punch until the kiosk locks again.
  const [staffUnlock, setStaffUnlock] = useState<{ grant: string; expiresAt: number } | null>(null);
  const [unlockPrompt, setUnlockPrompt] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const unlockAction = useAsyncAction();
  const unlocking = unlockAction.busy;
  // A hand-picked punch: one at a time, so a double tap is never a check-in
  // followed by a check-out.
  const punchAction = useAsyncAction();
  const signOutAction = useAsyncAction();
  const staffActivityRef = useRef(0);

  // The check-in code on screen, and why there is none when there is none.
  const [shownCode, setShownCode] = useState<ShownCode | null>(null);
  const [codeTrouble, setCodeTrouble] = useState<string | null>(null);
  // A clock for the countdown; ticks only while a code is up.
  const [now, setNow] = useState(() => Date.now());

  const receiptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last punch the server never answered: who it was for and its id.
  const unansweredRef = useRef<{ who: string; id: string; since: number } | null>(null);

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
        } else if (res.http_status === 401 || res.http_status === 403) {
          // The server refused this desk's sign-in itself: back to the form.
          localStorage.removeItem(TOKEN_KEY);
        } else {
          // A server error or a rate limit says nothing about the sign-in,
          // as on the heartbeat: the kiosk keeps it, and the heartbeat asks
          // again and fills in the account once the server answers.
          setToken(saved);
        }
      })
      .finally(() => setBooting(false));
  }, [loadRecent, markOffline]);

  const showReceipt = (r: Receipt | null, message: { tone: FlashTone; text: string } | null) => {
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
      setShownCode(null);
      setCodeTrouble(null);
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

  // The check-in code: fetched at once, then again whenever the server says
  // to (every 20 s), and straight away when the screen is looked at again
  // after the browser held its timers back. A failed fetch leaves the last
  // code up for as long as it still works, and keeps trying. Phones check in
  // on their own screen, so "Today" is refreshed alongside: that is how a
  // phone's check-in reaches this one.
  useEffect(() => {
    if (!token) return;
    const deskToken = token;
    let stopped = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let nextAt = 0;

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      nextAt = Date.now() + ms;
      timer = setTimeout(run, ms);
    };

    async function run() {
      if (stopped || busy) return;
      busy = true;
      try {
        const res = await desk<{ data?: DeskCodeData }>("checkin-code", {}, deskToken);
        if (stopped) return;
        if (res.offline) {
          markOffline();
          setCodeTrouble(NOT_CONNECTED);
          schedule(RECONNECT_MS);
          return;
        }
        markOnline();
        if (res.http_status === 401 || res.http_status === 403) {
          endSession(res.message);
          return;
        }
        const data = res.data;
        if (!res.success || !data || typeof data.code !== "string" || !data.code) {
          setCodeTrouble(res.message || "The server did not send a code.");
          schedule(CODE_RETRY_MS);
          return;
        }
        const path = typeof data.checkin_path === "string" && data.checkin_path.startsWith("/") && !data.checkin_path.startsWith("//") ? data.checkin_path : "/checkin";
        const url = `${window.location.origin}${path}?c=${encodeURIComponent(data.code)}`;
        const image = await QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: "M" });
        if (stopped) return;
        const refreshMs = seconds(data.refresh_after_seconds, CODE_REFRESH_S, 5, 120) * 1000;
        const validMs = seconds(data.valid_seconds, CODE_VALID_S, 10, 600) * 1000;
        const at = Date.now();
        setShownCode({ image, fetchedAt: at, refreshMs, validUntil: at + Math.max(refreshMs, validMs - CODE_SAFETY_MS) });
        setNow(at);
        setCodeTrouble(null);
        schedule(refreshMs);
        loadRecent(deskToken);
      } catch {
        // Only the QR drawing can throw here; the request itself never does.
        if (!stopped) {
          setCodeTrouble("The code could not be drawn.");
          schedule(CODE_RETRY_MS);
        }
      } finally {
        busy = false;
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() >= nextAt) run();
    };

    run();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", run);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", run);
    };
  }, [token, markOffline, markOnline, endSession, loadRecent]);

  // The countdown under the code.
  useEffect(() => {
    if (!shownCode) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [shownCode]);

  // A check-in screen that goes to sleep checks nobody in: the screen is
  // kept on while the kiosk is signed in, where the browser allows it. The
  // browser lets go of the lock whenever the tab is hidden, so it is taken
  // again on the way back.
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let sentinel: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
        if (sentinel && !sentinel.released) return;
        const lock = await navigator.wakeLock.request("screen");
        if (stopped) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
      } catch {
        /* refused (battery saver, no permission): the screen's own sleep setting applies */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (sentinel) sentinel.release().catch(() => {});
    };
  }, [token]);

  // The staff backup: a person picked by name, after the unlock.
  const punch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!token) return;
      // Whose punch this is: the person picked. A retry for the same one
      // inside the window reuses the unanswered punch's id; anyone else is new.
      const who = JSON.stringify([body.person_type || "", body.person_id || ""]);
      const last = unansweredRef.current;
      const requestId = last && last.who === who && Date.now() - last.since < PUNCH_REPEAT_MS ? last.id : newRequestId();
      const res = await desk<{ detail: Receipt | null }>("punch", { ...body, request_id: requestId }, token);
      // No word on whether it was recorded: nothing came back, or the server
      // itself failed. The window runs from the first unanswered attempt.
      if (res.offline || (res.http_status ?? 0) >= 500) {
        if (!(last && last.id === requestId)) unansweredRef.current = { who, id: requestId, since: Date.now() };
      } else {
        unansweredRef.current = null;
      }
      if (res.offline) {
        // Said out loud and in red: the person at the door must not walk in
        // believing they were checked in. The search is kept, to pick them
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
      if (res.ignored) {
        // Checked in (or out) a moment ago -- a double tap, or the member's
        // own phone got there first. Nothing new was recorded and nothing is
        // wrong: neutral, with no sound.
        showReceipt(res.detail, { tone: "info", text: res.message || "Already recorded a moment ago." });
      } else if (res.refused && res.detail) {
        // Turned away under the gym's entry rules: nothing was recorded. Red,
        // the problem tune, and the gym's words if it has any for this.
        beep("bad");
        const said = res.detail.alert?.speech;
        if (said) speechTimer.current = setTimeout(() => speak(said), TONE_MS);
        showReceipt(res.detail, { tone: "bad", text: res.message || "Entry refused. Please see the front desk." });
      } else if (res.success && res.detail) {
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
      setQuery("");
      setPeople([]);
    },
    [token, loadRecent, endSession, lockStaff, markOffline, markOnline]
  );

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    loginAction.run(async () => {
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
      }
    });
  };

  const logout = () =>
    signOutAction.run(async () => {
      if (token) await desk("logout", {}, token).catch(() => {});
      lockStaff();
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setOperator(null);
      setShownCode(null);
      setCodeTrouble(null);
    });

  const openUnlock = () => {
    touchStaff();
    setUnlockError(null);
    setUnlockPrompt(true);
  };

  // The desk account's password again. A wrong one is a 400 from the
  // server, not a 401 -- the kiosk stays signed in either way.
  const unlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !unlockPassword) return;
    touchStaff();
    unlockAction.run(async () => {
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
      }
    });
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">GymsPilotPro</p>
          <h1 className="mt-1 text-xl font-semibold text-white">Check-in screen</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Sign in with a staff account that is allowed to use the attendance app. The screen then shows the code members scan with their phone.
          </p>
          <label className="mt-6 block">
            <span className="text-xs font-semibold text-neutral-300">Email or username</span>
            <input type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30" />
          </label>
          <label className="mt-4 block">
            <span className="text-xs font-semibold text-neutral-300">Password</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-white/30" />
          </label>
          {loginError && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{loginError}</p>}
          <button type="submit" disabled={loggingIn} aria-busy={loggingIn || undefined} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-neutral-900 hover:opacity-90 disabled:opacity-50">
            {loggingIn && <Spinner />}
            {loggingIn ? "Signing in…" : "Start check-in screen"}
          </button>
        </form>
      </main>
    );
  }

  const flashCls =
    flash?.tone === "bad"
      ? "bg-rose-600"
      : flash?.tone === "warn"
      ? "bg-amber-500 text-black"
      : flash?.tone === "info"
      ? "bg-neutral-700"
      : "bg-emerald-600";
  // The warning line on a receipt: amber for a word at the desk, red for a
  // problem. A repeat punch carries no verdict of its own, so its status says.
  const warningTone = flash?.tone === "info" && receipt ? tone(receipt.status || "") : flash?.tone;

  // The code on screen, while it still works.
  const live = shownCode && now < shownCode.validUntil ? shownCode : null;
  const refreshAt = live ? live.fetchedAt + live.refreshMs : 0;
  const secondsLeft = live ? Math.max(0, Math.ceil((refreshAt - now) / 1000)) : 0;
  const progress = live ? Math.max(0, Math.min(1, (refreshAt - now) / live.refreshMs)) : 0;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {siteName ? `${siteName} · check-in` : "GymsPilotPro check-in"}
          </p>
          <p className="truncate text-sm text-neutral-300">
            {operator?.name}
            {operator?.location ? ` · ${operator.location}` : ""}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </p>
        </div>
        {/* Staff only, like the search: a member at the screen must not be
            able to take the kiosk off its desk account. */}
        {staffUnlock && (
          <button type="button" onClick={logout} disabled={signOutAction.busy} aria-busy={signOutAction.busy || undefined} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white disabled:opacity-50">
            {signOutAction.busy && <Spinner />}
            Sign out
          </button>
        )}
      </header>

      {/* Nothing is being recorded while this shows, so it is not subtle. It
          clears by itself when the server answers again. */}
      {offline && (
        <div role="alert" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-rose-600 px-6 py-3 text-center text-white">
          <span className="text-base font-bold">Not connected</span>
          <span className="text-sm">Check-ins are not being recorded. Check the internet connection. The screen reconnects by itself.</span>
        </div>
      )}

      <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Left: the check-in code, and the staff backup under it */}
        <section className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900">
            {/* The gym's colour, so the screen reads as the gym's own. */}
            <div className="h-1.5 bg-[var(--accent)]" aria-hidden="true" />
            <div className="flex flex-col items-center px-6 pb-7 pt-6 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">{siteName || "Check in"}</p>
              <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">Check in with your phone</h1>
              <p className="mt-2 max-w-md text-base text-neutral-300">Scan with the GymsPilotPro app or your phone camera</p>

              <div className="mt-6 w-full max-w-[min(60vh,440px)]">
                {live ? (
                  <div className="rounded-3xl bg-white p-3 shadow-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={live.image} alt="Check-in code: scan it with your phone" width={720} height={720} className="block aspect-square h-auto w-full" />
                  </div>
                ) : codeTrouble ? (
                  <div role="alert" className="flex aspect-square w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-rose-500/50 bg-rose-500/5 px-6 text-center">
                    <p className="text-lg font-semibold text-rose-200">{CODE_UNAVAILABLE}</p>
                    <p className="mt-2 text-sm text-neutral-400">{codeTrouble}</p>
                    <p className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                      <span className="h-3 w-3 animate-spin rounded-full border border-neutral-600 border-t-neutral-300" aria-hidden="true" />
                      Trying again…
                    </p>
                  </div>
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-3xl bg-white/5">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-white" aria-label="Loading the check-in code" />
                  </div>
                )}
              </div>

              {live && (
                <div className="mt-5 w-full max-w-[min(60vh,440px)]">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                    <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-neutral-500" aria-live="off">
                    {codeTrouble
                      ? `Reconnecting… this code works for ${Math.max(0, Math.ceil((live.validUntil - now) / 1000))} s more`
                      : secondsLeft > 0
                      ? `New code in ${secondsLeft} s`
                      : "Getting a new code…"}
                  </p>
                </div>
              )}

              <p className="mt-5 max-w-md text-sm text-neutral-500">
                Not signed in on your phone? Scanning opens the gym website: sign in there, then scan again. No phone with you? Ask a member of staff.
              </p>
            </div>
          </div>

          {/* Staff only. Locked, this is one quiet button: nothing a member
              can use to list other members or check them in. */}
          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
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
                          disabled={punchAction.busy}
                          aria-busy={punchAction.busyKey === `${p.person_type}:${p.id}` || undefined}
                          onClick={() => {
                            touchStaff();
                            punchAction.run(
                              () => punch({ person_type: p.person_type, person_id: p.id, method: "manual", staff_unlock: staffUnlock.grant }),
                              `${p.person_type}:${p.id}`
                            );
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
                        >
                          <span className="text-sm text-white">
                            {punchAction.busyKey === `${p.person_type}:${p.id}` && <Spinner className="mr-2" />}
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
                  Staff only: enter the password for {operator?.name || "this desk account"} to check someone in by name or sign the screen out.
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
                  <button type="submit" disabled={unlocking || !unlockPassword} aria-busy={unlocking || undefined} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-neutral-900 hover:opacity-90 disabled:opacity-40">
                    {unlocking && <Spinner />}
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
                Staff: check someone in by name, or sign out…
              </button>
            )}
          </div>
        </section>

        {/* Right: receipt + today */}
        <section className="space-y-5">
          <div className={`min-h-[260px] rounded-2xl border border-white/10 p-5 transition-colors ${receipt ? "bg-neutral-900" : "bg-neutral-900/50"}`}>
            {flash && <div className={`mb-4 rounded-lg px-4 py-2 text-sm font-semibold text-white ${flashCls}`}>{flash.text}</div>}
            {receipt ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{RECEIPT_CAPTION[receipt.action] || "Recorded"}</p>
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
                      warningTone === "warn" ? "bg-amber-400/15 text-amber-300" : "bg-rose-500/15 text-rose-300"
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
                    <p className="max-w-xs text-sm text-neutral-500">Scan the code with your phone to check in or out. Your phone shows the result.</p>
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
