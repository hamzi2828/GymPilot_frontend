"use client";

// Reports: the business over a range -- revenue against expenses, new
// members, visits and peak hours, classes by demand, memberships kept and
// lost, leads and personal training -- with every list exportable as CSV
// or as an Excel workbook -- and the daily sales sheet (?tab=daily).

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Card, PrimaryButton, SecondaryButton, TextField, Select2, Spinner, ErrorState, useLatestRequest, useAsyncAction } from "../_shared/ui";
import { API_BASE, apiGet } from "../_shared/api";
import { BarChart, LineChart, HBarList, type Point } from "../_shared/Charts";
import { downloadExport, FORMAT_LABELS, type ExportFormat } from "./download";
import DailySales from "./DailySales";
import { PrintHeader, PrintStyles, printReport } from "./Print";
import { useGymToday, useSiteSettings } from "@/components/ThemeProvider";
import { usePermissions } from "@/components/admin/PermissionsProvider";

interface Report {
  range: { from: string; to: string; label: string; grain: "day" | "month" };
  base_currency: string;
  kpis: {
    revenue: number;
    expenses: number;
    expenses_pending: number;
    net: number;
    membership_revenue: number;
    shop_revenue: number;
    shop_sales: number;
    paid_orders: number;
    new_members: number;
    visits: number;
    avg_visits_per_day: number | null;
    members_total: number;
    active_memberships: number;
    expiring_soon: number;
    renewals: number;
    lapsed: number;
    retention_rate: number | null;
    lead_conversion_rate: number | null;
  };
  series: { revenue: Point[]; expenses: Point[]; orders: Point[]; new_members: Point[]; visits: Point[]; peak_hours: { hour: number; label: string; value: number }[] };
  revenue_by_package: { name: string; total: number; orders: number }[];
  other_currencies: { currency: string; total: number; orders: number }[];
  classes: { name: string; booked: number; attended: number; no_show: number; waitlisted: number; attendance_rate: number | null }[];
  pt: { scheduled: number; completed: number; cancelled: number; no_show: number; value: number; commission: number };
  top_products: { name: string; quantity: number; total: number; margin: number }[];
  leads: { new: number; contacted: number; trial: number; won: number; lost: number; total: number };
  registrations: { total: number; days: { date: string; label: string; count: number }[] };
}

// Date-key arithmetic; "today" is the gym's (useGymToday), not UTC's.
const shift = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const monthStart = (key: string) => `${key.slice(0, 7)}-01`;
// Every export covers the chosen range; "All members" is the one that
// ignores it. Beside Reports, each needs view access to the tab its rows
// come from (`tab`, named as the sidebar names it): the API refuses the rest
// with 403 EXPORT_NOT_ALLOWED (reportsController EXPORT_TABS), so they are
// offered greyed out with what they need.
const EXPORTS: { id: string; kind: string; label: string; query?: string; tab: string; tabLabel: string }[] = [
  { id: "members", kind: "members", label: "Members joined", tab: "users", tabLabel: "Users" },
  { id: "members-all", kind: "members", label: "All members", query: "all=1", tab: "users", tabLabel: "Users" },
  { id: "orders", kind: "orders", label: "Orders", tab: "package-orders", tabLabel: "Package Orders" },
  { id: "attendance", kind: "attendance", label: "Attendance", tab: "attendance", tabLabel: "Attendance" },
  { id: "bookings", kind: "bookings", label: "Bookings", tab: "bookings", tabLabel: "Bookings" },
  { id: "leads", kind: "leads", label: "Leads", tab: "leads", tabLabel: "Leads" },
  { id: "pt-sessions", kind: "pt-sessions", label: "PT sessions", tab: "pt", tabLabel: "Personal Training" },
  { id: "expenses", kind: "expenses", label: "Expenses", tab: "accounts", tabLabel: "Accounts" },
  { id: "payslips", kind: "payslips", label: "Payslips", tab: "staff", tabLabel: "Staff" },
];

