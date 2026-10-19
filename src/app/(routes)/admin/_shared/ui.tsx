"use client";

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import SearchableSelect, { type SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { BILLING_PATH, newRequestId } from "./api";

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
      {/* Wraps: four buttons do not fit across a phone. */}
      {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
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

// ---------------------------------------------------------------------------
// Busy buttons
//
// A button that starts something slow (a save, a delete, a download) shows it
// is working: `loading` disables it, marks it aria-busy and draws a spinner
// over its label. The label stays where it was, only unseen, so the button
// keeps its width and the buttons beside it do not jump. A busy button is not
// faded the way a disabled one is: it is working, not unavailable.
//
// useAsyncAction (below) is what tells a button it is busy, and what stops a
// fast second click from running the action twice.
//
// A plain <button> gets the same with `relative`, `disabled`, `aria-busy` and
// its label inside <BusyLabel busy={…}>, or by showing <ButtonSpinner /> in
// place of its icon.
// ---------------------------------------------------------------------------

/** The turning ring a busy button shows. It holds still for anyone who has asked for less motion. */
export function ButtonSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin ${className}`}
    />
  );
}

/**
 * A button's label, hidden under a spinner while `busy` without giving up its
 * space. The button around it needs `relative`. `className` lays the label out
 * (the button's own gap, say), since the label's parts sit inside it.
 */
export function BusyLabel({
  busy,
  children,
  className = "inline-flex items-center",
}: {
  busy?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      {/* Transparent rather than hidden, so the button keeps its name for a screen reader. */}
      <span className={`${className} ${busy ? "opacity-0" : ""}`}>{children}</span>
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center">
          <ButtonSpinner />
        </span>
      )}
    </>
  );
}

// Added to each button: room for the spinner, and a busy button drawn at full
// strength over the faded look of a disabled one.
const BUSY_BUTTON = "relative aria-busy:disabled:opacity-100 aria-busy:disabled:cursor-wait";

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  loading = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  /** The action it started is running: spinner, disabled, aria-busy. */
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BUSY_BUTTON} inline-flex items-center h-9 px-4 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2`}
    >
      <BusyLabel busy={loading}>{children}</BusyLabel>
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  label,
  loading = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  /** For a button that is only an icon: what it does, read out and shown on hover. */
  label?: string;
  /** The action it started is running: spinner, disabled, aria-busy. */
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={label}
      title={label}
      className={`${BUSY_BUTTON} inline-flex items-center h-9 px-3 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300`}
    >
      <BusyLabel busy={loading}>{children}</BusyLabel>
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
  disabled,
  label,
  loading = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** For a button that is only an icon: what it does, read out and shown on hover. */
  label?: string;
  /** The action it started is running: spinner, disabled, aria-busy. */
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={label}
      title={label}
      className={`${BUSY_BUTTON} inline-flex items-center h-9 px-3 text-sm font-medium text-rose-600 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 hover:border-rose-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200`}
    >
      <BusyLabel busy={loading}>{children}</BusyLabel>
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
        // The panel's password boxes hold API keys and mail passwords, never
        // the admin's own sign-in: the browser must not fill that in here.
        autoComplete={type === "password" ? "new-password" : undefined}
        // 16px below sm: iOS zooms the page into any field set smaller.
        className="mt-1 w-full h-9 px-3 text-base sm:text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
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
        className="mt-1 w-full px-3 py-2 text-base sm:text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors resize-none"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Select2
//
// The panel's searchable dropdown, in the shape of the jQuery plugin of the
// same name: the site-wide SearchableSelect (components/ui) in the panel's
// look, which also marks a dialog it sits in as touched when a choice is
// made. Every list opens with its search box; see SearchableSelect for how it
// behaves.
// ---------------------------------------------------------------------------

export type SelectOption = SearchableSelectOption;

const TRIGGER_FOCUS =
  "focus:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]";

export function Select2({
  value,
  onChange,
  options,
  placeholder = "-- select --",
  searchPlaceholder = "Search…",
  allowClear = false,
  disabled = false,
  searchable = true,
  size = "md",
  ariaLabel,
  busy,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  /** False drops the search box. Every list has one by default. */
  searchable?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
  /** Something the last pick started is still running (aria-busy). */
  busy?: boolean;
}) {
  const markDialogTouched = useContext(DialogTouchedContext);
  const height = size === "sm" ? "h-8 text-[13px]" : "h-9 text-sm";

  return (
    <SearchableSelect
      look="admin"
      value={value}
      onChange={(next) => {
        markDialogTouched?.();
        onChange(next);
      }}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      allowClear={allowClear}
      disabled={disabled}
      searchable={searchable}
      ariaLabel={ariaLabel}
      busy={busy}
      className={({ open }) =>
        `rounded-lg border bg-white px-3 ${height} ${
          open
            ? "border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
            : "border-neutral-200 hover:border-neutral-300"
        } ${TRIGGER_FOCUS}`
      }
    />
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
// A retry that hands back its load's promise keeps the button busy until it settles.
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => unknown }) {
  const retrying = useAsyncAction();
  return (
    <div role="alert" className="border border-rose-200 bg-rose-50/40 rounded-lg p-10 text-center">
      <p className="text-sm font-medium text-rose-800">{message}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <SecondaryButton onClick={() => retrying.run(async () => onRetry())} loading={retrying.busy}>
            Try again
          </SecondaryButton>
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
  // What had focus when the dialog was asked for, noted before anything in it
  // (an autoFocus field) can take focus for itself.
  const [opener] = useState(() => (typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null));

  // The document listener below is bound once; it reads these through a ref.
  const live = useRef({ onClose, busy, dismissible });
  useEffect(() => {
    live.current = { onClose, busy, dismissible };
  });

  useEffect(() => {
    const token = {};
    openDialogs.push(token);

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
  }, [opener]);

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

// ---------------------------------------------------------------------------
// useConfirm
//
// The question asked before anything that cannot be taken back -- a delete, a
// refund, signing someone out -- in place of the browser's confirm()/prompt().
//
//   const { ask, dialog: confirmDialog } = useConfirm();
//
//   const answer = await ask({
//     title: "Delete Sara Khan?",
//     body: "Their bookings and payment history go with them. This cannot be undone.",
//     confirmLabel: "Delete member",
//   });
//   if (answer === null) return;          // they backed out
//
//   ...and {confirmDialog} once, anywhere in the page's markup. It is drawn
//   at the end of the document, so it sits above a dialog it was opened from.
//
// `ask` resolves to null when they back out, otherwise to the reason typed
// (an empty string when no reason was asked for, or none was given).
// ---------------------------------------------------------------------------

export interface ConfirmOptions {
  /** The question, naming the thing: "Delete Sara Khan?" */
  title: string;
  /** What will happen, in plain words. */
  body?: React.ReactNode;
  /** The button that does it, saying what it does: "Delete member". */
  confirmLabel: string;
  /** The button that backs out. "Cancel", unless the action is itself a cancellation. */
  cancelLabel?: string;
  /** False for a step that is safe to repeat; the button is then not red. */
  danger?: boolean;
  /** Asks for a reason as well, handed back as the answer. */
  reason?: { label: string; placeholder?: string; required?: boolean };
}

type PendingConfirm = { options: ConfirmOptions; resolve: (answer: string | null) => void };

export function useConfirm(): { ask: (options: ConfirmOptions) => Promise<string | null>; dialog: React.ReactNode } {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const settle = useCallback((answer: string | null) => {
    pendingRef.current?.resolve(answer);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const ask = useCallback((options: ConfirmOptions) => {
    // One question at a time: a second one withdraws the first.
    pendingRef.current?.resolve(null);
    return new Promise<string | null>((resolve) => {
      pendingRef.current = { options, resolve };
      setPending(pendingRef.current);
    });
  }, []);

  // Leaving the page with a question still open answers it "no".
  useEffect(() => () => pendingRef.current?.resolve(null), []);

  return {
    ask,
    dialog: pending ? createPortal(<ConfirmDialog options={pending.options} onAnswer={settle} />, document.body) : null,
  };
}

function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (answer: string | null) => void }) {
  const { title, body, confirmLabel, cancelLabel = "Cancel", danger = true, reason } = options;
  const [text, setText] = useState("");
  const missing = !!reason?.required && !text.trim();

  return (
    <Modal open onClose={() => onAnswer(null)} title={title} size="sm">
      <div className="space-y-4">
        {body && <div className="text-sm leading-relaxed text-neutral-600">{body}</div>}
        {reason && (
          <TextField
            label={reason.label}
            value={text}
            onChange={setText}
            placeholder={reason.placeholder}
            required={reason.required}
          />
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <SecondaryButton onClick={() => onAnswer(null)}>{cancelLabel}</SecondaryButton>
          {danger ? (
            <button
              type="button"
              onClick={() => onAnswer(text.trim())}
              disabled={missing}
              className="inline-flex items-center h-9 px-4 text-sm font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2"
            >
              {confirmLabel}
            </button>
          ) : (
            <PrimaryButton onClick={() => onAnswer(text.trim())} disabled={missing}>
              {confirmLabel}
            </PrimaryButton>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// useLatestRequest
//
// For a list that reloads as its filters change: a slow answer to an older
// question must not land on top of a newer one.
//
//   const begin = useLatestRequest();
//
//   const isLatest = begin();
//   const rows = await apiGet(...);
//   if (!isLatest()) return;              // a newer load has started since
//
// The same check goes in the catch, and around setLoading(false) in the
// finally, so the older request neither reports an error nor stops the
// spinner of the newer one.
// ---------------------------------------------------------------------------

export function useLatestRequest(): () => () => boolean {
  const latest = useRef(0);
  return useCallback(() => {
    const mine = ++latest.current;
    return () => mine === latest.current;
  }, []);
}

// ---------------------------------------------------------------------------
// useRequestId
//
// For money taken at the desk (a membership sold, a renewal, a part payment):
// the API accepts a `requestId` with each, and answers a second request
// carrying the same id with the first one's result instead of a second sale.
// So pressing the button again after "Could not reach the server" is safe.
//
//   const requestId = useRequestId();
//
//   const body = { amount, method, note };
//   apiJson(url, "POST", { ...body, requestId: requestId.for(url, body) });
//   ...
//   requestId.reset();                    // it went through, or the form was opened afresh
//
// `for` hands back the same id for as long as it is asked about the same
// thing: the same `scope` (which order, which member) and the same body. A
// different amount, method or date is a different sale and gets a new id.
// Free text does not count: a note added before pressing again must not be
// what records the money twice. Nor does a password, which is not kept here.
// ---------------------------------------------------------------------------

const NOT_MATERIAL = new Set(["note", "notes", "discountNote", "staffNotes", "password"]);

export function useRequestId(): { for: (scope: string, body: unknown) => string; reset: () => void } {
  const held = useRef<{ key: string; id: string } | null>(null);
  return useMemo(
    () => ({
      for(scope: string, body: unknown) {
        const key = `${scope} ${JSON.stringify(body, (name, value) => (NOT_MATERIAL.has(name) ? undefined : value))}`;
        if (held.current?.key !== key) held.current = { key, id: newRequestId() };
        return held.current.id;
      },
      reset() {
        held.current = null;
      },
    }),
    []
  );
}

// ---------------------------------------------------------------------------
// useAsyncAction
//
// What a button that starts something slow is wired to. `run` starts the
// action unless the same one is still running: the guard is checked and set
// in the click itself, so a fast double click is one save, not two, even
// before React has redrawn the button disabled. `busy` stays true until the
// action has finished or failed.
//
//   const saving = useAsyncAction();
//
//   const save = () =>
//     saving.run(async () => {
//       try { await apiJson(...); } catch (e) { setError(...); }
//     });
//
//   <Modal busy={saving.busy} ...>
//   <PrimaryButton onClick={save} loading={saving.busy}>Save</PrimaryButton>
//
// A key tells apart actions that may run side by side, such as one per table
// row; each key is guarded on its own:
//
//   const rows = useAsyncAction();
//   rows.run(member._id, () => remove(member));
//   <DangerButton loading={rows.isBusy(member._id)} ...>
//
// `run` hands back what the action returned, or undefined when it was
// dropped as a repeat. An error the action throws is thrown on, not eaten.
// An action that ends by leaving the page (off to Stripe) awaits
// untilPageLeaves() last, so its button stays busy until the page has gone;
// back on the page from the browser's back-forward cache, nothing is busy.
// ---------------------------------------------------------------------------

export interface AsyncAction {
  /** Something started here is still running. */
  busy: boolean;
  /** The action started under this key (none: the unkeyed one) is still running. */
  isBusy: (key?: string) => boolean;
  run: {
    <T>(task: () => Promise<T> | T): Promise<T | undefined>;
    <T>(key: string, task: () => Promise<T> | T): Promise<T | undefined>;
  };
}

export function useAsyncAction(): AsyncAction {
  // The guard itself: read and written within the click, unlike state.
  const running = useRef(new Set<string>());
  const [pending, setPending] = useState<readonly string[]>([]);

  const run = useCallback(async <T,>(first: string | (() => Promise<T> | T), second?: () => Promise<T> | T) => {
    const key = typeof first === "string" ? first : "";
    const task = typeof first === "string" ? second : first;
    if (!task || running.current.has(key)) return undefined;
    running.current.add(key);
    setPending(Array.from(running.current));
    try {
      return await task();
    } finally {
      running.current.delete(key);
      setPending(Array.from(running.current));
    }
  }, []) as AsyncAction["run"];

  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      running.current.clear();
      setPending([]);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return useMemo(
    () => ({ busy: pending.length > 0, isBusy: (key = "") => pending.includes(key), run }),
    [pending, run]
  );
}

/** Awaited last by an action that leaves the page: it never settles, so the button stays busy. */
export function untilPageLeaves(): Promise<never> {
  return new Promise<never>(() => {});
}

// ---------------------------------------------------------------------------
// ActionMenu
//
// The lesser actions on a table row, behind one "More" button, so a row is
// two or three buttons wide instead of eight. Drawn at the end of the page at
// fixed coordinates for the same reason Select2's panel is: a table scrolls
// sideways inside its card, and a menu inside it would be clipped.
// ---------------------------------------------------------------------------

export interface MenuAction {
  label: string;
  onClick: () => void;
  /** Shown in red: it deletes or cannot be undone. */
  danger?: boolean;
}

const MENU_WIDTH = 224;

export function ActionMenu({
  actions,
  label = "More",
  ariaLabel,
  busy = false,
}: {
  actions: MenuAction[];
  label?: string;
  /** Names whose actions these are, for a screen reader: "More for Sara Khan". */
  ariaLabel?: string;
  /** One of its actions is running: the button shows a spinner and does not open. */
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; flipped: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const count = actions.length;

  useEffect(() => {
    if (!open) return;
    const node = triggerRef.current;
    if (node) {
      const rect = node.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const flipped = below < count * 40 + 24 && rect.top > below;
      setCoords({
        top: flipped ? rect.top - 6 : rect.bottom + 6,
        // Under the button's right edge, kept on screen at either side.
        left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
        flipped,
      });
    }

    const close = () => setOpen(false);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    // A fixed menu does not follow its row, so scrolling puts it away.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, count]);

  useEffect(() => {
    if (!open || !coords) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open, coords]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[Math.min(items.length - 1, at + 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[Math.max(0, at - 1)]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Escape") {
      // Marked as used, so a dialog this menu sits in stays open.
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  if (!count) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => setOpen((v) => !v)}
        className={`${BUSY_BUTTON} inline-flex items-center h-9 px-3 text-sm font-medium whitespace-nowrap text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300`}
      >
        <BusyLabel busy={busy} className="inline-flex items-center gap-1">
          {label}
          <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </BusyLabel>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={ariaLabel || label}
            data-dialog-popover=""
            onKeyDown={onMenuKeyDown}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: MENU_WIDTH,
              transform: coords.flipped ? "translateY(-100%)" : undefined,
              zIndex: 70,
            }}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg shadow-neutral-900/10"
          >
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className={`block w-full px-3 py-2.5 text-left text-sm focus:outline-none ${
                  action.danger
                    ? "text-rose-600 hover:bg-rose-50 focus:bg-rose-50"
                    : "text-neutral-700 hover:bg-neutral-100 focus:bg-neutral-100"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

export function Table({
  columns,
  rows,
  empty,
  stickyFirst = false,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  empty?: string;
  /** Keeps the first column in view while a wide table is scrolled sideways. */
  stickyFirst?: boolean;
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
              {columns.map((c, j) => (
                <th
                  key={c}
                  className={`whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500 ${
                    stickyFirst && j === 0 ? "sticky left-0 z-[1] bg-neutral-50 shadow-[1px_0_0_#e5e5e5]" : ""
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="group border-b border-neutral-100 last:border-b-0 transition-colors hover:bg-neutral-50">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-5 py-3.5 align-middle text-neutral-700 ${
                      stickyFirst && j === 0 ? "sticky left-0 z-[1] bg-white shadow-[1px_0_0_#e5e5e5] transition-colors group-hover:bg-neutral-50" : ""
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
