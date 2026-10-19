"use client";

// Scan the desk code, send it, and say plainly what happened: green checked
// in, blue checked out, amber "already a moment ago", red for anything that
// was not recorded. Used by the /checkin page (variant "page", what a phone's
// camera app opens) and the member portal's Check in tab (variant "panel").

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CircleCheck, CircleX, Clock, Hourglass, LogOut, MonitorOff, ScanLine, TriangleAlert, WifiOff, type LucideIcon } from "lucide-react";
import DeskCodeScanner from "./DeskCodeScanner";
import { NOT_A_DESK_CODE, checkInWithDeskCode, newRequestId, readDeskCode, type CheckinOutcome, type CheckinReceipt } from "./deskCode";

// An attempt that got no answer may still have been recorded. Another
// attempt inside this window -- even with a fresh code, since the old one
// will have changed by then -- goes out under the same request_id, so the
// server answers with the punch it already has instead of taking the retry
// for a check-out (the kiosk's rule too).
const RETRY_SAME_ID_MS = 2 * 60 * 1000;

type Shown = Exclude<CheckinOutcome, { kind: "session_ended" } | { kind: "expired" }>;

type Phase =
  | { name: "idle" }
  // `again`: why a fresh scan is needed (the code changed), or null.
  | { name: "scanning"; again: string | null }
  | { name: "sending" }
  | { name: "result"; outcome: Shown; code: string | null };

const LOOK: Record<Shown["kind"], { icon: LucideIcon; panel: string; title: string }> = {
  checked_in: { icon: CircleCheck, panel: "bg-emerald-600 text-white", title: "Checked in" },
  checked_out: { icon: LogOut, panel: "bg-blue-600 text-white", title: "Checked out" },
  ignored: { icon: Clock, panel: "bg-amber-400 text-black", title: "Already checked in a moment ago" },
  refused: { icon: CircleX, panel: "bg-rose-600 text-white", title: "Entry refused" },
  invalid: { icon: ScanLine, panel: "bg-rose-600 text-white", title: "Not a check-in code" },
  desk_signed_out: { icon: MonitorOff, panel: "bg-rose-600 text-white", title: "Check-in screen signed out" },
  paused: { icon: Hourglass, panel: "bg-amber-400 text-black", title: "Please wait a moment" },
  offline: { icon: WifiOff, panel: "bg-rose-600 text-white", title: "Not connected" },
  failed: { icon: TriangleAlert, panel: "bg-rose-600 text-white", title: "Not checked in" },
};

const primaryBtn =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-base font-semibold text-[var(--on-accent)] hover:opacity-90 disabled:opacity-50 sm:w-auto";
const secondaryBtn =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 text-base font-semibold text-gray-800 hover:bg-gray-50 sm:w-auto";

function receiptOf(outcome: Shown): CheckinReceipt | null {
  return "detail" in outcome ? outcome.detail : null;
}

/** The line under the headline. */
function subline(outcome: Shown): string {
  const detail = receiptOf(outcome);
  switch (outcome.kind) {
    case "checked_in":
      return detail?.check_in_time ? `at ${detail.check_in_time}` : "";
    case "checked_out":
      return detail?.check_out_time ? `at ${detail.check_out_time}` : "";
    case "ignored":
      return "Nothing more to do: you're all set.";
    default:
      return outcome.message;
  }
}

