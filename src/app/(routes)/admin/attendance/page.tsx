"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiDownload, FiRefreshCw, FiSearch, FiSettings, FiX } from "react-icons/fi";
import { PageHeader, Card, Modal, SecondaryButton, Spinner, EmptyState, Select2, useLatestRequest } from "../_shared/ui";
import { ATTENDANCE_API, apiGet, csvField } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import {
  DeskSettingsModal,
  EditTimesModal,
  VoidVisitModal,
  type CorrectionFields,
} from "./CorrectionModals";

// ---------------------------------------------------------------------------
// Shapes, exactly as /api/attendance returns them.
//
// Every time, date and duration here is a STRING the server already formatted
// in the gym's timezone. None of it is re-derived from the raw timestamps in
// the browser: an admin sitting in another timezone must see the same 09:42 AM
// the front desk printed on the receipt.
// ---------------------------------------------------------------------------

interface PunchBy {
  name: string;
  device: string;
  os_user: string;
  method: string;
  ip: string;
  location?: string;
}

// The correction fields (voided / edited, see CorrectionModals) are optional:
// a row reads the same without them.
interface AttendanceRecord extends CorrectionFields {
  id: string;
  person_type: "member" | "staff";
  person_id: string;
  person_name: string;
  person_code: string;
  shift_date: string;
  day_name: string;
  date_label: string;
  // Raw instants, used only to pre-fill a correction in the gym's clock.
  check_in_at?: string | null;
  check_out_at?: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  still_in: boolean;
  // Never checked out, and past the point a scan could close it: shown as
  // "No check-out", with no time out and no duration.
  no_check_out?: boolean;
  worked_minutes: number | null;
  worked_label: string | null;
  // Staff: the ARRIVAL verdict. How the shift ended is departure_*.
  status: string;
  status_label: string;
  variance_minutes: number | null;
  departure_status?: string;
  departure_label?: string;
  departure_variance_minutes?: number | null;
  membership: { status: string; package_name: string; end_date_label: string | null };
  schedule: { has_schedule: boolean; start_time: string; end_time: string; label: string };
  check_in_by: PunchBy | null;
  check_out_by: PunchBy | null;
  visit_number?: number;
}

interface Summary {
  visits: number;
  members: number;
  staff: number;
  unique_people: number;
  still_in: number;
  no_check_out?: number;
  completed: number;
  total_label: string;
  avg_label: string | null;
  late: number;
  left_early?: number;
  overtime?: number;
  membership_issues: number;
  expiring_soon: number;
  by_status: Record<string, number>;
}

interface RangeInfo {
  from: string;
  to: string;
  label: string;
  today: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface RecordsResponse {
  // The gym's IANA zone: the clock a correction is typed in.
  timezone?: string;
  range: RangeInfo;
  summary: Summary;
  pagination: Pagination;
  records: AttendanceRecord[];
}

interface Membership {
  status: string;
  label: string;
  package_name: string;
  end_label: string | null;
  days_left: number | null;
  // The desk's verdict key (membership_active, membership_cancelled, ...),
  // which is what the pill is coloured by when the server sends it.
  verdict?: string;
  sessions_left?: number | null;
}

interface PersonRow {
  person_type: "member" | "staff";
  person_id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  meta: string;
  is_active: boolean;
  visits: number;
  days_present: number;
  total_label: string;
  avg_label: string | null;
  still_in: boolean;
  last_seen_label: string | null;
  last_status: string;
  last_status_label: string;
  membership: Membership | null;
  schedule_days: number | null;
  fingerprints: number;
  lifetime_visits: number;
  ever_seen_label: string | null;
}

interface PeopleResponse {
  range: RangeInfo;
  pagination: Pagination;
  counts: { roster: number; attended: number; absent: number; in_now: number };
  people: PersonRow[];
}

// One visit on the live view of today (GET /api/attendance/live).
interface LiveRecord {
  // Its place in the day's arrivals, 1 = first in; the same whatever the
  // filters, so a row keeps its number from one refresh to the next.
  number: number;
  id: string;
  person_type: "member" | "staff";
  person_id: string;
  code: string;
  name: string;
  phone: string;
  gender: string;
  package_name: string;
  end_date_label: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  still_in: boolean;
  no_check_out: boolean;
  status: string;
  status_label: string;
  // The one word for the Status column: paid | expiring | balance_due |
  // frozen | cancelled | unpaid | suspended | staff.
  standing: { key: string; label: string };
  paid: boolean;
  balance_due: number;
  balance_due_label: string | null;
}

interface LiveResponse {
  today: string;
  date_label: string;
  refreshed_label: string | null;
  // The whole day's, whatever the filters. Members are counted once each.
  counts: { visits: number; members: number; staff: number; in_now: number; paid: number; unpaid: number; balance_due: number };
  truncated?: boolean;
  records: LiveRecord[];
}

interface PersonDetail {
  person: {
    person_type: "member" | "staff";
    person_id: string;
    name: string;
    code: string;
    email: string;
    phone: string;
    role?: string;
    is_active: boolean;
    joined_label: string | null;
    membership: Membership | null;
    schedule: { day: string; start_time: string; end_time: string }[] | null;
    fingerprints: number;
  };
  totals: {
    visits: number;
    days_present: number;
    total_label: string;
    avg_label: string | null;
    first_seen_label: string | null;
    last_seen_label: string | null;
  };
  records: AttendanceRecord[];
}

// ---------------------------------------------------------------------------
// Status vocabulary
//
// Same verdicts and the same three-tier colouring the desktop app uses
// (Theme.StatusColor): green is fine, amber is "act on this while they are
// still standing here", red is a problem. A membership with a week left is
// deliberately neither green nor red.
// ---------------------------------------------------------------------------

// A staff row's `status` is its ARRIVAL, so "early" here is good news; how
// the shift ended has its own vocabulary below, where "early" is not.
const STATUS_TONE: Record<string, "green" | "amber" | "rose" | "blue" | "neutral"> = {
  membership_active: "green",
  on_time: "green",
  early: "green",
  early_arrival: "green",
  overtime: "blue",
  membership_frozen: "blue",
  membership_expiring: "amber",
  membership_past_due: "amber",
  membership_pending: "amber",
  membership_cancelled: "amber",
  late: "amber",
  membership_expired: "rose",
  membership_none: "rose",
  membership_suspended: "rose",
  no_schedule: "neutral",
};

const DEPARTURE_TONE: Record<string, "green" | "amber" | "rose" | "blue" | "neutral"> = {
  on_time: "green",
  early: "amber",
  overtime: "blue",
  no_schedule: "neutral",
};

const TONE_CLASS: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  neutral: "bg-neutral-100 text-neutral-600 ring-neutral-500/15",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses", group: "" },
  { value: "membership_active", label: "Member · Active", group: "member" },
  { value: "membership_expiring", label: "Member · Expiring soon", group: "member" },
  { value: "membership_expired", label: "Member · Expired", group: "member" },
  { value: "membership_none", label: "Member · No package", group: "member" },
  { value: "membership_frozen", label: "Member · Frozen", group: "member" },
  { value: "membership_past_due", label: "Member · Payment overdue", group: "member" },
  { value: "membership_pending", label: "Member · Awaiting payment", group: "member" },
  { value: "membership_suspended", label: "Member · Suspended", group: "member" },
  { value: "membership_cancelled", label: "Member · Cancelled", group: "member" },
  { value: "on_time", label: "Staff · Arrived on time", group: "staff" },
  { value: "late", label: "Staff · Arrived late", group: "staff" },
  { value: "early", label: "Staff · Arrived early", group: "staff" },
  { value: "no_schedule", label: "Staff · Not rostered", group: "staff" },
  // Departures: the server maps these to the check-out verdict.
  { value: "left_early", label: "Staff · Left early", group: "staff" },
  { value: "overtime", label: "Staff · Overtime", group: "staff" },
];

