"use client";

// Shared 3D motion helpers for the homepage.
// - Tilt3D: card tilts toward the pointer with a soft glare (mouse/pen only).
// - Depth: rises in with a perspective tilt the first time it scrolls into view.
// - Title3D: heading whose words flip up in 3D when it comes into view.
// Everything is visible by default: elements are only hidden once JS has
// checked they are below the fold, and reduced-motion users get static content.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import s from "./home3d.module.css";

// useLayoutEffect warns on the server; this one is silent there.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/** True on a device with a mouse (not touch) and no reduced-motion request. */
export function useCanTilt(): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCan(fine.matches && !reduced.matches);
    update();
    fine.addEventListener?.("change", update);
    reduced.addEventListener?.("change", update);
    return () => {
      fine.removeEventListener?.("change", update);
      reduced.removeEventListener?.("change", update);
    };
  }, []);
  return can;
}

export type RevealState = "static" | "waiting" | "in";

/**
 * "static" until JS decides; "waiting" (hidden) only when the element starts
 * below the fold; "in" once it scrolls into view.
 */
export function useScrollReveal<T extends HTMLElement>(ref: React.RefObject<T | null>): RevealState {
  const [state, setState] = useState<RevealState>("static");
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setState("waiting");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("in");
          io.disconnect();
        }
      },
      // Fires a little before the element reaches the screen, so fast
      // scrolling never lands on a blank area.
      { rootMargin: "0px 0px 15% 0px", threshold: 0 }
    );
    io.observe(el);
    // Safety net: never leave content hidden if the observer never fires.
    const t = window.setTimeout(() => setState((v) => (v === "waiting" ? "in" : v)), 8000);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);
  return state;
}

/**
 * Writes pointer and scroll depth to CSS variables on `target`:
 * --ax/--ay (-1..1, pointer over `area`, mouse only) and --as (-1..1, where
 * the element sits relative to the middle of the screen). Nothing for
 * reduced motion; no React re-renders.
 */
export function useDepthVars(
  target: React.RefObject<HTMLElement | null>,
  area: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const el = target.current;
    const zone = area.current || el;
    if (!el || !zone || prefersReducedMotion()) return;
    const fine =
      typeof window.matchMedia === "function" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    let sraf = 0;
    const ease = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty("--ax", cx.toFixed(4));
      el.style.setProperty("--ay", cy.toFixed(4));
      raf = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(ease) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = zone.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      if (!raf) raf = requestAnimationFrame(ease);
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      if (!raf) raf = requestAnimationFrame(ease);
    };
    const onScroll = () => {
      if (sraf) return;
      sraf = requestAnimationFrame(() => {
        sraf = 0;
        const r = el.getBoundingClientRect();
        const p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
        el.style.setProperty("--as", Math.max(-1, Math.min(1, p)).toFixed(3));
      });
    };
    if (fine) {
      zone.addEventListener("pointermove", onMove);
      zone.addEventListener("pointerleave", onLeave);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(sraf);
    };
  }, [target, area]);
}

/** Perspective rise-in on scroll. `index` staggers siblings. */
export function Depth({
  children,
  className = "",
  index = 0,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useScrollReveal(ref);
  return (
    <div
      ref={ref}
      className={`${s.depth} ${state === "waiting" ? s.waiting : ""} ${state === "in" ? s.in : ""} ${className}`}
      style={{ ...style, "--i": index } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Tilts toward the pointer with a glare highlight. Does nothing on touch
 * screens or with reduced motion. `radius` should match the card's corners.
 */
export function Tilt3D({
  children,
  className = "",
  max = 8,
  glare = true,
  radius = 20,
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
  radius?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const canTilt = useCanTilt();
  const on = canTilt && !disabled;

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!on || e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--rx", `${((0.5 - y) * max * 2).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((x - 0.5) * max * 2).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      el.classList.add(s.tilting);
    });
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.classList.remove(s.tilting);
  };

  return (
    <div
      ref={ref}
      className={`${s.tilt} ${on ? s.tiltOn : ""} ${className}`}
      style={{ "--tilt-r": `${radius}px` } as React.CSSProperties}
      onPointerMove={on ? onMove : undefined}
      onPointerLeave={on ? onLeave : undefined}
    >
      {children}
      {glare && on && <span className={s.glare} aria-hidden="true" />}
    </div>
  );
}

/**
 * Splits `*accent*`-marked copy into words, each its own inline-block so it
 * can flip in 3D. Accent words get the theme accent with an extruded shadow.
 */
export function Words3D({ text, startIndex = 0 }: { text: string; startIndex?: number }) {
  const parts = text.split(/\*([^*]+)\*/g);
  let n = startIndex;
  const out: React.ReactNode[] = [];
  parts.forEach((part, pi) => {
    const accent = pi % 2 === 1;
    part.split(/(\s+)/).forEach((chunk, ci) => {
      if (!chunk) return;
      if (/^\s+$/.test(chunk)) {
        out.push(" ");
        return;
      }
      out.push(
        <span
          key={`${pi}-${ci}`}
          className={`${s.word} ${accent ? `home-accent-text ${s.accent3d}` : ""}`}
          style={{ "--w": n++ } as React.CSSProperties}
        >
          {chunk}
        </span>
      );
    });
  });
  return <>{out}</>;
}

/** Section title whose words flip up in 3D when scrolled into view. */
export function Title3D({
  text,
  className = "",
  as: Tag = "h2",
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const state = useScrollReveal(ref);
  return (
    <Tag
      ref={ref}
      className={`${s.title3d} ${state === "waiting" ? s.waiting : ""} ${state === "in" ? s.in : ""} ${className}`}
    >
      <Words3D text={text} />
    </Tag>
  );
}
