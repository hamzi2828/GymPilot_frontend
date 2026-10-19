"use client";

// ---------------------------------------------------------------------------
// SearchableSelect
//
// The one dropdown used wherever a single choice is picked from a list: the
// public site, checkout and the member portal use it directly, the admin panel
// through its kit (Select2 and SelectField in admin/_shared/ui.tsx). It is in
// the shape of the jQuery Select2 plugin -- a field that opens a list with a
// search box on top -- built natively rather than pulled in: Select2 needs
// jQuery and mutates the DOM under React, which fights the render cycle on
// every re-render.
//
// Worth knowing:
//
//   * Every list has the search box, focused as the list opens, so typing
//     filters straight away; typing on the closed field opens it with what was
//     typed. The one exception is a short list on a touch screen: the list
//     takes focus and the search box is a tap away, so picking one of three
//     does not throw the keyboard up over the list.
//
//   * The panel is PORTALLED to <body> at fixed coordinates rather than
//     absolutely positioned inside the field. Several of these live inside a
//     modal whose body scrolls, and an in-flow dropdown is clipped by it --
//     the list would be cut off exactly where it matters.
//
//   * In a form, `name` and `required` work as on a <select>: a hidden input
//     carries the value, and the browser's "fill out this field" check lands
//     on it and hands focus back to the field.
//
//   * onChange fires when a different option is picked, as on a <select>:
//     picking the one already chosen changes nothing.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SearchableSelectOption {
  value: string;
  label: string;
  // Second line under the label -- an email beside a name, a count beside a
  // status. Searched along with the label.
  hint?: string;
  // Shown but cannot be picked, as a disabled <option>.
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  /** Shown while nothing (or a value not in the list) is chosen. */
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** A ✕ on the field that sets the value back to "". */
  allowClear?: boolean;
  /** False drops the search box. Every list has one by default. */
  searchable?: boolean;
  /** On the field itself, for a <label htmlFor>. */
  id?: string;
  /** Sent with the form, as a <select name> would be. */
  name?: string;
  required?: boolean;
  /** The field is marked wrong (aria-invalid); its red border is the caller's. */
  invalid?: boolean;
  /** Something the last pick started is still running (aria-busy). */
  busy?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  /**
   * The field's look, as the <select> it replaces had it: border, padding,
   * height, font. A function gets whether the list is open.
   */
  className?: string | ((state: { open: boolean }) => string);
  /** The site (theme accent) or the admin panel's neutral look for the list. */
  look?: "site" | "admin";
}

const LOOKS = {
  site: {
    trigger: "rounded-lg border-2 border-gray-200 bg-white px-4 py-3 focus:outline-none focus:border-[var(--accent)]",
    open: "ring-2 ring-[var(--accent)]",
    placeholder: "text-gray-400",
    value: "",
    icon: "text-gray-400",
    clear: "text-gray-400 hover:text-gray-700",
    panel: "rounded-lg border border-gray-200 bg-white text-left shadow-xl shadow-black/10",
    searchRow: "border-b border-gray-100 p-2",
    search:
      "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-base sm:text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
    list: "",
    empty: "px-4 py-6 text-center text-sm text-gray-500",
    option: "px-4 py-2.5 text-sm",
    active: "bg-[color-mix(in_srgb,var(--accent)_18%,white)]",
    selected: "font-semibold text-gray-900",
    idle: "text-gray-700",
    unavailable: "cursor-not-allowed text-gray-400",
    hint: "mt-0.5 block truncate text-xs text-gray-500",
  },
  admin: {
    trigger:
      "h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:border-[var(--accent)]",
    open: "",
    placeholder: "text-neutral-400",
    value: "text-neutral-800",
    icon: "text-neutral-400",
    clear: "text-neutral-400 hover:text-neutral-700",
    panel: "rounded-lg border border-neutral-200 bg-white text-left shadow-lg shadow-neutral-900/10",
    searchRow: "border-b border-neutral-100 p-2",
    // 16px below sm: iOS zooms the page into any field set smaller.
    search:
      "h-8 w-full rounded-md border border-neutral-200 px-2.5 text-base sm:text-[13px] text-neutral-800 focus:border-[var(--accent)] focus:outline-none",
    list: "admin-scroll",
    empty: "px-3 py-6 text-center text-[13px] text-neutral-400",
    option: "px-3 py-2 text-[13px]",
    active: "bg-neutral-100",
    selected: "font-semibold text-neutral-900",
    idle: "text-neutral-700",
    unavailable: "cursor-not-allowed text-neutral-400",
    hint: "mt-0.5 block truncate text-[11px] text-neutral-400",
  },
} as const;

