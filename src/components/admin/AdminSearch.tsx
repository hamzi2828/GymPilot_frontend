"use client";

// The search box in the admin header. Type two characters or more and it
// asks the backend (GET /admin/search, GymPilot_backend
// src/controller/adminSearchController.js) for members, staff, leads,
// package orders, classes and trainers -- only from the tabs this account's
// role can open, which the backend decides -- and lists a few of each.
//
// ↑ / ↓ move through the results, Enter opens one, Esc closes the list (and a
// second Esc clears the box). Requests are debounced, and an answer that
// arrives after the query has moved on is dropped rather than shown.
//
// Below the md breakpoint there is no room for the box beside the menu
// button, so the header shows a magnifier instead; tapping it lays the box
// over the header until it is closed or a result is opened.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FiSearch, FiX } from "react-icons/fi";
import { API_BASE, apiGet, isSessionEndError } from "@/app/(routes)/admin/_shared/api";

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  /** The admin page the result lives on. */
  href: string;
}

interface SearchGroup {
  key: string;
  label: string;
  href: string;
  results: SearchResult[];
  has_more: boolean;
}

// The backend answers nothing shorter, so neither is it asked.
const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

type Status = "idle" | "loading" | "ready" | "error";

export default function AdminSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  // Bumped by "Try again" to re-run the same query.
  const [attempt, setAttempt] = useState(0);
  // Phones only: whether the box is laid over the header.
  const [expanded, setExpanded] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Which request is the current one; older answers are ignored.
  const latest = useRef(0);
  const listboxId = useId();

  const term = query.trim();
  const results = useMemo(() => groups.flatMap((group) => group.results), [groups]);
  // Where each group's results start in the flat list the arrow keys walk.
  const offsets = useMemo(() => {
    let running = 0;
    return groups.map((group) => {
      const start = running;
      running += group.results.length;
      return start;
    });
  }, [groups]);

  useEffect(() => {
    const ticket = ++latest.current;
    if (term.length < MIN_CHARS) {
      setGroups([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiGet<{ groups?: SearchGroup[] }>(`${API_BASE}/admin/search?q=${encodeURIComponent(term)}`);
        if (ticket !== latest.current) return;
        setGroups(res.groups || []);
        setActive(0);
        setStatus("ready");
      } catch (e) {
        // An ended session is already on its way to the sign-in page.
        if (ticket !== latest.current || isSessionEndError(e)) return;
        setError(e instanceof Error ? e.message : "Search failed — please try again.");
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [term, attempt]);

  // Anywhere else on the page closes the list.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Moving to another page (from here or the sidebar) closes it too.
  useEffect(() => {
    setOpen(false);
    setExpanded(false);
  }, [pathname]);

  // Focus once the box is on screen; a hidden input cannot take it.
  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector(`[data-index="${active}"]`);
    if (node) (node as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const go = (result: SearchResult) => {
    // Only ever somewhere inside the panel.
    if (!result.href.startsWith("/admin")) return;
    setOpen(false);
    setExpanded(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(result.href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      // Not while a newer answer is on its way: the row under the cursor
      // may be about to change.
      if (open && status === "ready" && results[active]) {
        event.preventDefault();
        go(results[active]);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (open) setOpen(false);
      else setQuery("");
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const showList = open && term.length >= MIN_CHARS;
  const activeId = showList && results[active] ? `${listboxId}-${active}` : undefined;

  return (
    <div ref={rootRef} className="md:w-64 lg:w-80">
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 md:hidden"
        aria-label="Search the admin panel"
        title="Search"
      >
        <FiSearch className="h-5 w-5" aria-hidden="true" />
      </button>
      {/* On a phone: over the whole header (which is `relative`) while open.
          From md up: always there, in the header's own flow. */}
      <div
        className={`${
          expanded ? "absolute inset-x-0 top-0 z-40 flex h-16 items-center gap-2 border-b border-neutral-200 bg-white px-4" : "hidden"
        } md:static md:z-auto md:block md:h-auto md:border-0 md:bg-transparent md:p-0`}
      >
        <div className="relative min-w-0 flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            enterKeyHint="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search members, orders, leads…"
            role="combobox"
            aria-label="Search the admin panel"
            aria-expanded={showList}
            aria-controls={showList ? listboxId : undefined}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-8 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus:border-[var(--accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
          />
          {status === "loading" ? (
            <span
              className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-neutral-200 border-t-[var(--accent)]"
              aria-hidden="true"
            />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-neutral-700"
                aria-label="Clear search"
              >
                <FiX className="h-4 w-4" aria-hidden="true" />
              </button>
            )
          )}

          {showList && (
            <div className="absolute left-0 top-full z-40 mt-2 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg shadow-neutral-900/10">
              <div ref={listRef} id={listboxId} role="listbox" aria-label="Search results" className="admin-scroll max-h-[min(28rem,70vh)] overflow-y-auto py-1">
                {status === "error" ? (
                  <div role="alert" className="px-4 py-5 text-center">
                    <p className="text-[13px] text-rose-700">{error}</p>
                    <button
                      type="button"
                      onClick={() => setAttempt((n) => n + 1)}
                      className="mt-2 text-xs font-semibold text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                    >
                      Try again
                    </button>
                  </div>
                ) : !results.length ? (
                  <p className="px-4 py-6 text-center text-[13px] text-neutral-400">
                    {status === "ready" ? `No matches for “${term}”` : "Searching…"}
                  </p>
                ) : (
                  groups.map((group, g) => (
                    <div key={group.key} role="group" aria-label={group.label}>
                      <div className="flex items-center justify-between px-4 pb-1 pt-2.5" aria-hidden="true">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-400">{group.label}</span>
                        {group.has_more && <span className="text-[11px] text-neutral-400">more on the page</span>}
                      </div>
                      {group.results.map((result, i) => {
                        const index = offsets[g] + i;
                        return (
                          <div
                            key={`${group.key}-${result.id}`}
                            id={`${listboxId}-${index}`}
                            data-index={index}
                            role="option"
                            aria-selected={index === active}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => go(result)}
                            className={`cursor-pointer px-4 py-2 ${index === active ? "bg-neutral-100" : ""}`}
                          >
                            <span className="block truncate text-[13px] font-medium text-neutral-800">{result.label}</span>
                            {result.sublabel && <span className="mt-0.5 block truncate text-[11px] text-neutral-500">{result.sublabel}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setOpen(false);
            setQuery("");
          }}
          className="shrink-0 rounded-md px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 md:hidden"
        >
          Close
        </button>
      </div>
    </div>
  );
}
