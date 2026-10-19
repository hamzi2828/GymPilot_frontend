"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_KEY = "default";

/**
 * Runs one action at a time for a button (or a group of buttons) and says
 * which one is running, so it can show a spinner and be disabled.
 *
 * - `run(fn, key?)` starts `fn` unless an action from this hook is already
 *   running: the guard is a ref, so a fast double-click cannot fire twice
 *   before React re-renders. It resolves to `fn`'s result (or `undefined`
 *   when it was skipped) and lets `fn`'s errors through.
 * - `busy` is true while anything runs; `busyKey` names it, for rows of
 *   buttons where only the clicked one should spin.
 * - `leave()`, called inside `fn` just before it sends the page away for
 *   good (to Stripe, say), keeps the button busy until the page goes. If the
 *   browser brings the page back from its back-forward cache, the button is
 *   usable again.
 */
export default function useAsyncAction() {
  const lockRef = useRef(false);
  const leavingRef = useRef(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      lockRef.current = false;
      leavingRef.current = false;
      setBusyKey(null);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const run = useCallback(async <T>(fn: () => Promise<T> | T, key: string = DEFAULT_KEY): Promise<T | undefined> => {
    if (lockRef.current) return undefined;
    lockRef.current = true;
    leavingRef.current = false;
    setBusyKey(key);
    try {
      return await fn();
    } finally {
      if (!leavingRef.current) {
        lockRef.current = false;
        setBusyKey(null);
      }
    }
  }, []);

  const leave = useCallback(() => {
    leavingRef.current = true;
  }, []);

  return { busy: busyKey !== null, busyKey, run, leave };
}