// Up to this many options, a touch screen opens the list without the keyboard.
const SHORT_LIST = 7;
// The search row's height, kept out of the room the list itself is given.
const SEARCH_ROW = 52;
// A narrow field (a filter in a toolbar) still opens a list a search fits in.
const MIN_PANEL_WIDTH = 176;

interface Coords {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  flipped: boolean;
}

// Accents and case do not count: "cote" finds Côte d'Ivoire.
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function matching(options: SearchableSelectOption[], query: string): SearchableSelectOption[] {
  const term = fold(query.trim());
  if (!term) return options;
  return options.filter((option) => fold(option.label).includes(term) || fold(option.hint || "").includes(term));
}

// The next option that can be picked, from `from` in direction `step`;
// `from` itself when there is none.
function nextEnabled(list: SearchableSelectOption[], from: number, step: 1 | -1): number {
  for (let i = from + step; i >= 0 && i < list.length; i += step) {
    if (!list[i].disabled) return i;
  }
  return from;
}

function firstEnabled(list: SearchableSelectOption[]): number {
  const index = list.findIndex((option) => !option.disabled);
  return index >= 0 ? index : 0;
}

function lastEnabled(list: SearchableSelectOption[]): number {
  for (let i = list.length - 1; i >= 0; i--) if (!list[i].disabled) return i;
  return 0;
}

