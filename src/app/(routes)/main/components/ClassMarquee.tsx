"use client";

// A band in the gym's own colour under the banner, with its classes rolling
// past (STRENGTH ✦ HIIT ✦ BOXING …). The names come from the gym's active
// classes, so every gym's band is its own; with fewer than two classes there is
// nothing to roll and nothing is shown. The list is drawn twice so the loop
// wraps without a jump; it pauses on hover and holds still for anyone who has
// asked for reduced motion (globals.css: .class-marquee).

import { useEffect, useState } from "react";
import { gymClassService } from "../services/gymClassService";

export default function ClassMarquee() {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    gymClassService
      .getActiveClasses()
      .then((classes) => {
        if (cancelled) return;
        const unique = [...new Set(classes.map((c) => (c.name || "").trim()).filter(Boolean))];
        setNames(unique);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (names.length < 2) return null;

  // Short lists are repeated so one copy is always wider than the screen.
  const run = names.length < 6 ? [...names, ...names, ...names] : names;

  return (
    <div className="class-marquee" aria-label={`Classes: ${names.join(", ")}`}>
      <div className="class-marquee__track" aria-hidden="true">
        {[0, 1].map((copy) => (
          <div key={copy} className="class-marquee__run">
            {run.map((name, i) => (
              <span key={`${copy}-${i}`} className="class-marquee__item">
                {name}
                <span className="class-marquee__star">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
