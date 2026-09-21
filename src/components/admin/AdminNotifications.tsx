"use client";

// The bell in the admin header: how many things are waiting for somebody to
// act on them -- unconfirmed bank transfers, failed card payments, new
// enquiries, leads due a call, leave to decide -- each linking to the page
// where it is done. The backend (GET /admin/notifications, GymPilot_backend
// src/controller/adminNotificationsController.js) counts only what this
// account's role can open and leaves out anything at zero.
//
// Read when the panel loads, whenever the bell is opened, and every couple of
// minutes while the browser tab is in view -- a tab left in the background
// asks nothing until it is looked at again.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiBell } from "react-icons/fi";
import { API_BASE, apiGet, isSessionEndError } from "@/app/(routes)/admin/_shared/api";

interface NotificationItem {
  key: string;
  label: string;
  count: number;
  href: string;
}

const REFRESH_MS = 2 * 60 * 1000;

export default function AdminNotifications() {
  const pathname = usePathname();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const lastLoad = useRef(0);
  const panelId = useId();

  const load = useCallback(async () => {
    // Opening the bell while the timer's read is still out needs no second one.
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await apiGet<{ data?: NotificationItem[] }>(`${API_BASE}/admin/notifications`);
      setItems(res.data || []);
      setError(null);
    } catch (e) {
      // An ended session is already on its way to the sign-in page.
      if (!isSessionEndError(e)) setError(e instanceof Error ? e.message : "Could not load notifications.");
    } finally {
      inFlight.current = false;
      lastLoad.current = Date.now();
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const visible = () => document.visibilityState === "visible";
    const timer = window.setInterval(() => {
      if (visible()) load();
    }, REFRESH_MS);
    // Back in view after a while away: catch up now rather than at the next tick.
    const onVisibility = () => {
      if (visible() && Date.now() - lastLoad.current >= REFRESH_MS) load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const toggle = () => {
    if (!open) load();
    setOpen((v) => !v);
  };

  const total = items.reduce((sum, item) => sum + item.count, 0);
  const badge = total > 99 ? "99+" : String(total);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={total ? `Notifications: ${total} waiting` : "Notifications"}
        title="Notifications"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
      >
        <FiBell className="h-[18px] w-[18px]" aria-hidden="true" />
        {total > 0 && (
          <span
            className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white"
            aria-hidden="true"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg shadow-neutral-900/10"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Needs attention</p>
            {loading && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-200 border-t-[var(--accent)]" aria-hidden="true" />
            )}
          </div>

          {error && !items.length ? (
            <div role="alert" className="px-4 py-6 text-center">
              <p className="text-[13px] text-rose-700">{error}</p>
              <button
                type="button"
                onClick={load}
                className="mt-2 text-xs font-semibold text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
              >
                Try again
              </button>
            </div>
          ) : !loaded ? (
            <p className="px-4 py-6 text-center text-[13px] text-neutral-400">Loading…</p>
          ) : !items.length ? (
            <p className="px-4 py-6 text-center text-[13px] text-neutral-500">You&apos;re all caught up.</p>
          ) : (
            <ul className="admin-scroll max-h-[min(24rem,70vh)] overflow-y-auto py-1">
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] text-neutral-700 transition-colors hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-800">{item.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
