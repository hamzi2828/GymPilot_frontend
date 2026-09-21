"use client";

// The member picker for the desk screens -- lockers, the till, class and PT
// bookings, messaging, package orders -- and the staff list on Trainers.
//
// It searches on the server (/admin/members/options) a page at a time rather
// than downloading every account to filter in the browser. That endpoint is
// open to any staff account, so a receptionist without the Users tab still
// gets a working picker instead of a silently empty one.

import { useEffect, useState } from "react";
import { API_BASE, apiGet } from "../_shared/api";
import { TextField } from "../_shared/ui";

export interface MemberOption {
  id: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  member_code: string;
  job_title: string;
}

export type MemberType = "member" | "staff";

const OPTIONS_API = `${API_BASE}/admin/members/options`;

// Long enough that a name typed at normal speed is one request, short enough
// that the list still feels like it answers the keyboard.
const DEBOUNCE_MS = 250;

/**
 * Server-side search, debounced. An empty query returns the first page
 * alphabetically, which is what a short list (staff, a small gym) wants.
 */
export function useMemberSearch(
  query: string,
  { type, limit = 20, enabled = true }: { type?: MemberType; limit?: number; enabled?: boolean } = {}
) {
  const [results, setResults] = useState<MemberOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const term = query.trim();

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (term) params.set("q", term);
        if (type) params.set("type", type);
        const r = await apiGet<{ data?: MemberOption[]; has_more?: boolean }>(`${OPTIONS_API}?${params.toString()}`);
        if (cancelled) return;
        setResults(r.data || []);
        setHasMore(!!r.has_more);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setResults([]);
        setHasMore(false);
        setError(e instanceof Error ? e.message : "Could not search members");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, term ? DEBOUNCE_MS : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, type, limit, enabled]);

  return { results, hasMore, loading, error };
}

/**
 * Type to search, click to choose. Once chosen the field collapses to the
 * member's name with a "Change" link, so it is obvious who the action is for.
 *
 * `listWhenEmpty` shows the first page before anything is typed -- right for
 * a modal given over to picking someone, wrong for the till's optional field.
 */
export function MemberPicker({
  label = "Member",
  value,
  onChange,
  type,
  placeholder = "Name, email, phone or code",
  listWhenEmpty = false,
  disabled = false,
}: {
  label?: string;
  value: MemberOption | null;
  onChange: (member: MemberOption | null) => void;
  type?: MemberType;
  placeholder?: string;
  listWhenEmpty?: boolean;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const searching = !value && !disabled && (listWhenEmpty || !!query.trim());
  const { results, hasMore, loading, error } = useMemberSearch(query, { type, enabled: searching });

  if (value) {
    return (
      <div className="block">
        <span className="text-xs font-semibold text-neutral-700">{label}</span>
        <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            <span className="font-medium text-neutral-900">{value.name}</span>
            <span className="text-xs text-neutral-500">
              {" "}
              {[value.email, value.member_code].filter(Boolean).join(" · ")}
            </span>
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                onChange(null);
              }}
              className="shrink-0 text-xs font-semibold text-neutral-600 underline hover:text-neutral-900"
            >
              Change
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="block">
      <TextField label={label} value={query} onChange={setQuery} placeholder={placeholder} />
      {searching && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-200 admin-scroll">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setQuery("");
                onChange(m);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50"
            >
              <span className="min-w-0 truncate text-neutral-900">
                {m.name}
                {m.job_title && <span className="text-xs text-neutral-500"> — {m.job_title}</span>}
              </span>
              <span className="shrink-0 text-xs text-neutral-500">
                {[m.email, m.phone, m.member_code].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
          {loading && !results.length && <p className="px-3 py-2 text-xs text-neutral-500">Searching…</p>}
          {!loading && error && <p className="px-3 py-2 text-xs text-rose-600">{error}</p>}
          {!loading && !error && !results.length && <p className="px-3 py-2 text-xs text-neutral-500">No matches.</p>}
          {hasMore && <p className="border-t border-neutral-100 px-3 py-2 text-[11px] text-neutral-400">More matches — keep typing to narrow it down.</p>}
        </div>
      )}
    </div>
  );
}
