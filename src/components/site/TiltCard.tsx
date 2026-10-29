"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./motion.module.css";

/**
 * A card that tilts towards the pointer with a soft glare. Only on devices
 * with a fine pointer that can hover, and never with reduced motion: there
 * it is a plain box.
 */
export default function TiltCard({
  children,
  className = "",
  max = 9,
  glare = true,
  as: Tag = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  /** Largest tilt, in degrees. */
  max?: number;
  glare?: boolean;
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement | null>(null);
  const frame = useRef(0);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!enabled || e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const px = (clientX - r.left) / r.width;
      const py = (clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(px - 0.5) * 2 * max}deg`);
      el.style.setProperty("--rx", `${(0.5 - py) * 2 * max}deg`);
      el.style.setProperty("--gx", `${px * 100}%`);
      el.style.setProperty("--gy", `${py * 100}%`);
      el.classList.add(styles.isActive);
    });
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.classList.remove(styles.isActive);
  };

  return (
    <Tag
      ref={ref}
      className={`${enabled ? styles.tilt : ""} ${className}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      {...rest}
    >
      {children}
      {enabled && glare && <span className={styles.glare} aria-hidden="true" />}
    </Tag>
  );
}

/** Class name that lifts a child off the card face in 3D. */
export const tiltPop = styles.pop;
