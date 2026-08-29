"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function PageHeader({
  title,
  eyebrow,
  actions,
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end mb-8">
      <div>
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-neutral-200 rounded-xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center h-9 px-4 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center h-9 px-3 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center h-9 px-3 text-sm font-medium text-rose-600 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 hover:border-rose-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-700">{label}{required && " *"}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors resize-none"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Select2
//
// A searchable dropdown in the shape of the jQuery plugin of the same name,
// built natively rather than pulled in: Select2 needs jQuery and mutates the
// DOM under React, which fights the render cycle on every re-render.
//
// Two decisions worth knowing about:
//
//   * The panel is PORTALLED to <body> at fixed coordinates rather than
//     absolutely positioned inside the field. Several of these live inside a
//     modal whose body scrolls (`overflow-y-auto`), and an in-flow dropdown is
//     clipped by it -- the list would be cut off exactly where it matters.
//
//   * The search box only appears once a list is long enough to need it.
//     Typing to filter three options is slower than reading them.
// ---------------------------------------------------------------------------

export interface SelectOption {
  value: string;
  label: string;
  // Second line under the label -- an email beside a name, a count beside a
  // status. Searched along with the label.
  hint?: string;
}

// Above this many options, a search box appears.
const SEARCH_THRESHOLD = 7;

export function Select2({
  value,
  onChange,
  options,
  placeholder = "-- select --",
  searchPlaceholder = "Search…",
  allowClear = false,
  disabled = false,
  searchable,
  size = "md",
  ariaLabel,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    flipped: boolean;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);
  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) || (option.hint || "").toLowerCase().includes(term)
    );
  }, [options, query]);

  // Measured from the trigger every time it opens, and again on scroll: a
  // fixed panel does not follow its field on its own.
  const place = useCallback(() => {
    const node = triggerRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const flipped = below < 200 && above > below;

    setCoords({
      top: flipped ? rect.top - 6 : rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(160, Math.min(300, flipped ? above : below)),
      flipped,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    place();

    const reposition = () => place();
    // Capture phase: the field may sit inside a scrolling modal body, whose
    // scroll events do not bubble to window.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, place]);

  // Opening starts from the current selection, so Enter without touching
  // anything is a no-op rather than a silent change to the first option.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const index = options.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : 0);
    const focus = requestAnimationFrame(() => (inputRef.current || listRef.current)?.focus());
    return () => cancelAnimationFrame(focus);
  }, [open, options, value]);

  useEffect(() => {
    if (open) setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector(`[data-index="${active}"]`);
    if (node) (node as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (option: SelectOption) => {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(filtered.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[active]) commit(filtered[active]);
    } else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      if (event.key === "Escape") triggerRef.current?.focus();
    }
  };

  const height = size === "sm" ? "h-8 text-[13px]" : "h-9 text-sm";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${height} ${
          open
            ? "border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
            : "border-neutral-200 hover:border-neutral-300"
        } focus:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-neutral-800" : "text-neutral-400"}`}>
          {selected ? selected.label : placeholder}
        </span>

        {allowClear && selected && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear selection"
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
            className="shrink-0 rounded px-1 text-neutral-400 hover:text-neutral-700"
          >
            ✕
          </span>
        )}

        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.flipped ? "translateY(-100%)" : undefined,
              zIndex: 70,
            }}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg shadow-neutral-900/10"
          >
            {showSearch && (
              <div className="border-b border-neutral-100 p-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full rounded-md border border-neutral-200 px-2.5 text-[13px] text-neutral-800 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            )}

            {/* Without a search box there is nothing else to hold focus, so
                the list itself takes it and answers the arrow keys. */}
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              tabIndex={showSearch ? -1 : 0}
              onKeyDown={showSearch ? undefined : onKeyDown}
              style={{ maxHeight: coords.maxHeight }}
              className="admin-scroll overflow-y-auto py-1 focus:outline-none"
            >
              {!filtered.length && (
                <p className="px-3 py-6 text-center text-[13px] text-neutral-400">No matches</p>
              )}

              {filtered.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={option.value || `__empty-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => commit(option)}
                    className={`cursor-pointer px-3 py-2 text-[13px] ${
                      index === active ? "bg-neutral-100" : ""
                    } ${isSelected ? "font-semibold text-neutral-900" : "text-neutral-700"}`}
                  >
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="mt-0.5 block truncate text-[11px] text-neutral-400">{option.hint}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  allowClear = true,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  allowClear?: boolean;
}) {
  return (
    <div className="block">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <div className="mt-1">
        <Select2
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder || "-- select --"}
          allowClear={allowClear}
          ariaLabel={label}
        />
      </div>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      <span className="text-neutral-700">{label}</span>
    </label>
  );
}

export function Badge({
  children,
  color = "neutral",
}: {
  children: React.ReactNode;
  color?: "neutral" | "green" | "amber" | "rose" | "blue";
}) {
  const map: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    blue: "bg-sky-50 text-sky-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${map[color]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-neutral-200 rounded-lg p-10 text-center">
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-[var(--accent)]" />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;
  const sizeCls = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`w-full ${sizeCls} bg-white rounded-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto admin-scroll">{children}</div>
      </div>
    </div>
  );
}

export function Table({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  if (!rows.length) {
    return <EmptyState title={empty || "No data yet"} />;
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80">
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-neutral-100 last:border-b-0 transition-colors hover:bg-neutral-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-5 py-3.5 align-middle text-neutral-700">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
