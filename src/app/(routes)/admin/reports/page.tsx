"use client";

// Reports: the business over a range -- revenue against expenses, new
// members, visits and peak hours, classes by demand, memberships kept and
// lost, leads and personal training -- with every list exportable as CSV.

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card, SecondaryButton, TextField, Spinner } from "../_shared/ui";
import { API_BASE, apiGet, authHeaders } from "../_shared/api";
import { BarChart, LineChart, HBarList, type Point } from "../_shared/Charts";

interface Report {
  range: { from: string; to: string; label: string; grain: "day" | "month" };
  base_currency: string;
  kpis: {
    revenue: number;
    expenses: number;
    net: number;
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
  leads: { new: number; contacted: number; trial: number; won: number; lost: number; total: number };
}

const today = () => new Date().toISOString().slice(0, 10);
const shift = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const monthStart = (key: string) => `${key.slice(0, 7)}-01`;
const EXPORTS = [
  ["members", "Members"],
  ["orders", "Orders"],
  ["attendance", "Attendance"],
  ["bookings", "Bookings"],
  ["leads", "Leads"],
  ["pt-sessions", "PT sessions"],
  ["expenses", "Expenses"],
  ["payslips", "Payslips"],
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

export default function ReportsPage() {
  const [from, setFrom] = useState(monthStart(today()));
  const [to, setTo] = useState(today());
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<Report>(`${API_BASE}/admin/reports/overview?from=${from}&to=${to}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the report");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const preset = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
  };

  const download = async (kind: string) => {
    setExporting(kind);
    try {
      const res = await fetch(`${API_BASE}/admin/reports/export/${kind}?from=${from}&to=${to}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const name = (res.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || `${kind}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const money = (n: number) => `${data?.base_currency || ""} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <PageHeader eyebrow="Overview" title="Reports" />

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <TextField label="From" type="date" value={from} onChange={setFrom} />
          </div>
          <div className="w-40">
            <TextField label="To" type="date" value={to} onChange={setTo} />
          </div>
          <div className="flex flex-wrap gap-1.5 pb-1">
            <SecondaryButton onClick={() => preset(monthStart(today()), today())}>This month</SecondaryButton>
            <SecondaryButton onClick={() => preset(shift(today(), -29), today())}>Last 30 days</SecondaryButton>
            <SecondaryButton onClick={() => preset(shift(today(), -89), today())}>Last 90 days</SecondaryButton>
            <SecondaryButton onClick={() => preset(monthStart(shift(today(), -364)), today())}>Last 12 months</SecondaryButton>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <span className="mr-1">Export CSV (opens in Excel):</span>
          {EXPORTS.map(([kind, label]) => (
            <button key={kind} type="button" onClick={() => download(kind)} disabled={exporting === kind} className="rounded-md border border-neutral-200 px-2 py-1 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
              {exporting === kind ? "…" : label}
            </button>
          ))}
        </div>
      </Card>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {loading || !data ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Kpi label="Revenue" value={money(data.kpis.revenue)} hint={`${data.kpis.paid_orders} paid orders`} />
            <Kpi label="Expenses" value={money(data.kpis.expenses)} />
            <Kpi label="Net" value={money(data.kpis.net)} tone={data.kpis.net >= 0 ? "text-emerald-700" : "text-rose-700"} />
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">Revenue and expenses · {data.range.label}</h2>
              <LineChart series={[{ name: "Revenue", data: data.series.revenue }, { name: "Expenses", color: "#f43f5e", data: data.series.expenses }]} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-neutral-900">New members</h2>
              <BarChart data={data.series.new_members} />
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
