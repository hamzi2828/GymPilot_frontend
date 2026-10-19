"use client";

// The phone's back camera, reading the check-in code on the front-desk
// screen. QR codes only, and only a desk code is taken: anything else (a
// menu, a payment code) gets a word under the picture and scanning carries
// on. The camera is switched off the moment a code is read, and whenever
// this leaves the page.

import { useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { NOT_A_DESK_CODE, readDeskCode } from "./deskCode";

// How long the "not a check-in code" line waits before it may say it again,
// so a foreign code held in view does not flicker the message.
const WRONG_CODE_PAUSE_MS = 2500;

function cameraProblem(e: unknown): string {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e || "");
  if (/insecure/i.test(text)) return "The camera only works when this page is opened over https.";
  if (/NotAllowed|Permission|denied/i.test(text)) return "Camera access is blocked. Allow the camera for this site in your browser settings, then tap Try again.";
  if (/NotFound|DevicesNotFound|Requested device not found|no camera/i.test(text)) return "No camera was found on this device.";
  if (/NotReadable|TrackStart|in use|Could not start video/i.test(text)) return "The camera is busy in another app. Close it, then tap Try again.";
  return "The camera could not start. Tap Try again, or open your phone's camera app and point it at the screen.";
}

async function stopScanner(scanner: Html5Qrcode) {
  try {
    if (scanner.isScanning) await scanner.stop();
  } catch {
    /* already stopping or stopped */
  }
  try {
    scanner.clear();
  } catch {
    /* nothing left to clear */
  }
}

export interface DeskCodeScannerProps {
  /** A desk code was read; the camera is already off. */
  onCode: (code: string) => void;
}

export default function DeskCodeScanner({ onCode }: DeskCodeScannerProps) {
  // html5-qrcode finds its element by id; useId's colons are dropped to keep
  // it a plain one.
  const elementId = `desk-code-scanner-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [state, setState] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [wrongCode, setWrongCode] = useState(false);
  // Bumped by "Try again" to start the camera afresh.
  const [attempt, setAttempt] = useState(0);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let cancelled = false;
    let started = false;
    let read = false;
    let lastWrong = 0;
    let scanner: Html5Qrcode | null = null;
    let stopping: Promise<void> | null = null;
    const halt = () => {
      if (!scanner) return Promise.resolve();
      if (!stopping) stopping = stopScanner(scanner);
      return stopping;
    };

    setState("starting");
    setError(null);
    setWrongCode(false);

    (async () => {
      try {
        if (!window.isSecureContext) throw new Error("insecure");
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode(elementId, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            // Most of the picture: the desk code is big, and a phone held at
            // arm's length should not have to be lined up exactly.
            qrbox: (width, height) => {
              const side = Math.max(50, Math.floor(Math.min(width, height) * 0.8));
              return { width: side, height: side };
            },
            aspectRatio: 1,
          },
          (text) => {
            if (read || cancelled) return;
            const code = readDeskCode(text);
            if (!code) {
              const now = Date.now();
              if (now - lastWrong > WRONG_CODE_PAUSE_MS) {
                lastWrong = now;
                setWrongCode(true);
              }
              return;
            }
            read = true;
            halt().finally(() => {
              if (!cancelled) onCodeRef.current(code);
            });
          },
          () => {
            /* no code in this frame */
          }
        );
        started = true;
        if (cancelled) {
          halt();
          return;
        }
        setState("scanning");
      } catch (e) {
        if (scanner) {
          try {
            scanner.clear();
          } catch {
            /* nothing drawn */
          }
        }
        if (cancelled) return;
        setError(cameraProblem(e));
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      // Not yet started: the start above sees `cancelled` and stops it.
      if (started) halt();
    };
  }, [elementId, attempt]);

  return (
    <div>
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-black">
        {/* html5-qrcode draws the video in here; React leaves it alone. */}
        <div id={elementId} className="min-h-[260px] w-full [&_video]:block [&_video]:w-full [&_video]:object-cover" />
        {state === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-white/80">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
            Starting the camera…
          </div>
        )}
        {state === "error" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-900 px-6 text-center">
            <p className="text-sm text-white">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:opacity-90"
            >
              Try again
            </button>
          </div>
        )}
      </div>
      {wrongCode && state === "scanning" ? (
        <p role="status" className="mx-auto mt-3 max-w-sm text-center text-sm font-medium text-amber-700">
          {NOT_A_DESK_CODE}
        </p>
      ) : (
        <p className="mx-auto mt-3 max-w-sm text-center text-sm text-gray-500">Point your camera at the code on the screen at the front desk.</p>
      )}
    </div>
  );
}
