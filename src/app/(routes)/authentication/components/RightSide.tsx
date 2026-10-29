"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSiteSettings } from "@/components/ThemeProvider";
import { useDepthVars } from "../../main/components/motion3d";
import { heroService } from "../../main/services/heroService";
import { resolveMediaUrl } from "../../main/services/homeService";
import s from "../auth.module.css";

// The panel beside the sign-in form: the gym's own photo, logo and name,
// and a few things every member account can do. No invented numbers.
// On phones it shrinks to a slim banner above the form.

const BLANK_PREFIX = "data:image/gif";

const FEATURES = [
  {
    key: "book",
    title: "Book classes",
    meta: "Reserve your spot in seconds",
    cls: s.f1,
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zm4 9l2 2 4-4" />,
  },
  {
    key: "pay",
    title: "Pay fees",
    meta: "Renew your membership online",
    cls: s.f2,
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 3h18M7 15h3" />,
  },
  {
    key: "checkin",
    title: "Check in",
    meta: "Straight through the door",
    cls: s.f3,
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h2m4 0v2m-6 4h2m2-2h2v2" />,
  },
];

export const RightSide: React.FC = () => {
  const { siteName, logoUrl } = useSiteSettings();
  const panel = useRef<HTMLElement>(null);
  const [photo, setPhoto] = useState("");

  // Pointer depth (--ax/--ay) for the layers; mouse only, off for reduced motion.
  useDepthVars(panel, panel);

  // The gym's first banner photo, the same one the About page uses. Read
  // only; without one the layered plate is the backdrop.
  useEffect(() => {
    let cancelled = false;
    heroService
      .getActiveSlides()
      .then((slides) => {
        const first = [...slides]
          .sort((a, b) => a.order - b.order)
          .map((sl) => resolveMediaUrl(sl.imageUrl))
          .find(Boolean);
        if (!cancelled && first) setPhoto(first);
      })
      .catch(() => {
        /* no photo: the plate stays */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasLogo = !!logoUrl && !logoUrl.startsWith(BLANK_PREFIX);

  return (
    <aside ref={panel} className={s.visual} aria-label={siteName ? `Welcome to ${siteName}` : "Welcome"}>
      <div className={s.plate} aria-hidden="true" />
      <div
        className={`${s.photo} ${photo ? s.photoOn : ""}`}
        style={photo ? { backgroundImage: `url('${photo}')` } : undefined}
        aria-hidden="true"
      />
      <div className={s.shade} aria-hidden="true" />
      <div className={s.grid} aria-hidden="true" />
      <div className={s.glow} aria-hidden="true" />
      <div className={s.glow2} aria-hidden="true" />

      <div className={s.stage} aria-hidden="true">
        {FEATURES.map((f) => (
          <div key={f.key} className={`${s.float} ${f.cls}`}>
            <div className={s.floatInner}>
              <span className={s.floatIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  {f.icon}
                </svg>
              </span>
              <span>
                <span className={s.floatTitle}>{f.title}</span>
                <span className={s.floatMeta}>{f.meta}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={s.visualInner}>
        <div className={s.topBar}>
          {hasLogo ? (
            <Link href="/" className={s.brand} aria-label={siteName ? `${siteName} — go to homepage` : "Go to homepage"}>
              {/* A plain img: the logo may be a data: wordmark or any host. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className={s.logo} />
            </Link>
          ) : (
            <span />
          )}
          <Link href="/" className={s.back}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m6 6l-6-6 6-6" />
            </svg>
            Back to site
          </Link>
        </div>

        <div className={s.welcome}>
          <span className={s.eyebrow}>
            <span className={s.dot} aria-hidden="true" />
            Your membership
          </span>
          <p className={s.welcomeTitle}>
            Welcome{siteName ? " to " : ""}
            {siteName && <span>{siteName}</span>}
          </p>
          <p className={s.welcomeLead}>Sign in to your account, or create one to get started.</p>
        </div>
      </div>
    </aside>
  );
};

export default RightSide;