function isTouchScreen(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

function isPrintable(event: React.KeyboardEvent): boolean {
  return event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey;
}

// Measured from the field every time the list opens, and again on scroll and
// resize: a fixed panel does not follow its field on its own. The visual
// viewport is what is left above a phone's on-screen keyboard.
function measure(trigger: HTMLElement, withSearch: boolean): Coords {
  const rect = trigger.getBoundingClientRect();
  const view = window.visualViewport;
  const viewTop = view ? view.offsetTop : 0;
  const viewBottom = view ? view.offsetTop + view.height : window.innerHeight;
  const viewWidth = document.documentElement.clientWidth || window.innerWidth;
  const extra = withSearch ? SEARCH_ROW : 0;

  const below = viewBottom - rect.bottom - 12;
  const above = rect.top - viewTop - 12;
  const flipped = below < 200 + extra && above > below;

  const width = Math.min(Math.max(rect.width, MIN_PANEL_WIDTH), viewWidth - 16);
  const left = Math.max(8, Math.min(rect.left, viewWidth - 8 - width));

  return {
    top: flipped ? rect.top - 6 : rect.bottom + 6,
    left,
    width,
    maxHeight: Math.max(120, Math.min(300, (flipped ? above : below) - extra)),
    flipped,
  };
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled = false,
  allowClear = false,
  searchable = true,
  id,
  name,
  required,
  invalid,
  busy,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  className,
  look = "site",
}: SearchableSelectProps) {
  const styles = LOOKS[look];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Where focus goes as the list opens: the search box, or the list itself.
  const focusSearch = useRef(true);
  const listboxId = useId();

  // A field switched off while its list is open closes the list.
  const isOpen = open && !disabled;
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const selected = useMemo(() => options.find((option) => option.value === value) || null, [options, value]);
  const filtered = useMemo(() => matching(options, query), [options, query]);
  const activeIndex = Math.min(active, filtered.length - 1);
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const activeId = isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined;

  const place = useCallback(() => {
    if (triggerRef.current) setCoords(measure(triggerRef.current, searchable));
  }, [searchable]);

  // Opening starts from the current selection, so Enter without touching
  // anything is a no-op rather than a silent change to the first option. A
  // character typed on the closed field opens it already searching for it.
  const openList = (seed = "") => {
    if (disabled || !triggerRef.current) return;
    const list = matching(options, seed);
    const current = list.findIndex((option) => option.value === value && !option.disabled);
    setQuery(seed);
    setActive(seed || current < 0 ? firstEnabled(list) : current);
    setCoords(measure(triggerRef.current, searchable));
    focusSearch.current = searchable && (seed !== "" || !isTouchScreen() || options.length > SHORT_LIST);
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;

    (focusSearch.current ? inputRef.current : listRef.current)?.focus();

    const reposition = (event: Event) => {
      // The list's own scrolling moves nothing.
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      place();
    };
    // Capture phase: the field may sit inside a scrolling modal body, whose
    // scroll events do not bubble to window.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen) return;
    const node = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    if (node) (node as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const commit = (option: SearchableSelectOption) => {
    if (option.disabled) return;
    if (option.value !== value) onChange(option.value);
    close(true);
  };

  const search = (next: string) => {
    setQuery(next);
    setActive(firstEnabled(matching(options, next)));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    const inSearch = event.target === inputRef.current;

    if (!isOpen) {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openList();
      } else if (searchable && isPrintable(event)) {
        event.preventDefault();
        openList(event.key);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(nextEnabled(filtered, activeIndex, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(nextEnabled(filtered, activeIndex, -1));
    } else if ((event.key === "Home" || event.key === "End") && !inSearch) {
      // In the search box these move the caret, as in any text box.
      event.preventDefault();
      setActive(event.key === "Home" ? firstEnabled(filtered) : lastEnabled(filtered));
    } else if (event.key === "Enter" || (event.key === " " && !inSearch)) {
      event.preventDefault();
      if (filtered[activeIndex]) commit(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      // Marked as used, so a dialog this field sits in closes the list only.
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      // Back to the field first: Tab then moves on from where the field is,
      // not from the panel, which is drawn at the end of the page.
      close(true);
    } else if (searchable && !inSearch && isPrintable(event)) {
      // Typing while the list has focus goes to the search box.
      event.preventDefault();
      search(query + event.key);
      inputRef.current?.focus();
    }
  };

  const triggerLook =
    typeof className === "function"
      ? className({ open: isOpen })
      : `${className ?? styles.trigger} ${isOpen ? styles.open : ""}`;
  const formInput = name !== undefined || required;

  const trigger = (
    <button
      ref={triggerRef}
      id={id}
      type="button"
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-controls={isOpen ? listboxId : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-invalid={invalid || undefined}
      aria-required={required || undefined}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => (isOpen ? close(false) : openList())}
      onKeyDown={onKeyDown}
      className={`flex w-full items-center gap-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${triggerLook}`}
    >
      <span className={`min-w-0 flex-1 truncate ${selected ? styles.value : styles.placeholder}`}>
        {selected ? selected.label : placeholder}
      </span>

      {allowClear && selected && selected.value !== "" && !disabled && (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Clear selection"
          onClick={(event) => {
            event.stopPropagation();
            onChange("");
          }}
          className={`shrink-0 rounded px-1 ${styles.clear}`}
        >
          ✕
        </span>
      )}

      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className={`h-4 w-4 shrink-0 transition-transform ${styles.icon} ${isOpen ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  const panel =
    isOpen &&
    coords &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={panelRef}
        // A dialog's focus trap treats this as part of the dialog it was opened from.
        data-dialog-popover=""
        style={{
          position: "fixed",
          top: coords.top,
          left: coords.left,
          width: coords.width,
          transform: coords.flipped ? "translateY(-100%)" : undefined,
          zIndex: 70,
        }}
        className={`overflow-hidden ${styles.panel}`}
      >
        {searchable && (
          <div className={styles.searchRow}>
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={activeId}
              aria-label={ariaLabel ? `Search ${ariaLabel}` : "Search"}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
              value={query}
              // Searching is not a change to the form this field sits in:
              // kept from reaching a dialog that watches its fields' changes.
              onChange={(event) => {
                event.stopPropagation();
                search(event.target.value);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className={styles.search}
            />
          </div>
        )}

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={activeId}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          style={{ maxHeight: coords.maxHeight }}
          className={`overflow-y-auto overscroll-contain py-1 focus:outline-none ${styles.list}`}
        >
          {!filtered.length && <p className={styles.empty}>No matches</p>}

          {filtered.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value || `__empty-${index}`}
                id={optionId(index)}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                // Moving the pointer highlights; the list scrolling under a
                // still pointer (arrow keys) does not.
                onMouseMove={() => !option.disabled && index !== activeIndex && setActive(index)}
                // Focus stays in the search box until the pick is made.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(option)}
                className={`${styles.option} ${option.disabled ? styles.unavailable : "cursor-pointer"} ${
                  index === activeIndex && !option.disabled ? styles.active : ""
                } ${option.disabled ? "" : isSelected ? styles.selected : styles.idle}`}
              >
                <span className="block truncate">{option.label}</span>
                {option.hint && <span className={styles.hint}>{option.hint}</span>}
              </div>
            );
          })}
        </div>
      </div>,
      document.body
    );

  if (!formInput) {
    return (
      <>
        {trigger}
        {panel}
      </>
    );
  }

  return (
    <div className="relative">
      {trigger}
      {/* What the form submits and checks. Never seen or tabbed to: the
          browser's "fill out this field" focuses it, and it hands focus to
          the field above. */}
      <input
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={value ?? ""}
        required={required}
        disabled={disabled}
        onChange={() => undefined}
        onFocus={() => triggerRef.current?.focus()}
        autoComplete="off"
        className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
      />
      {panel}
    </div>
  );
}
