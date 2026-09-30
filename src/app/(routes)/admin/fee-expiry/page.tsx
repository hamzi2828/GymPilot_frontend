"use client";

// Fee expiry: the desk's call list. Whose membership is about to run out
// (Expiring), whose has run out without a renewal, paid or never paid
// (Expired / unpaid), and who still owes money on what they hold (Dues).
// Each row leads to Collect fees for that member. The lists come from the
// backend's services/membershipLists.js (package-orders · view); the tab and
// the window live in the address, so the dashboard's "Fees due" card links
// straight in (?days=7).

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FiChevronDown, FiDownload, FiPrinter } from "react-icons/fi";
import { PageHeader, Card, SecondaryButton, Badge, Spinner, EmptyState, ErrorState } from "../_shared/ui";
import { GYMFOLIO_API, apiGet, replaceParams } from "../_shared/api";
import { Pager, pageCount } from "../_ops/lists";
import { PrintStyles, printReport } from "../reports/Print";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { useSiteSettings } from "@/components/ThemeProvider";

const PAGE_SIZE = 50;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 365;
// The backend's own ceiling for "ended in the last N days".
const MAX_WITHIN_DAYS = 3650;
const DAY_CHIPS = [1, 3, 7, 15, 30];
// "Days left" turns red at this many or fewer.
const URGENT_DAYS = 3;

type Tab = "expiring" | "expired" | "dues";
const TABS: { key: Tab; label: string }[] = [
  { key: "expiring", label: "Expiring" },
  { key: "expired", label: "Expired / unpaid" },
  { key: "dues", label: "Dues" },
];

// One row of the expiring and expired lists: a member and the membership
// the row is about. `memberId` is null for a guest checkout.
interface MembershipRow {
  memberId: string | null;
  name: string;
  phone: string;
  email: string;
  memberCode: string | null;
  orderId: string;
  orderNumber: string;
  packageName: string;
  status: string;
  paymentStatus: string;
  startDate: string | null;
  endDate: string | null;
  amount: number;
  balanceDue: number;
  currency: string;
  daysLeft?: number;
  autoRenews?: boolean;
  daysOverdue?: number;
}

interface DuesOrder {
  orderId: string;
  orderNumber: string;
  packageName: string;
  status: string;
  amount: number;
  amountPaid: number | null;
  balanceDue: number;
  startDate?: string | null;
  endDate?: string | null;
  lastPaidAt?: string | null;
}

// One member's dues in one currency (money is never added across them).
interface DuesRow {
  memberId: string | null;
  name: string;
  phone: string;
  email: string;
  memberCode: string | null;
  currency: string;
  balanceDue: number;
  orders: DuesOrder[];
}

interface DuesTotal {
  currency: string;
  balanceDue: number;
  members: number;
  orders: number;
}

type Pagination = { page?: number; limit?: number; total?: number; pages?: number };

// What was loaded, and for which tab: a tab switched to shows nothing of
// the one before while its own list is on the way.
type Loaded =
  | { tab: "expiring" | "expired"; rows: MembershipRow[]; total: number; pages: number }
  | { tab: "dues"; rows: DuesRow[]; totals: DuesTotal[]; total: number; pages: number };

/** A whole number from min to max, or null. */
function wholeNumber(value: string | null, min: number, max: number): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

// The view as the address gives it. A value out of range is ignored.
function viewFrom(params: { get(key: string): string | null }) {
  const tab = params.get("tab");
  return {
    tab: (tab === "expired" || tab === "dues" ? tab : "expiring") as Tab,
    days: wholeNumber(params.get("days"), 1, MAX_DAYS) ?? DEFAULT_DAYS,
    withinDays: wholeNumber(params.get("withinDays"), 1, MAX_WITHIN_DAYS),
    search: params.get("search") ?? "",
  };
}

