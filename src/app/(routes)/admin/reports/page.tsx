"use client";

// Reports: the business over a range -- revenue against expenses, new
// members, visits and peak hours, classes by demand, memberships kept and
// lost, leads and personal training -- with every list exportable as CSV
// or as an Excel workbook -- and the daily sales sheet (?tab=daily).

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Card, SecondaryButton, TextField, Spinner } from "../_shared/ui";
import { API_BASE, apiGet } from "../_shared/api";
import { BarChart, LineChart, HBarList, type Point } from "../_shared/Charts";
import { downloadExport, FORMAT_LABELS, type ExportFormat } from "./download";
import DailySales from "./DailySales";
import { PrintHeader, PrintStyles, printReport } from "./Print";
import { useSiteSettings } from "@/components/ThemeProvider";

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

const today = () => new Date().toISOString().slice(0, 10);
const shift = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const monthStart = (key: string) => `${key.slice(0, 7)}-01`;
// Every export covers the chosen range; "All members" is the one that
// ignores it.
const EXPORTS: { id: string; kind: string; label: string; query?: string }[] = [
  { id: "members", kind: "members", label: "Members joined" },
  { id: "members-all", kind: "members", label: "All members", query: "all=1" },
  { id: "orders", kind: "orders", label: "Orders" },
  { id: "attendance", kind: "attendance", label: "Attendance" },
  { id: "bookings", kind: "bookings", label: "Bookings" },
  { id: "leads", kind: "leads", label: "Leads" },
  { id: "pt-sessions", kind: "pt-sessions", label: "PT sessions" },
  { id: "expenses", kind: "expenses", label: "Expenses" },
  { id: "payslips", kind: "payslips", label: "Payslips" },
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
  const [from, setFrom] = useState(() => urlDate("from") || monthStart(today()));
  const [to, setTo] = useState(() => urlDate("to") || today());
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    // The daily sales tab loads its own figures.
    if (tab !== "overview") return;
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<Report>(`${API_BASE}/admin/reports/overview?from=${from}&to=${to}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the report");
    } finally {
      setLoading(false);
    }
  }, [from, to, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const preset = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
  };

  const download = async ({ id, kind, query }: (typeof EXPORTS)[number], format: ExportFormat) => {
    setExporting(`${id}.${format}`);
    try {
      const params = `from=${from}&to=${to}${query ? `&${query}` : ""}${format === "xlsx" ? "&format=xlsx" : ""}`;
      await downloadExport(`${API_BASE}/admin/reports/export/${kind}?${params}`, `${kind}.${format}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

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
              <SecondaryButton onClick={() => preset(today(), today())}>Today</SecondaryButton>
              <SecondaryButton onClick={() => preset(monthStart(today()), today())}>This month</SecondaryButton>
              <SecondaryButton onClick={() => preset(shift(today(), -29), today())}>Last 30 days</SecondaryButton>
              <SecondaryButton onClick={() => preset(shift(today(), -89), today())}>Last 90 days</SecondaryButton>
              <SecondaryButton onClick={() => preset(monthStart(shift(today(), -364)), today())}>Last 12 months</SecondaryButton>
            </div>
          </div>
          {tab === "overview" && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
              <span className="mr-1">Export as CSV or Excel:</span>
              {EXPORTS.map((item) => (
                <span key={item.id} className="inline-flex items-center overflow-hidden rounded-md border border-neutral-200">
                  <span className="px-2 py-1 font-medium text-neutral-700">{item.label}</span>
                  {(["csv", "xlsx"] as const).map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => download(item, format)}
                      disabled={exporting === `${item.id}.${format}`}
                      title={`${item.label} as ${format === "csv" ? "CSV" : "an Excel workbook (.xlsx)"}`}
                      className="border-l border-neutral-200 px-1.5 py-1 font-semibold text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50"
                    >
                      {exporting === `${item.id}.${format}` ? "…" : FORMAT_LABELS[format]}
                    </button>
                  ))}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {tab === "daily" && <DailySales from={from} to={to} />}
      {tab === "overview" && error && <p data-print-hide className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {tab !== "overview" ? null : loading || !data ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div data-print-cols="3" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Kpi label="Revenue" value={money(data.kpis.revenue)} hint={`memberships ${money(data.kpis.membership_revenue)} · shop ${money(data.kpis.shop_revenue)}`} />
            <Kpi label="Expenses" value={money(data.kpis.expenses)} hint={data.kpis.expenses_pending ? `paid · ${money(data.kpis.expenses_pending)} pending, not deducted` : "paid"} />
            <Kpi label="Net" value={money(data.kpis.net)} tone={data.kpis.net >= 0 ? "text-emerald-700" : "text-rose-700"} hint="same as Accounts for this range" />
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
              <HBarList rows={data.top_products.map((p) => ({ label: p.name, value: p.total, hint: `(${p.quantity} sold · margin ${money(p.margin)})` }))} valueLabel={money} />
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
