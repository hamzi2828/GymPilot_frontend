"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// A slim bar along the top of the screen, in the gym's colour, while the app
// moves to another page. It starts when a link to another page of the site is
// clicked (or when code calls startNavigationProgress() before router.push)
// and finishes once the new address has rendered. Quick moves never show it.

const START_EVENT = "gp:navigation-start";
const SHOW_AFTER_MS = 120;
// Never left running if a navigation is cancelled or goes nowhere.
const GIVE_UP_MS = 12000;

export function startNavigationProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(START_EVENT));
}

function isPageLink(e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const target = e.target as Element | null;
  const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.hasAttribute("download")) return false;
  if (a.target && a.target !== "_self") return false;
  let url: URL;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  // The same page, or only a #section of it.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

type Timers = { show?: number; trickle?: number; giveUp?: number; hide?: number };

function clearTimers(t: Timers) {
  window.clearTimeout(t.show);
  window.clearInterval(t.trickle);
  window.clearTimeout(t.giveUp);
  window.clearTimeout(t.hide);
}

function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const activeRef = useRef(false);
  const timers = useRef<Timers>({});

  const done = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    const wasShown = timers.current.trickle !== undefined;
    clearTimers(timers.current);
    timers.current = {};
    if (!wasShown) {
      setVisible(false);
      setWidth(0);
      return;
    }
    setWidth(100);
    timers.current.hide = window.setTimeout(() => {
      setVisible(false);
      timers.current.hide = window.setTimeout(() => setWidth(0), 300);
    }, 200);
  }, []);

  const start = useCallback(() => {
    if (activeRef.current) return;
    clearTimers(timers.current);
    timers.current = {};
    activeRef.current = true;
    setWidth(0);
    timers.current.show = window.setTimeout(() => {
      setVisible(true);
      setWidth(12);
      // Creeps towards 90% and waits there for the page.
      timers.current.trickle = window.setInterval(() => {
        setWidth((w) => w + (90 - w) * 0.12);
      }, 250);
    }, SHOW_AFTER_MS);
    timers.current.giveUp = window.setTimeout(done, GIVE_UP_MS);
  }, [done]);

  // The new address has rendered.
  useEffect(() => {
    done();
  }, [pathname, searchParams, done]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isPageLink(e)) start();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) done();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, start);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, start);
      window.removeEventListener("pageshow", onPageShow);
      clearTimers(timers.current);
    };
  }, [start, done]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] transition-opacity duration-300 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className="h-full origin-left transition-[width] duration-200 ease-out motion-reduce:transition-none"
        style={{
          width: `${width}%`,
          background: "var(--accent, #ff6b2c)",
          boxShadow: "0 0 8px color-mix(in srgb, var(--accent, #ff6b2c) 60%, transparent)",
        }}
      />
    </div>
  );
}

export default function NavigationProgress() {
  // useSearchParams needs a Suspense boundary so pages can still prerender.
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
