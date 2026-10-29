"use client";

import React, { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";

export type FaqEntry = { id: string; question: string; answerHtml: string };

/**
 * Questions that open one at a time. The answer HTML arrives already
 * sanitised.
 */
export default function FaqAccordion({ items }: { items: FaqEntry[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  const reduce = useReducedMotion();
  const base = useId();

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === item.id;
        const panelId = `${base}-panel-${i}`;
        const btnId = `${base}-btn-${i}`;
        return (
          <div
            key={item.id}
            className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${
              isOpen
                ? "border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[var(--surface)]"
                : "border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface)_55%,transparent)] hover:border-white/20"
            }`}
          >
            <h3>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : item.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)] rounded-2xl"
              >
                <span className="font-semibold text-white sm:text-lg">{item.question}</span>
                <span
                  className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border transition-all duration-300 ${
                    isOpen
                      ? "rotate-45 border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                      : "border-white/15 text-white/80"
                  }`}
                  aria-hidden="true"
                >
                  <Plus size={18} />
                </span>
              </button>
            </h3>
            {/* Always rendered, so every answer is in the page HTML; closed
                ones are collapsed and hidden from assistive tech. */}
            <motion.div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              aria-hidden={!isOpen}
              inert={!isOpen}
              className="overflow-hidden"
              initial={false}
              animate={isOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <motion.div
                initial={false}
                animate={isOpen || reduce ? { rotateX: 0, y: 0 } : { rotateX: -12, y: -8 }}
                transition={reduce ? { duration: 0 } : { duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                style={{ transformOrigin: "50% 0%", transformPerspective: 800 }}
                className="prose prose-invert max-w-none px-5 pb-6 text-[15px] text-white/75 sm:px-6 prose-a:text-[var(--accent)] prose-a:underline-offset-4"
                dangerouslySetInnerHTML={{ __html: item.answerHtml }}
              />
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
