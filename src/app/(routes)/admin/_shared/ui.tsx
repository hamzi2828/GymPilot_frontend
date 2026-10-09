"use client";

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BILLING_PATH } from "./api";

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
  const markDialogTouched = useContext(DialogTouchedContext);

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
    markDialogTouched?.();
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
    } else if (event.key === "Escape") {
      // Marked as used, so a dialog this field sits in closes the list only.
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      // Back to the field first: Tab then moves on from where the field is,
      // not from the panel, which is drawn at the end of the page.
      setOpen(false);
      triggerRef.current?.focus();
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
              markDialogTouched?.();
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
            data-dialog-popover=""
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

// What a list shows when it could not be loaded. Kept apart from EmptyState on
// purpose: "No users yet" over a failed request tells the gym its data is gone.
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border border-rose-200 bg-rose-50/40 rounded-lg p-10 text-center">
      <p className="text-sm font-medium text-rose-800">{message}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <SecondaryButton onClick={onRetry}>Try again</SecondaryButton>
        </div>
      )}
    </div>
  );
}

// Previous / Next under a server-paged list. Renders nothing for one page.
export function Pager({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total?: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
      <span>
        Page {page} of {pages}
        {typeof total === "number" ? ` · ${total} in total` : ""}
      </span>
      <div className="flex gap-2">
        <SecondaryButton onClick={() => onChange(page - 1)} disabled={page <= 1}>
          Previous
        </SecondaryButton>
        <SecondaryButton onClick={() => onChange(page + 1)} disabled={page >= pages}>
          Next
        </SecondaryButton>
      </div>
    </div>
  );
}

// Shown beside a PLAN_LIMIT_REACHED refusal (see isPlanLimitError in api.ts):
// the message says where to go, this takes them there.
export function UpgradePlanLink() {
  return (
    <Link href={BILLING_PATH} className="ml-1 font-semibold underline underline-offset-2">
      Go to Billing
    </Link>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-[var(--accent)]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
//
// The rules a dialog follows, so no screen has to think about them:
//
//   * A dialog with anything to fill in never closes on a tap outside it: a
//     stray tap, or a text selection dragged out past the edge, must not
//     throw a half-filled form away. It closes by its own Cancel / Save
//     buttons or the ✕. One with nothing to fill in (a receipt, a profile, a
//     yes/no question) still closes on a tap outside.
//   * Escape closes it until something has been typed or picked in it.
//   * `busy` (a save in flight) blocks every way out until it settles.
//   * `dismissible={false}` leaves only the dialog's own button: for the
//     "password, shown once" kind of screen that must be read before it goes.
//   * `error` is shown inside the dialog, above the scrolling body, so a
//     failed save is never hidden on the page behind.
//
// Focus moves into the dialog when it opens, stays inside it on Tab, and goes
// back to whatever opened it on close.
// ---------------------------------------------------------------------------

// Open dialogs, outermost first. Escape and Tab belong to the last one only,
// so a confirm over a form closes itself and not the form underneath.
const openDialogs: object[] = [];

// What makes a dialog a form. Select2 draws a button with this role.
const FIELDS = 'input:not([type="hidden"]), select, textarea, [role="combobox"]';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// How a field that is not a native input (Select2) tells the dialog it sits
// in that the form has been touched.
const DialogTouchedContext = createContext<(() => void) | null>(null);

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** A save is in flight: nothing closes the dialog until it settles. */
  busy?: boolean;
  /** False leaves the dialog's own button as the only way out. */
  dismissible?: boolean;
  /** Why the last save failed, shown inside the dialog. */
  error?: React.ReactNode;
}

export function Modal({ open, ...rest }: ModalProps) {
  // Mounted only while open, so each opening starts untouched.
  if (!open) return null;
  return <ModalDialog {...rest} />;
}

function ModalDialog({ onClose, title, children, size = "md", busy = false, dismissible = true, error }: Omit<ModalProps, "open">) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const pressedBackdrop = useRef(false);
  const markTouched = useCallback(() => {
    touched.current = true;
  }, []);

  // The document listener below is bound once; it reads these through a ref.
  const live = useRef({ onClose, busy, dismissible });
  useEffect(() => {
    live.current = { onClose, busy, dismissible };
  });

  useEffect(() => {
    const token = {};
    openDialogs.push(token);

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    // A field that asked for focus itself (autoFocus) keeps it. Otherwise the
    // dialog takes it rather than its first field, which on a phone would
    // throw the keyboard up over a form nobody has read yet.
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== token) return;
      const node = dialogRef.current;
      if (!node) return;

      if (event.key === "Escape") {
        // Something inside (an open dropdown) already used this Escape.
        if (event.defaultPrevented || event.isComposing) return;
        const now = live.current;
        if (now.busy || !now.dismissible || touched.current) return;
        event.preventDefault();
        now.onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const current = document.activeElement;
      // A dropdown panel is drawn outside the dialog but belongs to it.
      if (current instanceof HTMLElement && current.closest("[data-dialog-popover]")) return;
      const fields = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
      if (!fields.length) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = fields[0];
      const last = fields[fields.length - 1];
      if (!node.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (current === first || current === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openDialogs.indexOf(token);
      if (index >= 0) openDialogs.splice(index, 1);
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  const sizeCls = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      // Both the press and the release must land on the backdrop: a drag that
      // starts inside a field and ends outside the box is not a dismissal.
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        const onBackdrop = event.target === event.currentTarget && pressedBackdrop.current;
        pressedBackdrop.current = false;
        if (!onBackdrop || busy || !dismissible) return;
        if (dialogRef.current?.querySelector(FIELDS)) return;
        onClose();
      }}
    >
      <DialogTouchedContext.Provider value={markTouched}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={busy || undefined}
          tabIndex={-1}
          // Every native field reports a change here, typed or picked.
          onChange={markTouched}
          // Nothing clicked inside reaches the backdrop, or the page behind.
          onClick={(event) => event.stopPropagation()}
          className={`w-full ${sizeCls} bg-white rounded-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col focus:outline-none`}
        >
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-neutral-200">
            <h2 id={titleId} className="min-w-0 text-sm font-semibold text-neutral-900">
              {title}
            </h2>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
          {error ? (
            <div role="alert" className="mx-6 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="px-6 py-5 overflow-y-auto admin-scroll">{children}</div>
        </div>
      </DialogTouchedContext.Provider>
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
