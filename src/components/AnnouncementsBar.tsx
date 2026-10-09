"use client";

// The gym's live announcements, as a bar above the site. Visitors see the
// public ones; a signed-in member also sees the members-only ones. Each can
// be dismissed for the session.
//
// The bar is part of the page, above the header: the header sits under it and
// the bar scrolls away with the page (see `.site-header` in globals.css).

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getAuthHeader } from "@/helper/helper";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const DISMISSED_KEY = "dismissed_announcements";

interface Announcement {
  id: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning";
  url: string;
  url_label: string;
}

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

const TONE: Record<Announcement["tone"], string> = {
  info: "bg-neutral-900 text-white",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-400 text-neutral-900",
};

export default function AnnouncementsBar() {
  const pathname = usePathname();
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(readDismissed());
    if (!API_BASE) return;
    let cancelled = false;
    fetch(`${API_BASE}/announcements/active`, { headers: getAuthHeader(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        if (!cancelled) setItems(json?.data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Re-checked on navigation so signing in picks up the members-only ones.
  }, [pathname]);

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (!visible.length) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* fine */
    }
  };

  return (
    <div role="region" aria-label="Announcements">
      {visible.map((a) => (
        <div key={a.id} className={`flex items-start justify-between gap-2 py-2.5 pl-4 pr-2 text-sm ${TONE[a.tone] || TONE.info}`} role="status">
          <p className="min-w-0">
            <span className="font-semibold">{a.title}</span>
            {a.body && <span className="ml-2 opacity-90">{a.body}</span>}
            {a.url && (
              <a href={a.url} className="ml-2 underline underline-offset-2" target={/^https?:\/\//.test(a.url) ? "_blank" : undefined} rel="noreferrer">
                {a.url_label || "Read more"}
              </a>
            )}
          </p>
          {/* A full-size target, so it can be hit with a thumb. */}
          <button type="button" onClick={() => dismiss(a.id)} aria-label={`Dismiss: ${a.title}`} className="-my-2 flex h-10 w-10 shrink-0 items-center justify-center text-xl leading-none opacity-70 hover:opacity-100">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
