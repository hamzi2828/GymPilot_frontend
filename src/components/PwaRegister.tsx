"use client";

// Registers the service worker that makes the site installable and receives
// push notifications. Nothing is cached beyond the offline page, so a deploy
// is never masked by a stale shell.

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* an old browser, or a private window that refuses workers */
    });
  }, []);
  return null;
}