function ResultView({
  outcome,
  variant,
  onScan,
  onRetry,
  onDone,
}: {
  outcome: Shown;
  variant: "page" | "panel";
  onScan: () => void;
  onRetry: (() => void) | null;
  onDone: () => void;
}) {
  const look = LOOK[outcome.kind];
  const Icon = look.icon;
  const detail = receiptOf(outcome);
  const recorded = outcome.kind === "checked_in" || outcome.kind === "checked_out" || outcome.kind === "ignored";
  // The server's own words for an ignored punch say whether it was the
  // check-in or the check-out that just happened.
  const title = outcome.kind === "ignored" && outcome.message ? outcome.message.replace(/\.$/, "") : look.title;
  // The receipt's `warning` is written for the desk ("EXPIRES IN 3 DAYS — offer
  // a renewal"), so a member is shown only what they can act on: money owed.
  const owed = recorded && detail?.balance_due_label ? `${detail.balance_due_label} — please pay at the front desk.` : null;
  // The server's sentence on a recorded punch ("Welcome back"), when it adds
  // something to the headline.
  const extra =
    (outcome.kind === "checked_in" || outcome.kind === "checked_out") && outcome.message && !/^checked (in|out)\b/i.test(outcome.message) ? outcome.message : "";

  return (
    <div>
      <div role="status" aria-live="polite" className={`rounded-3xl px-5 py-8 text-center shadow-sm ${look.panel}`}>
        <Icon className="mx-auto h-16 w-16" strokeWidth={1.8} aria-hidden="true" />
        <h1 className="mt-4 break-words text-3xl font-bold leading-tight">{title}</h1>
        {recorded && detail?.person_name && <p className="mt-2 break-words text-xl font-semibold">{detail.person_name}</p>}
        {subline(outcome) && <p className="mt-2 break-words text-base opacity-90">{subline(outcome)}</p>}
        {extra && <p className="mt-1 break-words text-sm opacity-90">{extra}</p>}
      </div>

      {owed && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{owed}</p>}

      {recorded && detail?.rows && detail.rows.length > 0 && (
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm">
          {detail.rows.map((row) => (
            <React.Fragment key={row.caption}>
              <dt className="text-gray-500">{row.caption}</dt>
              <dd className="break-words text-right font-medium text-gray-900">{row.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {onRetry && (
          <button type="button" onClick={onRetry} className={primaryBtn}>
            Try again
          </button>
        )}
        {recorded ? (
          <>
            {variant === "page" ? (
              <Link href="/user-detail?tab=visits" className={primaryBtn}>
                See my visits
              </Link>
            ) : (
              <button type="button" onClick={onDone} className={primaryBtn}>
                Done
              </button>
            )}
            <button type="button" onClick={onScan} className={secondaryBtn}>
              <Camera className="h-5 w-5" aria-hidden="true" />
              Scan again
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onScan} className={onRetry ? secondaryBtn : primaryBtn}>
              <Camera className="h-5 w-5" aria-hidden="true" />
              Scan again
            </button>
            {variant === "panel" && (
              <button type="button" onClick={onDone} className={secondaryBtn}>
                Close
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export interface CheckinFlowProps {
  variant: "page" | "panel";
  /** The `c` the page was opened with: sent straight away. Null or absent: none. */
  initialCode?: string | null;
  /** The API says the session is over; `code` is the one in hand, if any. */
  onSessionEnded: (code: string | null) => void;
  /** A check-in or check-out was recorded. */
  onRecorded?: () => void;
}

export default function CheckinFlow({ variant, initialCode = null, onSessionEnded, onRecorded }: CheckinFlowProps) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const unansweredRef = useRef<{ requestId: string; since: number } | null>(null);
  const busyRef = useRef(false);
  const startedRef = useRef(false);

  const send = useCallback(
    async (code: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      const last = unansweredRef.current;
      const requestId = last && Date.now() - last.since < RETRY_SAME_ID_MS ? last.requestId : newRequestId();
      setPhase({ name: "sending" });
      try {
        const outcome = await checkInWithDeskCode(code, requestId);
        // The window runs from the first attempt that got no answer.
        if (outcome.kind === "offline") {
          if (!(last && last.requestId === requestId)) unansweredRef.current = { requestId, since: Date.now() };
        } else {
          unansweredRef.current = null;
        }
        if (outcome.kind === "session_ended") {
          onSessionEnded(code);
          return;
        }
        if (outcome.kind === "expired") {
          // Nothing wrong: the screen has moved on to a new code, as it does
          // every few seconds (and always will have, after a sign-in).
          setPhase({ name: "scanning", again: outcome.message });
          return;
        }
        setPhase({ name: "result", outcome, code });
        if (outcome.kind === "checked_in" || outcome.kind === "checked_out") onRecorded?.();
      } finally {
        busyRef.current = false;
      }
    },
    [onSessionEnded, onRecorded]
  );

  // The code the page was opened with, once. A ref rather than state, so the
  // development double-run of effects does not send it twice.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (initialCode === null) return;
    const code = readDeskCode(initialCode);
    if (code) send(code);
    else setPhase({ name: "result", outcome: { kind: "invalid", message: NOT_A_DESK_CODE }, code: null });
  }, [initialCode, send]);

  const scan = () => setPhase({ name: "scanning", again: null });
  const idle = () => setPhase({ name: "idle" });

  if (phase.name === "sending") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center" role="status">
        <span className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--accent)]" aria-hidden="true" />
        <p className="text-lg font-semibold text-gray-900">Checking you in…</p>
      </div>
    );
  }

  if (phase.name === "result") {
    const { outcome, code } = phase;
    return (
      <ResultView
        outcome={outcome}
        variant={variant}
        onScan={scan}
        onRetry={outcome.kind === "offline" && code ? () => send(code) : null}
        onDone={idle}
      />
    );
  }

  if (phase.name === "scanning") {
    return (
      <div>
        <h2 className="text-center text-2xl font-bold text-gray-900">{phase.again ? "Scan the code on the screen again" : "Scan the desk code"}</h2>
        {phase.again && <p className="mx-auto mt-2 max-w-sm text-center text-sm text-gray-600">{phase.again}</p>}
        <div className="mt-5">
          <DeskCodeScanner onCode={send} />
        </div>
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={idle} className={secondaryBtn}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={variant === "page" ? "text-center" : ""}>
      {variant === "page" ? (
        <>
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--on-accent)]">
            <ScanLine className="h-8 w-8" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-3xl font-bold text-gray-900">Check in</h1>
          <p className="mx-auto mt-2 max-w-sm text-base text-gray-600">Scan the code on the screen at the front desk to check in, and again on your way out to check out.</p>
        </>
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Check in at the door</p>
          <h2 className="mt-1 text-2xl font-bold text-black">Scan the desk code</h2>
          <p className="mt-2 max-w-xl text-sm text-gray-600">
            The screen at the front desk shows a check-in code that changes every few seconds. Scan it with your phone to check in, and again on your way
            out to check out.
          </p>
        </>
      )}
      <div className={`mt-6 flex ${variant === "page" ? "justify-center" : ""}`}>
        <button type="button" onClick={scan} className={primaryBtn}>
          <Camera className="h-5 w-5" aria-hidden="true" />
          Scan the desk code
        </button>
      </div>
      <p className={`mt-4 text-sm text-gray-500 ${variant === "page" ? "mx-auto max-w-sm" : "max-w-xl"}`}>
        Your phone&apos;s camera app works too: point it at the screen and open the link.
      </p>
    </div>
  );
}