function money(amount: number | null | undefined, currency: string) {
  return `${(currency || "").toUpperCase()} ${Number(amount || 0).toLocaleString()}`;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

// YYYY-MM-DD in this browser's calendar: what a spreadsheet sorts as a date.
function dayKey(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What has come in on an order with a balance. Orders from before part
// payments carry no amountPaid; theirs is the total less what is owed.
const paidOn = (o: DuesOrder) => o.amountPaid ?? Math.max(0, (o.amount || 0) - (o.balanceDue || 0));

/** What is owed on a row: its balance, or all of it when nothing was paid. */
function owed(row: MembershipRow) {
  return row.paymentStatus === "paid" ? row.balanceDue || 0 : row.amount || 0;
}

// Downloads the rows as a CSV the way the other admin lists do (a BOM so
// Excel reads it as UTF-8). A cell a spreadsheet would run as a formula
// (a member can type their own name) is kept as text.
function downloadCsv(filename: string, header: string[], lines: (string | number | null | undefined)[][]) {
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    const safe = /^[=@\t\r]|^[+-](?![\d.\s(])/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [header, ...lines].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const TH = "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500";
const TD = "px-4 py-3 align-top";
const ACTION =
  "inline-flex items-center h-9 px-3 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors whitespace-nowrap";
const INPUT = "h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-neutral-400 focus:outline-none";

function Phone({ phone }: { phone: string }) {
  if (!phone) return <span className="text-neutral-400">—</span>;
  return (
    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="whitespace-nowrap text-neutral-700 hover:text-neutral-900 hover:underline">
      {phone}
    </a>
  );
}

function Member({ name, email }: { name: string; email: string }) {
  return (
    <>
      <div className="font-medium text-neutral-900">{name || email || "—"}</div>
      {email && name && <div className="text-xs text-neutral-500">{email}</div>}
    </>
  );
}

// Collect fees for the member. A guest checkout has no account to collect
// against, so its order is opened instead, where a payment can be recorded.
function Collect({ memberId, orderId }: { memberId: string | null; orderId?: string }) {
  if (memberId) {
    return (
      <Link href={`/admin/fee-collection?member=${encodeURIComponent(memberId)}`} className={ACTION}>
        Collect
      </Link>
    );
  }
  if (orderId) {
    return (
      <Link href={`/admin/package-orders?id=${encodeURIComponent(orderId)}`} className={ACTION}>
        Open order
      </Link>
    );
  }
  return null;
}

function DaysLeft({ days }: { days?: number }) {
  if (days === undefined || days === null) return <span className="text-neutral-400">—</span>;
  const label = days <= 0 ? "Today" : plural(days, "day");
  return <span className={`whitespace-nowrap ${days <= URGENT_DAYS ? "font-semibold text-rose-600" : "text-neutral-700"}`}>{label}</span>;
}

function Owed({ row }: { row: MembershipRow }) {
  const amount = owed(row);
  return (
    <div className="whitespace-nowrap">
      {amount > 0 ? <span className="font-medium text-amber-700">{money(amount, row.currency)}</span> : <span className="text-neutral-400">—</span>}
      {row.paymentStatus !== "paid" && (
        <div className="mt-1">
          <Badge color="amber">{row.paymentStatus === "processing" ? "awaiting review" : "not paid"}</Badge>
        </div>
      )}
    </div>
  );
}

function FeeExpiryPageInner() {
  const { can } = usePermissions();
  // Taking money is a package-orders write; everyone else gets the lists.
  const manage = can("package-orders", "manage");
  const { siteName } = useSiteSettings();

  const searchParams = useSearchParams();
  const url = viewFrom(searchParams);

  const [tab, setTab] = useState<Tab>(url.tab);
  const [days, setDays] = useState(url.days);
  const [daysDraft, setDaysDraft] = useState(String(url.days));
  const [withinDays, setWithinDays] = useState<number | null>(url.withinDays);
  const [withinDraft, setWithinDraft] = useState(url.withinDays ? String(url.withinDays) : "");
  const [search, setSearch] = useState(url.search);
  const [includeAutoRenew, setIncludeAutoRenew] = useState(false);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Dues rows whose orders are showing.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // A link followed while already here (the sidebar, the dashboard card)
  // brings its own view. Changes made on the page come back through here
  // too, already applied.
  useEffect(() => {
    setTab(url.tab);
    setDays(url.days);
    setDaysDraft(String(url.days));
    setWithinDays(url.withinDays);
    setWithinDraft(url.withinDays ? String(url.withinDays) : "");
    setSearch(url.search);
    setPage(1);
  }, [url.tab, url.days, url.withinDays, url.search]);

  useEffect(() => {
    // A response that arrives after the view moved on is dropped.
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (search.trim()) params.set("search", search.trim());
        if (tab === "expiring") {
          params.set("days", String(days));
          if (includeAutoRenew) params.set("includeAutoRenew", "1");
        }
        if (tab === "expired" && withinDays) params.set("withinDays", String(withinDays));

        if (tab === "dues") {
          const r = await apiGet<{ data?: DuesRow[]; totals?: DuesTotal[]; pagination?: Pagination }>(`${GYMFOLIO_API}/package-orders/dues?${params.toString()}`);
          if (cancelled) return;
          const rows = r.data || [];
          setData({ tab, rows, totals: r.totals || [], total: r.pagination?.total ?? rows.length, pages: pageCount(r.pagination) });
        } else {
          const r = await apiGet<{ data?: MembershipRow[]; pagination?: Pagination }>(`${GYMFOLIO_API}/package-orders/${tab}?${params.toString()}`);
          if (cancelled) return;
          const rows = r.data || [];
          setData({ tab, rows, total: r.pagination?.total ?? rows.length, pages: pageCount(r.pagination) });
        }
      } catch (e) {
        if (cancelled) return;
        setData(null);
        setError(e instanceof Error ? e.message : "Could not load the list");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(load, search ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tab, days, withinDays, includeAutoRenew, search, page, reloadKey]);

  const chooseTab = (next: Tab) => {
    setTab(next);
    setPage(1);
    setExpanded(new Set());
    replaceParams({ tab: next === "expiring" ? null : next });
  };

  // The box keeps whatever is typed; the list follows once it is a number
  // the backend takes.
  const chooseDays = (value: string) => {
    setDaysDraft(value);
    const n = wholeNumber(value, 1, MAX_DAYS);
    if (n === null) return;
    setDays(n);
    setPage(1);
    replaceParams({ days: String(n) });
  };

  const chooseWithin = (value: string) => {
    setWithinDraft(value);
    const n = value.trim() ? wholeNumber(value, 1, MAX_WITHIN_DAYS) : null;
    if (value.trim() && n === null) return;
    setWithinDays(n);
    setPage(1);
    replaceParams({ withinDays: n ? String(n) : null });
  };

  const chooseSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    setExpanded(new Set());
    replaceParams({ search: value });
  };

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const shown = data && data.tab === tab ? data : null;
  const daysInvalid = wholeNumber(daysDraft, 1, MAX_DAYS) === null;
  const withinInvalid = withinDraft.trim() !== "" && wholeNumber(withinDraft, 1, MAX_WITHIN_DAYS) === null;

  // What the list is, in words: the printed sheet's heading.
  const listTitle =
    tab === "expiring"
      ? `Memberships ending in the next ${plural(days, "day")}${includeAutoRenew ? ", card renewals included" : ""}`
      : tab === "expired"
        ? `Memberships ended and not renewed${withinDays ? ` in the last ${plural(withinDays, "day")}` : ""}`
        : "Members with fees due";
  const filterNote = search.trim() ? ` · matching “${search.trim()}”` : "";
  const pageNote = shown && shown.pages > 1 ? ` · page ${page} of ${shown.pages}` : "";

  const today = dayKey(new Date());
  const pageSuffix = shown && shown.pages > 1 ? `-page-${page}` : "";

  // The rows on screen, as they are shown.
  const exportCsv = () => {
    if (!shown) return;
    if (shown.tab === "dues") {
      // One line per order, so the balance column adds up to what is owed.
      downloadCsv(
        `fees-due-${today}${pageSuffix}.csv`,
        ["Member ID", "Name", "Phone", "Email", "Order #", "Package", "Status", "Starts", "Ends", "Amount", "Paid", "Balance due", "Currency", "Last paid"],
        shown.rows.flatMap((row) =>
          row.orders.map((o) => [
            row.memberCode || "",
            row.name,
            row.phone,
            row.email,
            o.orderNumber,
            o.packageName,
            o.status,
            dayKey(o.startDate),
            dayKey(o.endDate),
            o.amount,
            paidOn(o),
            o.balanceDue,
            row.currency,
            dayKey(o.lastPaidAt),
          ])
        )
      );
      return;
    }
    if (shown.tab === "expiring") {
      downloadCsv(
        `fees-expiring-${days}-days-${today}${pageSuffix}.csv`,
        ["Member ID", "Name", "Phone", "Email", "Order #", "Package", "Expires", "Days left", "Amount", "Balance due", "Currency", "Renews by card"],
        shown.rows.map((r) => [
          r.memberCode || "",
          r.name,
          r.phone,
          r.email,
          r.orderNumber,
          r.packageName,
          dayKey(r.endDate),
          r.daysLeft ?? "",
          r.amount,
          owed(r),
          r.currency,
          r.autoRenews ? "Yes" : "No",
        ])
      );
      return;
    }
    downloadCsv(
      `fees-expired${withinDays ? `-last-${withinDays}-days` : ""}-${today}${pageSuffix}.csv`,
      ["Member ID", "Name", "Phone", "Email", "Order #", "Package", "Payment", "Expired", "Days overdue", "Amount", "Balance due", "Currency"],
      shown.rows.map((r) => [
        r.memberCode || "",
        r.name,
        r.phone,
        r.email,
        r.orderNumber,
        r.packageName,
        r.paymentStatus === "paid" ? "paid" : r.paymentStatus === "processing" ? "awaiting review" : "not paid",
        dayKey(r.endDate),
        r.daysOverdue ?? "",
        r.amount,
        owed(r),
        r.currency,
      ])
    );
  };

  const print = () => printReport(`${siteName ? `${siteName} ` : ""}Fee expiry ${TABS.find((t) => t.key === tab)?.label || ""} ${today}`);

  const chip = (on: boolean) =>
    `h-8 rounded-lg px-3 text-[13px] font-medium transition-colors ${
      on ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
    }`;

  const empty =
    tab === "expiring"
      ? {
          title: search.trim() ? "No expiring memberships match" : `No memberships end in the next ${plural(days, "day")}`,
          hint: includeAutoRenew ? undefined : "Card subscriptions that renew by themselves are left out; tick the box to include them.",
        }
      : tab === "expired"
        ? {
            title: search.trim() ? "No lapsed memberships match" : `No memberships have lapsed without a renewal${withinDays ? ` in the last ${plural(withinDays, "day")}` : ""}`,
            hint: undefined,
          }
        : { title: search.trim() ? "No members with fees due match" : "Nobody owes anything", hint: undefined };

  const rowCount = shown ? shown.rows.length : 0;

  return (
    <div data-print-root>
      <PrintStyles />
      <div data-print-only className="mb-4 border-b border-neutral-300 pb-3">
        <p className="text-lg font-semibold text-neutral-900">{siteName}</p>
        <p className="text-sm text-neutral-800">
          {listTitle}
          {filterNote}
          {pageNote}
        </p>
        <p className="text-xs text-neutral-500">
          {shown ? `${plural(shown.total, "member")} · ` : ""}Printed {new Date().toLocaleString()}
        </p>
      </div>

      <div data-print-hide>
        <PageHeader
          eyebrow="Sales"
          title="Fee expiry"
          actions={
            <>
              <SecondaryButton onClick={exportCsv} disabled={loading || !rowCount}>
                <FiDownload className="mr-1.5 h-4 w-4" /> Export CSV
              </SecondaryButton>
              <SecondaryButton onClick={print} disabled={loading || !rowCount}>
                <FiPrinter className="mr-1.5 h-4 w-4" /> Print
              </SecondaryButton>
            </>
          }
        />
      </div>

      <div data-print-hide className="mb-6 border-b border-neutral-200">
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => chooseTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div data-print-hide className="mb-4 flex flex-wrap items-center gap-2">
        {tab === "expiring" && (
          <>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              In the next
              <input
                type="number"
                min={1}
                max={MAX_DAYS}
                value={daysDraft}
                onChange={(e) => chooseDays(e.target.value)}
                aria-invalid={daysInvalid}
                className={`${INPUT} w-20 ${daysInvalid ? "border-rose-300" : ""}`}
              />
              days
            </label>
            {DAY_CHIPS.map((n) => (
              <button key={n} type="button" onClick={() => chooseDays(String(n))} className={chip(!daysInvalid && days === n)}>
                {plural(n, "day")}
              </button>
            ))}
            <label className="ml-1 flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={includeAutoRenew}
                onChange={(e) => {
                  setIncludeAutoRenew(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Include cards that renew themselves
            </label>
          </>
        )}
        {tab === "expired" && (
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            Ended in the last
            <input
              type="number"
              min={1}
              max={MAX_WITHIN_DAYS}
              value={withinDraft}
              onChange={(e) => chooseWithin(e.target.value)}
              placeholder="any"
              aria-invalid={withinInvalid}
              className={`${INPUT} w-24 ${withinInvalid ? "border-rose-300" : ""}`}
            />
            days
          </label>
        )}
        <input
          value={search}
          onChange={(e) => chooseSearch(e.target.value)}
          placeholder="Search name, email, phone, order #…"
          className={`${INPUT} w-64`}
        />
        {!loading && shown && <span className="text-xs text-neutral-500">{plural(shown.total, "member")}</span>}
      </div>
      {(daysInvalid && tab === "expiring") || (withinInvalid && tab === "expired") ? (
        <p data-print-hide className="-mt-2 mb-4 text-xs text-rose-600">
          Enter a whole number of days from 1 to {tab === "expiring" ? MAX_DAYS : MAX_WITHIN_DAYS}.
        </p>
      ) : null}

      {shown?.tab === "dues" && shown.totals.length > 0 && (
        <div data-print-cols="3" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shown.totals.map((t) => (
            <div key={t.currency} className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Total due{shown.totals.length > 1 ? ` · ${t.currency}` : ""}</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{money(t.balanceDue, t.currency)}</p>
              <p className="text-xs text-neutral-500">
                {plural(t.members, "member")} · {plural(t.orders, "order")}
              </p>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : loading || !shown ? (
        <Spinner />
      ) : !shown.rows.length ? (
        <EmptyState title={empty.title} hint={empty.hint} />
      ) : shown.tab === "dues" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["Member ID", "Name", "Phone", "Orders", "Balance due"].map((c) => (
                    <th key={c} className={TH}>
                      {c}
                    </th>
                  ))}
                  {manage && <th data-print-hide className={TH} />}
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((row) => {
                  const key = `${row.memberId || row.email || row.orders[0]?.orderId}-${row.currency}`;
                  const open = expanded.has(key);
                  return (
                    <DuesRows key={key} row={row} open={open} onToggle={() => toggle(key)} manage={manage} />
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["Member ID", "Name", "Phone", "Package", shown.tab === "expiring" ? "Expires" : "Expired", shown.tab === "expiring" ? "Days left" : "Days overdue", "Amount", "Balance due"].map((c) => (
                    <th key={c} className={TH}>
                      {c}
                    </th>
                  ))}
                  {manage && <th data-print-hide className={TH} />}
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((r) => (
                  <tr key={r.orderId} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                    <td className={`${TD} whitespace-nowrap text-neutral-700`}>{r.memberCode || <span className="text-neutral-400">—</span>}</td>
                    <td className={TD}>
                      <Member name={r.name} email={r.email} />
                    </td>
                    <td className={TD}>
                      <Phone phone={r.phone} />
                    </td>
                    <td className={TD}>
                      {r.packageName || "—"}
                      <p className="text-[11px] text-neutral-500">
                        <code>{r.orderNumber}</code>
                      </p>
                      {r.autoRenews && (
                        <div className="mt-1">
                          <Badge color="blue">renews by card</Badge>
                        </div>
                      )}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-neutral-700`}>{fmtDate(r.endDate)}</td>
                    <td className={TD}>
                      {shown.tab === "expiring" ? (
                        <DaysLeft days={r.daysLeft} />
                      ) : (
                        <span className="whitespace-nowrap text-neutral-700">{r.daysOverdue === undefined ? "—" : r.daysOverdue <= 0 ? "Today" : plural(r.daysOverdue, "day")}</span>
                      )}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{money(r.amount, r.currency)}</td>
                    <td className={TD}>
                      <Owed row={r} />
                    </td>
                    {manage && (
                      <td data-print-hide className={TD}>
                        {/* A card Stripe renews by itself needs nothing taken at
                            the desk: a second payment would charge twice. */}
                        {r.autoRenews && owed(r) <= 0 ? (
                          <span className="whitespace-nowrap text-xs text-neutral-500">Renews by card</span>
                        ) : (
                          <Collect memberId={r.memberId} orderId={r.orderId} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div data-print-hide>
        <Pager page={page} pages={shown?.pages ?? 1} total={shown?.total} onChange={setPage} disabled={loading} />
      </div>
    </div>
  );
}

// One member's dues: the summary row, and under it (when opened) each order
// that still has money owing.
function DuesRows({ row, open, onToggle, manage }: { row: DuesRow; open: boolean; onToggle: () => void; manage: boolean }) {
  const packages = Array.from(new Set(row.orders.map((o) => o.packageName).filter(Boolean))).join(", ");
  return (
    <>
      <tr className={`border-b border-neutral-100 hover:bg-neutral-50 ${open ? "bg-neutral-50/60" : ""}`}>
        <td className={`${TD} whitespace-nowrap text-neutral-700`}>{row.memberCode || <span className="text-neutral-400">—</span>}</td>
        <td className={TD}>
          <Member name={row.name} email={row.email} />
        </td>
        <td className={TD}>
          <Phone phone={row.phone} />
        </td>
        <td className={TD}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-neutral-700 hover:text-neutral-900"
          >
            {plural(row.orders.length, "order")}
            <FiChevronDown data-print-hide className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {packages && <p className="max-w-[240px] truncate text-[11px] text-neutral-500">{packages}</p>}
        </td>
        <td className={`${TD} whitespace-nowrap font-medium text-amber-700`}>{money(row.balanceDue, row.currency)}</td>
        {manage && (
          <td data-print-hide className={TD}>
            <Collect memberId={row.memberId} orderId={row.orders[0]?.orderId} />
          </td>
        )}
      </tr>
      {open && (
        <tr className="border-b border-neutral-100 bg-neutral-50/60">
          <td colSpan={manage ? 6 : 5} className="px-4 pb-4 pt-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                  {["Order #", "Package", "Status", "Runs", "Amount", "Paid", "Balance due", "Last paid"].map((c) => (
                    <th key={c} className="whitespace-nowrap px-2 py-2">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row.orders.map((o) => (
                  <tr key={o.orderId} className="border-t border-neutral-200/70">
                    <td className="px-2 py-1.5">
                      <Link href={`/admin/package-orders?id=${encodeURIComponent(o.orderId)}`} className="text-neutral-700 hover:text-neutral-900 hover:underline">
                        <code>{o.orderNumber}</code>
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-neutral-700">{o.packageName || "—"}</td>
                    <td className="px-2 py-1.5 text-neutral-600">{(o.status || "").replace("_", " ")}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-neutral-600">
                      {fmtDate(o.startDate)} → {fmtDate(o.endDate)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-neutral-700">{money(o.amount, row.currency)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-neutral-700">{money(paidOn(o), row.currency)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-medium text-amber-700">{money(o.balanceDue, row.currency)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-neutral-600">{fmtDate(o.lastPaidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export default function FeeExpiryPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <FeeExpiryPageInner />
    </Suspense>
  );
}