function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone || "text-neutral-900"}`}>{value}</p>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

// The chart's bars as a list: each day somebody joined, and how many. The
// "Members joined" export has the people behind each number.
function Registrations({ data }: { data: Report["registrations"] }) {
  if (!data.days.length) return <p className="mt-3 text-xs text-neutral-500">Nobody joined in this range.</p>;
  return (
    <>
      <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 print:max-h-none print:overflow-visible">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50">
            <tr className="border-b border-neutral-200 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">New members</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map((day) => (
              <tr key={day.date} className="border-b border-neutral-100 last:border-b-0">
                <td className="px-3 py-1.5 text-neutral-700">{day.label}</td>
                <td className="px-3 py-1.5 text-right font-medium text-neutral-900">{day.count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-200 bg-neutral-50 font-semibold text-neutral-900">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{data.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Days with no sign-ups are not listed.</p>
    </>
  );
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "daily", label: "Daily sales" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function ReportsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // In the URL, so the dashboard can link straight to the daily sales.
  const tab: TabKey = searchParams.get("tab") === "daily" ? "daily" : "overview";
  const setTab = (next: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(`/admin/reports${query ? `?${query}` : ""}`, { scroll: false });
  };

  // A link may name the range (the dashboard's "Revenue today" does).
  const urlDate = (key: string) => {
    const value = searchParams.get(key) || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  };
  const today = useGymToday();
  const [from, setFrom] = useState(() => urlDate("from") || monthStart(today()));
  const [to, setTo] = useState(() => urlDate("to") || today());
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const exporting = useAsyncAction();
  // The export picker: one list, one format, one button.
  const [exportId, setExportId] = useState(EXPORTS[0].id);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  // Why the last download was refused, said beside the button.
  const [exportErr, setExportErr] = useState<string | null>(null);
  // The downloads this role may have; the chosen one, or the first of them.
  const { can } = usePermissions();
  const mayExport = (item: (typeof EXPORTS)[number]) => can(item.tab);
  const chosenExport = EXPORTS.find((item) => item.id === exportId && mayExport(item)) || EXPORTS.find(mayExport) || null;

  const begin = useLatestRequest();
  const load = useCallback(async () => {
    // The daily sales tab loads its own figures.
    if (tab !== "overview") return;
    const isLatest = begin();
    setLoading(true);
    setError(null);
    try {
      const report = await apiGet<Report>(`${API_BASE}/admin/reports/overview?from=${from}&to=${to}`);
      if (!isLatest()) return;
      setData(report);
    } catch (e) {
      if (!isLatest()) return;
      // Not the last range's figures under the new dates.
      setData(null);
      setError(e instanceof Error ? e.message : "Could not load the report");
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [from, to, tab, begin]);

  useEffect(() => {
    load();
  }, [load]);

  // The range buttons wait while the overview reloads; the daily tab loads its own figures.
  const reloading = tab === "overview" && loading;
  const preset = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
  };

  const download = ({ kind, query }: (typeof EXPORTS)[number], format: ExportFormat) => exporting.run(async () => {
    setExportErr(null);
    try {
      const params = `from=${from}&to=${to}${query ? `&${query}` : ""}${format === "xlsx" ? "&format=xlsx" : ""}`;
      await downloadExport(`${API_BASE}/admin/reports/export/${kind}?${params}`, `${kind}.${format}`);
    } catch (e) {
      // The server's own sentence, a 403 EXPORT_NOT_ALLOWED's included: it
      // names the tab the role is missing.
      setExportErr(e instanceof Error ? e.message : "Export failed");
    }
  });

  const money = (n: number) => `${data?.base_currency || ""} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const { siteName } = useSiteSettings();
  const title = tab === "daily" ? "Daily sales" : "Reports";
  const print = () => printReport(`${siteName ? `${siteName} ` : ""}${title} ${from === to ? from : `${from} to ${to}`}`);

  return (
    <div data-print-root>
      <PrintStyles />
      <PrintHeader title={title} from={from} to={to} />

      <div data-print-hide>
        <PageHeader
          eyebrow="Overview"
          title="Reports"
          actions={<SecondaryButton onClick={print}>Print / PDF</SecondaryButton>}
        />
      </div>

      <div data-print-hide className="mb-6 border-b border-neutral-200">
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div data-print-hide>
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <TextField label="From" type="date" value={from} onChange={setFrom} />
            </div>
            <div className="w-40">
              <TextField label="To" type="date" value={to} onChange={setTo} />
            </div>
            <div className="flex flex-wrap gap-1.5 pb-1">
              <SecondaryButton onClick={() => preset(today(), today())} disabled={reloading}>Today</SecondaryButton>
              <SecondaryButton onClick={() => preset(monthStart(today()), today())} disabled={reloading}>This month</SecondaryButton>
              <SecondaryButton onClick={() => preset(shift(today(), -29), today())} disabled={reloading}>Last 30 days</SecondaryButton>
              <SecondaryButton onClick={() => preset(shift(today(), -89), today())} disabled={reloading}>Last 90 days</SecondaryButton>
              <SecondaryButton onClick={() => preset(monthStart(shift(today(), -364)), today())} disabled={reloading}>Last 12 months</SecondaryButton>
            </div>
          </div>
          {tab === "overview" && (
            // One line instead of a wall of buttons: pick what, pick the
            // format, download -- for the dates above.
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4 text-sm">
              <span className="font-medium text-neutral-700">Download</span>
              <div className="w-56 max-w-full">
                <Select2
                  ariaLabel="What to download"
                  value={chosenExport?.id ?? ""}
                  onChange={(id) => {
                    setExportId(id);
                    setExportErr(null);
                  }}
                  disabled={!chosenExport}
                  placeholder="Nothing to download"
                  options={EXPORTS.map((item) => ({
                    value: item.id,
                    label: item.label,
                    hint: mayExport(item) ? undefined : `Needs ${item.tabLabel} access`,
                    disabled: !mayExport(item),
                  }))}
                />
              </div>
              <span className="text-neutral-500">as</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-neutral-300" role="radiogroup" aria-label="File type">
                {(["xlsx", "csv"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    role="radio"
                    aria-checked={exportFormat === format}
                    onClick={() => setExportFormat(format)}
                    className={`h-9 px-3 text-sm font-medium transition-colors ${exportFormat === format ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}
                  >
                    {FORMAT_LABELS[format]}
                  </button>
                ))}
              </div>
              <PrimaryButton onClick={() => chosenExport && download(chosenExport, exportFormat)} loading={exporting.busy} disabled={!chosenExport}>
                Download
              </PrimaryButton>
              <span className="text-xs text-neutral-400">
                {chosenExport
                  ? "for the dates above"
                  : "Each of these needs access to the section its rows come from, and your role has none of them. Daily sales has its own download."}
              </span>
              {exportErr && (
                <p role="alert" className="basis-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {exportErr}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {tab === "daily" && <DailySales from={from} to={to} />}
      {tab === "overview" && error && data && <p data-print-hide className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {tab !== "overview" ? null : loading ? (
        <Spinner />
      ) : !data ? (
        <ErrorState message={error || "Could not load the report"} onRetry={load} />
      ) : (
        <div className="space-y-6">
          <div data-print-cols="3" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Kpi label="Revenue" value={money(data.kpis.revenue)} hint={`memberships ${money(data.kpis.membership_revenue)} · shop ${money(data.kpis.shop_revenue)}`} />
            <Kpi label="Expenses" value={money(data.kpis.expenses)} hint={data.kpis.expenses_pending ? `paid · ${money(data.kpis.expenses_pending)} pending, not deducted` : "paid"} />
            <Kpi label="Net" value={money(data.kpis.net)} tone={data.kpis.net >= 0 ? "text-emerald-700" : "text-rose-700"} hint="revenue less expenses, salaries, commission and assets · same as Accounts" />
            <Kpi label="New members" value={data.kpis.new_members} hint={`${data.kpis.members_total} in total`} />
            <Kpi label="Visits" value={data.kpis.visits} hint={data.kpis.avg_visits_per_day !== null ? `${data.kpis.avg_visits_per_day} per day` : undefined} />
            <Kpi label="Live memberships" value={data.kpis.active_memberships} hint={`${data.kpis.expiring_soon} ending within 14 days`} />
            <Kpi label="Retention" value={data.kpis.retention_rate !== null ? `${data.kpis.retention_rate}%` : "—"} hint={`${data.kpis.renewals} renewed · ${data.kpis.lapsed} lapsed`} />
            <Kpi label="Lead conversion" value={data.kpis.lead_conversion_rate !== null ? `${data.kpis.lead_conversion_rate}%` : "—"} hint={`${data.leads.won} of ${data.leads.total} joined`} />
            <Kpi label="PT sessions" value={data.pt.completed} hint={`${money(data.pt.value)} · commission ${money(data.pt.commission)}`} />
          </div>
          {data.other_currencies.length > 0 && (
            <p className="text-xs text-neutral-500">Also taken in other currencies (not in the totals): {data.other_currencies.map((c) => `${c.currency} ${c.total.toLocaleString()} (${c.orders})`).join(", ")}</p>
          )}

          <div data-print-cols="2" className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Revenue and expenses · {data.range.label}</h2>
              <LineChart series={[{ name: "Revenue", data: data.series.revenue }, { name: "Expenses", color: "#f43f5e", data: data.series.expenses }]} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">New members</h2>
              <BarChart data={data.series.new_members} />
              <Registrations data={data.registrations} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Member visits</h2>
              <BarChart data={data.series.visits} color="#171717" />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Busiest hours (check-ins by hour)</h2>
              <BarChart data={data.series.peak_hours.filter((h) => h.hour >= 5 && h.hour <= 23).map((h) => ({ label: h.label.slice(0, 2), value: h.value }))} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Revenue by package</h2>
              <HBarList rows={data.revenue_by_package.map((p) => ({ label: p.name, value: p.total, hint: `(${p.orders})` }))} valueLabel={money} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Shop: top products ({data.kpis.shop_sales} sales)</h2>
              {/* `margin` is the till's profit on the product (tax and discounts out), so it is called what the POS screen calls it. */}
              <HBarList rows={data.top_products.map((p) => ({ label: p.name, value: p.total, hint: `(${p.quantity} sold · profit ${money(p.margin)})` }))} valueLabel={money} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Classes by demand</h2>
              <HBarList rows={data.classes.map((c) => ({ label: c.name, value: c.booked, hint: c.attendance_rate !== null ? `${c.attendance_rate}% attended · ${c.no_show} no-shows · ${c.waitlisted} waitlisted` : "" }))} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Leads in this range</h2>
              <HBarList rows={[["new", "New"], ["contacted", "Contacted"], ["trial", "Trial"], ["won", "Joined"], ["lost", "Lost"]].map(([k, label]) => ({ label, value: data.leads[k as keyof typeof data.leads] as number }))} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Personal training</h2>
              <HBarList rows={[{ label: "Completed", value: data.pt.completed }, { label: "Upcoming", value: data.pt.scheduled }, { label: "No-shows", value: data.pt.no_show }, { label: "Cancelled", value: data.pt.cancelled }]} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <ReportsPageInner />
    </Suspense>
  );
}