function statusTone(status: string) {
  return STATUS_TONE[status] || "neutral";
}

// The live view's status word, coloured as the desk colours the verdict
// behind it: money owed or running out is amber, not paid is red.
const STANDING_TONE: Record<string, "green" | "amber" | "rose" | "blue" | "neutral"> = {
  paid: "green",
  expiring: "amber",
  balance_due: "amber",
  cancelled: "amber",
  frozen: "blue",
  unpaid: "rose",
  suspended: "rose",
};

// How often the live view asks again while it is on screen.
const LIVE_REFRESH_MS = 15000;

// A roster membership's verdict key: the server's own when it sends one, so
// "Cancelled · 5 days left" is amber and "Frozen" blue exactly as at the desk;
// otherwise the old three-way reading of active / expired / none.
function membershipStatusKey(membership: Membership | null): string {
  if (!membership) return "membership_none";
  if (membership.verdict) return membership.verdict;
  if (membership.status === "active") {
    return membership.days_left !== null && membership.days_left <= 7 ? "membership_expiring" : "membership_active";
  }
  return membership.status === "expired" ? "membership_expired" : "membership_none";
}

// ---------------------------------------------------------------------------
// Date keys
//
// Mirrors timeUtils.shiftDateKey on the server: anchored at noon UTC so adding
// days can never cross a boundary by accident. The gym's "today" comes from
// the API rather than the browser clock, so a laptop in another timezone still
// filters on the gym's day.
// ---------------------------------------------------------------------------

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}-${String(
    anchor.getUTCDate()
  ).padStart(2, "0")}`;
}

function browserToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function presetsFor(today: string) {
  return [
    { id: "today", label: "Today", from: today, to: today },
    { id: "yesterday", label: "Yesterday", from: shiftKey(today, -1), to: shiftKey(today, -1) },
    { id: "week", label: "Last 7 days", from: shiftKey(today, -6), to: today },
    { id: "month", label: "Last 30 days", from: shiftKey(today, -29), to: today },
    { id: "mtd", label: "This month", from: `${today.slice(0, 7)}-01`, to: today },
  ];
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function StatusPill({ status, label, tone }: { status: string; label: string; tone?: string }) {
  if (!label) return <span className="text-neutral-400">—</span>;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        TONE_CLASS[tone || statusTone(status)]
      }`}
    >
      {label}
    </span>
  );
}

// How a staff shift ended, beside how it started. Absent until they leave.
function DeparturePill({ record }: { record: AttendanceRecord }) {
  if (!record.departure_label) return null;
  const status = record.departure_status || "";
  return <StatusPill status={status} label={record.departure_label} tone={DEPARTURE_TONE[status] || "neutral"} />;
}

// A visit nobody checked out of: no time out and no duration, said plainly
// rather than left looking like someone is still inside. With a way to fix it
// for an account that may: a staff visit without one pays no hours.
function NoCheckOut({ onFix }: { onFix?: () => void }) {
  if (!onFix) return <span className="text-[12px] font-medium text-neutral-400">No check-out</span>;
  return (
    <button
      type="button"
      onClick={onFix}
      title="Set the check-out time"
      className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[12px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20 hover:bg-amber-100"
    >
      No check-out · set
    </button>
  );
}

// Corrections the office made, on the row they were made to.
function CorrectionMarks({ record }: { record: AttendanceRecord }) {
  const last = record.last_correction;
  const who = last ? [last.by_name, last.at_label].filter(Boolean).join(", ") : "";
  if (record.voided) {
    return (
      <span
        title={[record.void_reason, who].filter(Boolean).join(" — ")}
        className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/15"
      >
        Voided
      </span>
    );
  }
  if (!record.edited) return null;
  return (
    <span
      title={last && last.action === "edit" ? [last.note, who].filter(Boolean).join(" — ") : "Times corrected by the office"}
      className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 ring-1 ring-inset ring-neutral-500/15"
    >
      Edited
    </span>
  );
}

function TypePill({ type }: { type: "member" | "staff" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        type === "staff"
          ? "bg-violet-50 text-violet-700 ring-violet-600/15"
          : "bg-neutral-100 text-neutral-600 ring-neutral-500/15"
      }`}
    >
      {type === "staff" ? "Staff" : "Member"}
    </span>
  );
}

// A live visit is the one thing on this page that changes while you look at
// it, so it gets a dot rather than another grey time string.
function StillIn() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      Still in
    </span>
  );
}

// Says the view is live -- and when it last heard from the server, so a
// screen left open knows whether what it shows is current.
function LiveIndicator({ live, stale }: { live: LiveResponse | null; stale: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      {stale ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Reconnecting…
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      )}
      {live && <span className="font-medium text-neutral-700">{live.date_label}</span>}
      {live?.refreshed_label && (
        <span className="text-[12px] text-neutral-400">
          {stale ? "as of" : "updated"} {live.refreshed_label} · every 15 s while this tab is open
        </span>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "green" | "amber" | "rose";
}) {
  const valueTone =
    tone === "green"
      ? "text-emerald-600"
      : tone === "amber"
      ? "text-amber-600"
      : tone === "rose"
      ? "text-rose-600"
      : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tracking-tight ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

const fieldCls =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------

type Tab = "live" | "log" | "people";

export default function AttendanceAdminPage() {
  // Opens on today, live: who is in the gym is what the office asks first.
  const [tab, setTab] = useState<Tab>("live");

  // Left empty on first load so the server picks the gym's today, then
  // adopted from its answer. The browser never guesses the gym's date.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [today, setToday] = useState(browserToday());

  const [personType, setPersonType] = useState("all");
  const [status, setStatus] = useState("all");
  const [presence, setPresence] = useState("all");
  const [attended, setAttended] = useState("all");
  const [sort, setSort] = useState("last_seen");

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [counts, setCounts] = useState<PeopleResponse["counts"] | null>(null);
  const [range, setRange] = useState<RangeInfo | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  // The live view: its last answer, and whether the last refresh failed (the
  // rows on screen are then as of the time shown, not now).
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [liveStale, setLiveStale] = useState(false);
  const liveInFlight = useRef(false);
  const liveSeq = useRef(0);

  const [detailFor, setDetailFor] = useState<{ type: string; id: string; name: string } | null>(null);
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Corrections: only for an account that may manage attendance. The server
  // checks the same permission; this only keeps the buttons away from
  // everyone else.
  const { can } = usePermissions();
  const canManage = can("attendance", "manage");
  const [timezone, setTimezone] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [voiding, setVoiding] = useState<AttendanceRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Typing filters the table without a button, but not on every keystroke.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const queryString = useCallback(
    (extra: Record<string, string | number>) => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (personType !== "all") params.set("personType", personType);
      if (q) params.set("q", q);
      for (const [key, value] of Object.entries(extra)) params.set(key, String(value));
      return params.toString();
    },
    [from, to, personType, q]
  );

  // Today, live. `silent` is the timed refresh: no spinner, and a failure
  // keeps the rows on screen (marked as not current) rather than blanking them.
  const loadLive = useCallback(
    async (silent: boolean) => {
      // A timed refresh never piles up behind a slow one; a real ask (new
      // filters, the Refresh button) always goes, and whatever answers after
      // it is dropped.
      if (silent && liveInFlight.current) return;
      const seq = ++liveSeq.current;
      liveInFlight.current = true;
      if (!silent) {
        setLoading(true);
        setErr(null);
      }
      try {
        const params = new URLSearchParams();
        if (personType !== "all") params.set("personType", personType);
        if (q) params.set("q", q);
        const res = await apiGet<LiveResponse>(`${ATTENDANCE_API}/live?${params.toString()}`);
        if (seq !== liveSeq.current) return;
        setLive(res);
        setLiveStale(false);
        if (res.today) setToday(res.today);
      } catch (e) {
        if (seq !== liveSeq.current) return;
        setLiveStale(true);
        if (!silent) setErr(e instanceof Error ? e.message : "Could not load today's attendance.");
      } finally {
        if (seq === liveSeq.current) {
          liveInFlight.current = false;
          setLoading(false);
        }
      }
    },
    [personType, q]
  );

  const begin = useLatestRequest();
  const load = useCallback(async () => {
    // Begun on every tab, so a log or people answer still on its way when
    // the tab changes is dropped too.
    const isLatest = begin();
    if (tab === "live") {
      await loadLive(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      if (tab === "log") {
        const qs = queryString({ status, presence, page, limit });
        const res = await apiGet<RecordsResponse>(`${ATTENDANCE_API}/records?${qs}`);
        if (!isLatest()) return;
        setRecords(res.records || []);
        setSummary(res.summary);
        setPagination(res.pagination);
        setRange(res.range);
        setTimezone(res.timezone);
        if (res.range) {
          setToday(res.range.today);
          if (!from) setFrom(res.range.from);
          if (!to) setTo(res.range.to);
        }
      } else {
        const qs = queryString({ attended, sort, page, limit });
        const res = await apiGet<PeopleResponse>(`${ATTENDANCE_API}/people?${qs}`);
        if (!isLatest()) return;
        setPeople(res.people || []);
        setCounts(res.counts);
        setPagination(res.pagination);
        setRange(res.range);
        if (res.range) {
          setToday(res.range.today);
          if (!from) setFrom(res.range.from);
          if (!to) setTo(res.range.to);
        }
      }
    } catch (e) {
      if (!isLatest()) return;
      setErr(e instanceof Error ? e.message : "Could not load attendance.");
      setRecords([]);
      setPeople([]);
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [tab, loadLive, queryString, status, presence, attended, sort, page, limit, from, to, begin]);

  useEffect(() => {
    load();
  }, [load]);

  // The live view keeps itself current while it is on screen: every 15 s
  // while the browser tab is visible, paused while it is hidden (nobody is
  // looking, and a tab left open all day must not poll all night), and
  // caught up the moment it is shown again.
  useEffect(() => {
    if (tab !== "live") return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => loadLive(true), LIVE_REFRESH_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        loadLive(true);
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tab, loadLive]);

  // A correction saved: close whatever asked for it, say so, and re-read the
  // page -- the totals above the table change with it.
  const corrected = (message: string) => {
    setEditing(null);
    setVoiding(null);
    setSettingsOpen(false);
    setNotice(message);
    load();
  };

  const showMissed = (missedOnly: boolean) => {
    setPresence(missedOnly ? "missed" : "all");
    setPage(1);
  };

  const openDetail = async (person: { type: string; id: string; name: string }) => {
    setDetailFor(person);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await apiGet<PersonDetail>(`${ATTENDANCE_API}/person/${person.type}/${person.id}?limit=60`);
      setDetail(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load that history.");
      setDetailFor(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const presets = useMemo(() => presetsFor(today), [today]);
  const activePreset = presets.find((p) => p.from === from && p.to === to)?.id || "custom";

  const applyPreset = (preset: { from: string; to: string }) => {
    setFrom(preset.from);
    setTo(preset.to);
    setPage(1);
  };

  const resetFilters = () => {
    setFrom(today);
    setTo(today);
    setPersonType("all");
    setStatus("all");
    setPresence("all");
    setAttended("all");
    setSort("last_seen");
    setSearch("");
    setQ("");
    setPage(1);
  };

  // The live view has only two filters; its dates are always today.
  const filtersDirty =
    tab === "live"
      ? personType !== "all" || !!q
      : personType !== "all" ||
        status !== "all" ||
        presence !== "all" ||
        attended !== "all" ||
        !!q ||
        activePreset !== "today";

  // Export covers the WHOLE filtered range — every page, in the same order,
  // under the same filters — not just the rows on screen. It walks the same
  // endpoint the table reads, so a spreadsheet cannot disagree with it.
  const exportCsv = async () => {
    // Quoted, and never a formula (see csvField).
    const escape = csvField;
    const pageSize = 500; // the server's own ceiling per page
    let header: string[];
    let lines: string[][];

    setExporting(true);
    setErr(null);
    try {
      if (tab === "live") {
        // Today as it stands now, under the same filters, oldest first.
        const params = new URLSearchParams();
        if (personType !== "all") params.set("personType", personType);
        if (q) params.set("q", q);
        const res = await apiGet<LiveResponse>(`${ATTENDANCE_API}/live?${params.toString()}`);
        header = ["#", "Time in", "Time out", "Member ID", "Name", "Contact", "Gender", "Package", "Next expiry", "Status", "Balance due"];
        lines = [...(res.records || [])].reverse().map((r) => [
          String(r.number),
          r.check_in_time || "",
          r.check_out_time || (r.still_in ? "Still in" : r.no_check_out ? "No check-out" : ""),
          r.code,
          r.name,
          r.phone,
          r.gender,
          r.person_type === "staff" ? "Staff" : r.package_name,
          r.end_date_label || "",
          r.standing.label,
          r.balance_due ? String(r.balance_due) : "",
        ]);
      } else if (tab === "log") {
        const all: AttendanceRecord[] = [];
        for (let p = 1; ; p++) {
          // summary=0: the range summary is already on screen; recounting it
          // for every page would only slow the export down.
          const qs = queryString({ status, presence, page: p, limit: pageSize, summary: 0 });
          const res = await apiGet<RecordsResponse>(`${ATTENDANCE_API}/records?${qs}`);
          all.push(...(res.records || []));
          if (!res.records?.length || !res.pagination || p >= res.pagination.pages) break;
        }

        header = ["Date", "Day", "Type", "Name", "Code", "Check in", "Check out", "Duration", "Status", "Departure", "Checked in by", "Device", "Correction"];
        lines = all.map((r) => [
          r.date_label,
          r.day_name,
          r.person_type,
          r.person_name,
          r.person_code,
          r.check_in_time || "",
          r.check_out_time || (r.still_in ? "Still in" : r.no_check_out ? "No check-out" : ""),
          r.worked_label || "",
          r.status_label,
          r.departure_label || "",
          r.check_in_by?.name || "",
          r.check_in_by?.device || "",
          r.voided ? `Voided: ${r.void_reason || ""}` : r.edited ? "Times edited" : "",
        ]);
      } else {
        const all: PersonRow[] = [];
        for (let p = 1; ; p++) {
          const qs = queryString({ attended, sort, page: p, limit: pageSize });
          const res = await apiGet<PeopleResponse>(`${ATTENDANCE_API}/people?${qs}`);
          all.push(...(res.people || []));
          if (!res.people?.length || !res.pagination || p >= res.pagination.pages) break;
        }

        header = ["Type", "Name", "Code", "Email", "Phone", "Visits", "Days present", "Total time", "Average", "Last seen", "Membership", "Fingerprints"];
        lines = all.map((p) => [
          p.person_type,
          p.name,
          p.code,
          p.email,
          p.phone,
          String(p.visits),
          String(p.days_present),
          p.total_label,
          p.avg_label || "",
          p.last_seen_label || p.ever_seen_label || "Never",
          p.membership?.label || p.meta || "",
          String(p.fingerprints),
        ]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not export attendance.");
      return;
    } finally {
      setExporting(false);
    }

    const csv = [header, ...lines].map((row) => row.map(escape).join(",")).join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      tab === "live" ? `attendance-today-${live?.today || today}.csv` : `attendance-${tab}-${from || today}-to-${to || today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const statusOptions = STATUS_OPTIONS.filter(
    (option) => !option.group || personType === "all" || option.group === personType
  );

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Attendance"
        actions={
          <>
            {canManage && (
              <SecondaryButton onClick={() => setSettingsOpen(true)}>
                <FiSettings className="mr-1.5 h-4 w-4" /> Desk settings
              </SecondaryButton>
            )}
            <SecondaryButton
              onClick={exportCsv}
              disabled={
                loading ||
                exporting ||
                (tab === "live" ? !live?.records.length : tab === "log" ? !records.length : !people.length)
              }
            >
              <FiDownload className="mr-1.5 h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
            </SecondaryButton>
            <SecondaryButton onClick={load} disabled={loading}>
              <FiRefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </SecondaryButton>
          </>
        }
      />

      {/* ---- Filters ---- */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {tab === "live" ? (
            <LiveIndicator live={live} stale={liveStale} />
          ) : (
            <>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`h-8 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                    activePreset === preset.id
                      ? "bg-neutral-900 text-white"
                      : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              {activePreset === "custom" && (
                <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-[12px] font-medium text-neutral-600">
                  Custom range
                </span>
              )}
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            {filtersDirty && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
              >
                <FiX className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
            {tab !== "live" && range && <span className="text-[12px] text-neutral-400">{range.label}</span>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* The live view is always today: no dates to pick. */}
          {tab !== "live" && (
            <>
              <Field label="From">
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                  className={fieldCls}
                />
              </Field>

              <Field label="To">
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                  className={fieldCls}
                />
              </Field>
            </>
          )}

          <Field label="Person type">
            <Select2
              ariaLabel="Person type"
              value={personType}
              onChange={(v) => {
                setPersonType(v);
                setStatus("all");
                setPage(1);
              }}
              options={[
                { value: "all", label: "Members & staff" },
                { value: "member", label: "Members only" },
                { value: "staff", label: "Staff only" },
              ]}
            />
          </Field>

          {tab === "log" ? (
            <>
              <Field label="Status">
                <Select2
                  ariaLabel="Status"
                  value={status}
                  onChange={(v) => {
                    setStatus(v);
                    setPage(1);
                  }}
                  options={statusOptions.map((option) => {
                    const count = summary?.by_status?.[option.value];
                    return {
                      value: option.value,
                      label: option.label,
                      hint:
                        option.value !== "all"
                          ? `${count || 0} in this range`
                          : undefined,
                    };
                  })}
                />
              </Field>

              <Field label="Presence">
                <Select2
                  ariaLabel="Presence"
                  value={presence}
                  onChange={(v) => {
                    setPresence(v);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "Any" },
                    { value: "in", label: "Still checked in" },
                    { value: "out", label: "Checked out" },
                    { value: "missed", label: "No check-out" },
                  ]}
                />
              </Field>
            </>
          ) : tab === "live" ? null : (
            <>
              <Field label="Turned up">
                <Select2
                  ariaLabel="Turned up"
                  value={attended}
                  onChange={(v) => {
                    setAttended(v);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "Everyone" },
                    { value: "attended", label: "Attended in range" },
                    { value: "absent", label: "No visits in range" },
                    { value: "in", label: "In the gym now" },
                  ]}
                />
              </Field>

              <Field label="Sort by">
                <Select2
                  ariaLabel="Sort by"
                  value={sort}
                  onChange={(v) => {
                    setSort(v);
                    setPage(1);
                  }}
                  options={[
                    { value: "last_seen", label: "Last seen" },
                    { value: "visits", label: "Most visits" },
                    { value: "time", label: "Most time" },
                    { value: "name", label: "Name (A–Z)" },
                  ]}
                />
              </Field>
            </>
          )}

          <Field label="Search">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or code…"
                className={`${fieldCls} pl-9`}
              />
            </div>
          </Field>
        </div>
      </Card>

      {/* ---- Summary ---- */}
      {tab === "live" && live && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat
            label="In the gym"
            value={live.counts.in_now}
            tone={live.counts.in_now ? "green" : "neutral"}
            hint="right now"
          />
          <Stat
            label="Visits today"
            value={live.counts.visits}
            hint={`${live.counts.members} member${live.counts.members === 1 ? "" : "s"} · ${live.counts.staff} staff`}
          />
          <Stat label="Paid" value={live.counts.paid} tone={live.counts.paid ? "green" : "neutral"} hint="members on a running paid package" />
          <Stat
            label="Unpaid"
            value={live.counts.unpaid}
            tone={live.counts.unpaid ? "rose" : "neutral"}
            hint="expired, no package or not paid yet"
          />
          <Stat
            label="Balance due"
            value={live.counts.balance_due}
            tone={live.counts.balance_due ? "amber" : "neutral"}
            hint="paid members still owing on their package"
          />
        </div>
      )}

      {tab === "log" && summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Stat label="Visits" value={summary.visits} hint={`${summary.members} member · ${summary.staff} staff`} />
          <Stat label="People" value={summary.unique_people} hint="distinct in range" />
          <Stat
            label="In the gym"
            value={summary.still_in}
            tone={summary.still_in ? "green" : "neutral"}
            hint={summary.no_check_out ? `${summary.no_check_out} never checked out` : "right now"}
          />
          <Stat label="Total time" value={summary.total_label} hint={summary.avg_label ? `avg ${summary.avg_label}` : "no closed visits"} />
          <Stat
            label="Late arrivals"
            value={summary.late}
            tone={summary.late ? "amber" : "neutral"}
            hint={summary.left_early ? `${summary.left_early} left early` : "staff, past grace"}
          />
          <Stat
            label="Membership issues"
            value={summary.membership_issues}
            tone={summary.membership_issues ? "rose" : "neutral"}
            hint={summary.expiring_soon ? `${summary.expiring_soon} expiring soon` : "expired, none or suspended"}
          />
        </div>
      )}

      {/* ---- Visits with no check-out: one click to the list that needs fixing ---- */}
      {tab === "log" && summary && (presence === "missed" || !!summary.no_check_out) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-[13px] text-amber-900">
            {presence === "missed"
              ? "Showing only visits that ended with no check-out."
              : `${summary.no_check_out} visit${summary.no_check_out === 1 ? "" : "s"} in this range ended with no check-out.`}{" "}
            <span className="text-amber-800/80">
              A staff visit without one pays no hours
              {canManage ? " — set the time from the row." : " until someone with manage access sets the time."}
            </span>
          </p>
          <button
            type="button"
            onClick={() => showMissed(presence !== "missed")}
            className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-[13px] font-medium text-amber-900 hover:bg-amber-50"
          >
            {presence === "missed" ? "Show all visits" : "Show them"}
          </button>
        </div>
      )}

      {notice && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-700">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-emerald-600 hover:text-emerald-800">
            <FiX className="h-4 w-4" />
          </button>
        </div>
      )}

      {tab === "people" && counts && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="On the roster" value={counts.roster} hint="members and staff" />
          <Stat label="Attended" value={counts.attended} tone={counts.attended ? "green" : "neutral"} hint="at least one visit" />
          <Stat label="No visits" value={counts.absent} tone={counts.absent ? "amber" : "neutral"} hint="in the selected range" />
          <Stat label="In the gym" value={counts.in_now} tone={counts.in_now ? "green" : "neutral"} hint="right now" />
        </div>
      )}

      {/* ---- Tabs ---- */}
      <div className="mb-4 flex items-center gap-1 border-b border-neutral-200">
        {([
          { id: "live", label: "Today · live" },
          { id: "log", label: "Punch log" },
          { id: "people", label: "By person" },
        ] as { id: Tab; label: string }[]).map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              setTab(entry.id);
              setPage(1);
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === entry.id
                ? "border-[var(--accent)] text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">{err}</div>
      )}

      {loading ? (
        <Spinner />
      ) : tab === "live" ? (
        <LiveTable records={live?.records || []} truncated={!!live?.truncated} onOpen={openDetail} />
      ) : tab === "log" ? (
        <LogTable
          records={records}
          onOpen={openDetail}
          onEdit={canManage ? setEditing : undefined}
          onVoid={canManage ? setVoiding : undefined}
        />
      ) : (
        <PeopleTable people={people} onOpen={openDetail} />
      )}

      {/* ---- Paging (the live view is the whole of today, unpaged) ---- */}
      {tab !== "live" && !loading && pagination && pagination.total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-neutral-500">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-32">
              <Select2
                ariaLabel="Rows per page"
                size="sm"
                value={String(limit)}
                onChange={(v) => {
                  setLimit(Number(v));
                  setPage(1);
                }}
                options={[25, 50, 100, 200].map((n) => ({ value: String(n), label: `${n} per page` }))}
              />
            </div>
            <SecondaryButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1}>
              Previous
            </SecondaryButton>
            <span className="text-[12px] text-neutral-500">
              {pagination.page} / {pagination.pages}
            </span>
            <SecondaryButton
              onClick={() => setPage((p) => p + 1)}
              disabled={pagination.page >= pagination.pages}
            >
              Next
            </SecondaryButton>
          </div>
        </div>
      )}

      <PersonModal
        open={!!detailFor}
        name={detailFor?.name || ""}
        loading={detailLoading}
        detail={detail}
        onClose={() => {
          setDetailFor(null);
          setDetail(null);
        }}
      />

      {editing && (
        <EditTimesModal
          key={editing.id}
          record={editing}
          timezone={timezone}
          onClose={() => setEditing(null)}
          onSaved={corrected}
        />
      )}
      {voiding && (
        <VoidVisitModal key={voiding.id} record={voiding} onClose={() => setVoiding(null)} onVoided={corrected} />
      )}
      {settingsOpen && <DeskSettingsModal onClose={() => setSettingsOpen(false)} onSaved={corrected} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Today, live
// ---------------------------------------------------------------------------

function LiveTable({
  records,
  truncated,
  onOpen,
}: {
  records: LiveRecord[];
  truncated: boolean;
  onOpen: (person: { type: string; id: string; name: string }) => void;
}) {
  if (!records.length) {
    return (
      <EmptyState
        title="Nobody has checked in yet today"
        hint="Visits appear here within seconds of the front desk or the kiosk recording them."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80">
              {["#", "Time in", "Time out", "Member ID", "Name", "Contact", "Gender", "Package", "Next expiry", "Status", ""].map(
                (column) => (
                  <th
                    key={column}
                    className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500"
                  >
                    {column}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const tone =
                record.standing.key === "staff" ? statusTone(record.status) : STANDING_TONE[record.standing.key] || "neutral";
              // The desk's own words under the one-word status, when they add
              // something ("Expired 3 days ago", "4 days left").
              const detail = record.standing.key === "staff" ? "" : record.status_label;
              return (
                <tr key={record.id} className="border-b border-neutral-100 transition-colors last:border-b-0 hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums text-neutral-400">{record.number}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle font-medium text-neutral-800">
                    {record.check_in_time || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle">
                    {record.still_in ? (
                      <StillIn />
                    ) : record.no_check_out ? (
                      <NoCheckOut />
                    ) : (
                      <span className="font-medium text-neutral-800">{record.check_out_time || "—"}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle font-mono text-[12px] text-neutral-700">
                    {record.code || "—"}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900">{record.name}</span>
                      {record.person_type === "staff" && <TypePill type="staff" />}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-neutral-700">
                    {record.phone ? (
                      <a href={`tel:${record.phone.replace(/[^\d+]/g, "")}`} className="hover:text-[var(--accent)]">
                        {record.phone}
                      </a>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle capitalize text-neutral-700">
                    {record.gender || <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 align-middle text-neutral-700">
                    {record.person_type === "staff" ? (
                      <span className="text-neutral-400">—</span>
                    ) : (
                      record.package_name || <span className="text-neutral-400">None</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-neutral-700">
                    {record.end_date_label || <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusPill status={record.status} label={record.standing.label} tone={tone} />
                      {record.balance_due_label && record.standing.key !== "balance_due" && (
                        <StatusPill status="" label={record.balance_due_label} tone="amber" />
                      )}
                    </div>
                    {detail && detail !== record.standing.label && (
                      <div className="mt-0.5 text-[11px] text-neutral-400">{detail}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                    <button
                      type="button"
                      onClick={() => onOpen({ type: record.person_type, id: record.person_id, name: record.name })}
                      className="text-[12px] font-semibold text-neutral-500 hover:text-[var(--accent)]"
                    >
                      History
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {truncated && (
        <p className="border-t border-neutral-100 px-4 py-2 text-[12px] text-amber-700">
          More visits today than this view reads at once; the Punch log has all of them.
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Punch log
// ---------------------------------------------------------------------------

// onEdit / onVoid are given only to an account that may manage attendance.
function LogTable({
  records,
  onOpen,
  onEdit,
  onVoid,
}: {
  records: AttendanceRecord[];
  onOpen: (person: { type: string; id: string; name: string }) => void;
  onEdit?: (record: AttendanceRecord) => void;
  onVoid?: (record: AttendanceRecord) => void;
}) {
  if (!records.length) {
    return (
      <EmptyState
        title="No attendance in this range"
        hint="Widen the dates, or clear the filters. Punches appear here the moment the front desk records them."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80">
              {["Person", "Day", "Check in", "Check out", "Duration", "Status", "Recorded by", ""].map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              // A voided visit is shown for the record, greyed, and is done with:
              // nothing more to correct on it.
              const correctable = !record.voided;
              return (
                <tr
                  key={record.id}
                  className={`border-b border-neutral-100 transition-colors last:border-b-0 hover:bg-neutral-50 ${
                    record.voided ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-5 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-neutral-900 ${record.voided ? "line-through" : ""}`}>
                        {record.person_name}
                      </span>
                      <TypePill type={record.person_type} />
                      <CorrectionMarks record={record} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-neutral-400">
                      {record.person_code || "no code"}
                      {record.person_type === "member" && record.membership.package_name
                        ? ` · ${record.membership.package_name}`
                        : ""}
                      {record.person_type === "staff" && record.schedule.has_schedule
                        ? ` · rostered ${record.schedule.label}`
                        : ""}
                    </div>
                  </td>
  
                  <td className="whitespace-nowrap px-5 py-3 align-middle">
                    <div className="text-neutral-800">{record.date_label}</div>
                    <div className="text-[11px] text-neutral-400">{record.day_name}</div>
                  </td>
  
                  <td className="whitespace-nowrap px-5 py-3 align-middle font-medium text-neutral-800">
                    {record.check_in_time || "—"}
                  </td>
  
                  <td className="whitespace-nowrap px-5 py-3 align-middle">
                    {record.still_in ? (
                      <StillIn />
                    ) : record.no_check_out ? (
                      <NoCheckOut onFix={onEdit && correctable ? () => onEdit(record) : undefined} />
                    ) : (
                      <span className="font-medium text-neutral-800">{record.check_out_time || "—"}</span>
                    )}
                  </td>
  
                  <td className="whitespace-nowrap px-5 py-3 align-middle text-neutral-700">
                    {record.worked_label || <span className="text-neutral-400">—</span>}
                  </td>
  
                  <td className="px-5 py-3 align-middle">
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusPill status={record.status} label={record.status_label} />
                      <DeparturePill record={record} />
                    </div>
                  </td>
  
                  <td className="px-5 py-3 align-middle">
                    <div className="text-[12px] text-neutral-700">{record.check_in_by?.name || "—"}</div>
                    <div className="text-[11px] text-neutral-400">
                      {[record.check_in_by?.device, record.check_in_by?.method].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
  
                  <td className="whitespace-nowrap px-5 py-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-3">
                      {onEdit && correctable && (
                        <button
                          type="button"
                          onClick={() => onEdit(record)}
                          className="text-[12px] font-semibold text-neutral-500 hover:text-[var(--accent)]"
                        >
                          Edit times
                        </button>
                      )}
                      {onVoid && correctable && (
                        <button
                          type="button"
                          onClick={() => onVoid(record)}
                          className="text-[12px] font-semibold text-neutral-500 hover:text-rose-600"
                        >
                          Void
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpen({ type: record.person_type, id: record.person_id, name: record.person_name })}
                        className="text-[12px] font-semibold text-neutral-500 hover:text-[var(--accent)]"
                      >
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-person roster
// ---------------------------------------------------------------------------

function PeopleTable({
  people,
  onOpen,
}: {
  people: PersonRow[];
  onOpen: (person: { type: string; id: string; name: string }) => void;
}) {
  if (!people.length) {
    return <EmptyState title="Nobody matches these filters" hint="Try a wider range or clear the search." />;
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80">
              {["Person", "Standing", "Visits", "Days", "Time in range", "Last seen", "Finger", ""].map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr
                key={`${person.person_type}:${person.person_id}`}
                className="border-b border-neutral-100 transition-colors last:border-b-0 hover:bg-neutral-50"
              >
                <td className="px-5 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">{person.name}</span>
                    <TypePill type={person.person_type} />
                    {person.still_in && <StillIn />}
                    {!person.is_active && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">Inactive</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-neutral-400">
                    {[person.code || "no code", person.email || person.phone].filter(Boolean).join(" · ")}
                  </div>
                </td>

                <td className="px-5 py-3 align-middle">
                  {person.person_type === "member" ? (
                    <>
                      <StatusPill
                        status={membershipStatusKey(person.membership)}
                        label={person.membership?.label || "No package on file"}
                      />
                      {person.membership?.package_name && (
                        <div className="mt-0.5 text-[11px] text-neutral-400">{person.membership.package_name}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-neutral-700">{person.meta || "Trainer"}</span>
                      <div className="mt-0.5 text-[11px] text-neutral-400">
                        {person.schedule_days ? `${person.schedule_days} rostered days` : "No roster set"}
                      </div>
                    </>
                  )}
                </td>

                <td className="px-5 py-3 align-middle">
                  <span className={person.visits ? "font-semibold text-neutral-900" : "text-neutral-400"}>
                    {person.visits}
                  </span>
                  {person.lifetime_visits > person.visits && (
                    <div className="text-[11px] text-neutral-400">{person.lifetime_visits} all time</div>
                  )}
                </td>

                <td className="px-5 py-3 align-middle text-neutral-700">{person.days_present || "—"}</td>

                <td className="whitespace-nowrap px-5 py-3 align-middle text-neutral-700">
                  {person.visits ? person.total_label : <span className="text-neutral-400">—</span>}
                  {person.avg_label && <div className="text-[11px] text-neutral-400">avg {person.avg_label}</div>}
                </td>

                <td className="whitespace-nowrap px-5 py-3 align-middle">
                  {person.last_seen_label ? (
                    <span className="text-neutral-700">{person.last_seen_label}</span>
                  ) : person.ever_seen_label ? (
                    <div>
                      <span className="text-neutral-400">Not in range</span>
                      <div className="text-[11px] text-neutral-400">last {person.ever_seen_label}</div>
                    </div>
                  ) : (
                    <span className="text-amber-600">Never checked in</span>
                  )}
                </td>

                <td className="px-5 py-3 align-middle">
                  {person.fingerprints ? (
                    <span className="text-[12px] text-neutral-600">
                      {person.fingerprints} enrolled
                    </span>
                  ) : (
                    <span className="text-[12px] text-neutral-400">Not enrolled</span>
                  )}
                </td>

                <td className="whitespace-nowrap px-5 py-3 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => onOpen({ type: person.person_type, id: person.person_id, name: person.name })}
                    className="text-[12px] font-semibold text-neutral-500 hover:text-[var(--accent)]"
                  >
                    History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// One person's history
//
// Laid out as the desktop receipt is: who they are, the one line the desk
// would have to act on, then every visit with both halves of the punch and
// who recorded each.
// ---------------------------------------------------------------------------

function DetailRow({ caption, value }: { caption: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{caption}</span>
      <span className="text-right text-[13px] text-neutral-800">{value}</span>
    </div>
  );
}

function PersonModal({
  open,
  name,
  loading,
  detail,
  onClose,
}: {
  open: boolean;
  name: string;
  loading: boolean;
  detail: PersonDetail | null;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={name || "Attendance history"} size="lg">
      {loading || !detail ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          {/* Identity */}
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-neutral-900">{detail.person.name}</span>
                <TypePill type={detail.person.person_type} />
                {!detail.person.is_active && (
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600">Inactive</span>
                )}
              </div>
              <p className="mt-1 text-[12px] text-neutral-500">
                {[
                  detail.person.code || "no code",
                  detail.person.email,
                  detail.person.phone,
                  detail.person.role,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            </div>
            <div className="text-right">
              {detail.person.membership && (
                <StatusPill
                  status={membershipStatusKey(detail.person.membership)}
                  label={detail.person.membership.label}
                />
              )}
              <p className="mt-1 text-[11px] text-neutral-400">
                {detail.person.fingerprints
                  ? `${detail.person.fingerprints} finger${detail.person.fingerprints === 1 ? "" : "s"} enrolled`
                  : "No fingerprint enrolled"}
              </p>
            </div>
          </div>

          {/* Lifetime totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Visits" value={detail.totals.visits} hint="all time" />
            <Stat label="Days present" value={detail.totals.days_present} />
            <Stat label="Total time" value={detail.totals.total_label} hint={detail.totals.avg_label ? `avg ${detail.totals.avg_label}` : undefined} />
            <Stat label="Last seen" value={detail.totals.last_seen_label || "Never"} hint={detail.totals.first_seen_label ? `first ${detail.totals.first_seen_label}` : undefined} />
          </div>

          {/* Roster, for staff */}
          {detail.person.schedule && detail.person.schedule.length > 0 && (
            <div className="rounded-xl border border-neutral-200 px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Rostered hours</p>
              <div className="flex flex-wrap gap-2">
                {detail.person.schedule.map((slot) => (
                  <span key={slot.day} className="rounded-lg bg-neutral-100 px-2.5 py-1 text-[12px] text-neutral-700">
                    {slot.day.slice(0, 3)} {slot.start_time}–{slot.end_time}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Visits */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Recent visits ({detail.records.length})
            </p>

            {!detail.records.length ? (
              <EmptyState title="No visits recorded yet" hint="Nothing has been punched for this person." />
            ) : (
              <div className="space-y-2">
                {detail.records.map((record) => (
                  <div key={record.id} className="rounded-xl border border-neutral-200 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[13px] font-semibold text-neutral-900">{record.date_label}</span>
                        <span className="ml-2 text-[12px] text-neutral-400">{record.day_name}</span>
                        {record.visit_number && record.person_type === "member" && (
                          <span className="ml-2 text-[11px] text-neutral-400">visit #{record.visit_number} that month</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <CorrectionMarks record={record} />
                        <StatusPill status={record.status} label={record.status_label} />
                        <DeparturePill record={record} />
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                      <DetailRow caption="Check in" value={record.check_in_time || "—"} />
                      <DetailRow
                        caption="Check out"
                        value={
                          record.still_in ? <StillIn /> : record.no_check_out ? <NoCheckOut /> : record.check_out_time || "—"
                        }
                      />
                      <DetailRow
                        caption={record.person_type === "member" ? "Duration" : "Worked"}
                        value={record.worked_label || "—"}
                      />
                      <DetailRow
                        caption={record.person_type === "member" ? "Package" : "Shift"}
                        value={
                          record.person_type === "member"
                            ? record.membership.package_name || "None"
                            : record.schedule.label
                        }
                      />
                      <DetailRow
                        caption="In by"
                        value={
                          record.check_in_by?.name
                            ? [record.check_in_by.name, record.check_in_by.device, record.check_in_by.location]
                                .filter(Boolean)
                                .join(" · ")
                            : "—"
                        }
                      />
                      <DetailRow
                        caption="Out by"
                        value={
                          record.check_out_by?.name
                            ? [record.check_out_by.name, record.check_out_by.device, record.check_out_by.location]
                                .filter(Boolean)
                                .join(" · ")
                            : "—"
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
