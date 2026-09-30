"use client";

// Daily sales: for every day in the range, the money that came in under each
// heading -- new sign-ups, renewals, admission and trainer fees, dues, the
// till, less refunds -- and the totals by payment method. The same figures
// download as CSV or as an Excel workbook.

import { useCallback, useEffect, useState } from "react";
import { Card, Spinner, ErrorState, Toggle } from "../_shared/ui";
import { API_BASE, apiGet } from "../_shared/api";
import { downloadExport, FORMAT_LABELS, type ExportFormat } from "./download";

type Column = "new_signups" | "renewals" | "admission" | "trainer_fees" | "dues" | "refunds" | "pos";

interface Day extends Record<Column, number> {
  date?: string;
  label: string;
  total: number;
  payments: number;
  sales: number;
  methods: Record<string, number>;
}

interface DailySalesReport {
  range: { from: string; to: string; label: string };
  base_currency: string;
  days: Day[];
  totals: Day;
  by_method: { method: string; label: string; amount: number }[];
  other_currency: { count: number; currencies: string[] };
}

// The report's columns, in the order the export writes them.
const COLUMNS: { key: Column; label: string; hint: string }[] = [
  { key: "new_signups", label: "New sign-ups", hint: "first payments, less admission and trainer fees" },
  { key: "renewals", label: "Renewals", hint: "renewal payments, less any fees" },
  { key: "admission", label: "Admission", hint: "joining fees" },
  { key: "trainer_fees", label: "Trainer fees", hint: "trainer fees taken with a membership" },
  { key: "dues", label: "Dues", hint: "later part-payments of dues owed" },
  { key: "refunds", label: "Refunds", hint: "membership money given back" },
  { key: "pos", label: "POS", hint: "till sales, refunded ones left out" },
];

const amount = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function DailySales({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<DailySalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [hideQuiet, setHideQuiet] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<DailySalesReport>(`${API_BASE}/admin/reports/daily-sales?from=${from}&to=${to}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the daily sales");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (format: ExportFormat) => {
    setExporting(format);
    try {
      await downloadExport(
        `${API_BASE}/admin/reports/export/daily-sales?from=${from}&to=${to}${format === "xlsx" ? "&format=xlsx" : ""}`,
        `daily_sales.${format}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const money = (n: number) => `${data.base_currency} ${amount(n)}`;
  const days = hideQuiet ? data.days.filter((d) => d.total !== 0 || d.payments > 0 || d.sales > 0) : data.days;

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Daily sales · {data.range.label} <span className="font-normal text-neutral-500">({data.base_currency})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Toggle label="Hide days with no sales" checked={hideQuiet} onChange={setHideQuiet} />
          <span className="inline-flex items-center overflow-hidden rounded-md border border-neutral-200">
            <span className="px-2 py-1 font-medium text-neutral-700">Download</span>
            {(["csv", "xlsx"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => download(format)}
                disabled={exporting === format}
                className="border-l border-neutral-200 px-1.5 py-1 font-semibold text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50"
              >
                {exporting === format ? "…" : FORMAT_LABELS[format]}
              </button>
            ))}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Total taken</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{money(data.totals.total)}</p>
          <p className="text-xs text-neutral-500">
            {data.totals.payments} membership payments · {data.totals.sales} till sales
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.key} className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{c.label}</p>
            <p className={`mt-1 text-xl font-semibold ${data.totals[c.key] < 0 ? "text-rose-700" : "text-neutral-900"}`}>
              {money(data.totals[c.key])}
            </p>
            <p className="text-xs text-neutral-500">{c.hint}</p>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80">
                <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                  Date
                </th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500"
                  >
                    {c.label}
                  </th>
                ))}
                <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-900">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-sm text-neutral-400">
                    No sales in this range.
                  </td>
                </tr>
              )}
              {days.map((d) => (
                <tr key={d.date} className="border-b border-neutral-100 last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-700">{d.label}</td>
                  {COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-4 py-2 text-right tabular-nums ${
                        d[c.key] < 0 ? "text-rose-700" : d[c.key] ? "text-neutral-700" : "text-neutral-300"
                      }`}
                    >
                      {d[c.key] ? amount(d[c.key]) : "—"}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums text-neutral-900">
                    {amount(d.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold text-neutral-900">
                <td className="px-4 py-3">Total</td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${data.totals[c.key] < 0 ? "text-rose-700" : ""}`}>
                    {amount(data.totals[c.key])}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{amount(data.totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">By payment method</h3>
          {data.by_method.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing taken in this range.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.by_method.map((m) => (
                  <tr key={m.method} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-2 text-neutral-700">{m.label}</td>
                    <td className="py-2 text-right text-xs text-neutral-400 tabular-nums">
                      {data.totals.total ? `${Math.round((m.amount / data.totals.total) * 100)}%` : ""}
                    </td>
                    <td className={`py-2 pl-4 text-right font-medium tabular-nums ${m.amount < 0 ? "text-rose-700" : "text-neutral-900"}`}>
                      {money(m.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300 font-semibold text-neutral-900">
                  <td className="py-2">Total</td>
                  <td />
                  <td className="py-2 pl-4 text-right tabular-nums">{money(data.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Card>
        <Card className="p-5 text-xs leading-relaxed text-neutral-500">
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">How the columns add up</h3>
          <p>
            Each day&apos;s total is that day&apos;s income on the Accounts screen: every membership payment on the day it
            arrived, less refunds given that day, plus till sales. A payment is split into its membership share, admission
            fee and trainer fee; a later payment towards dues owed is counted whole under Dues. Refunds are shown as a
            minus on the day the money went back. Payments recorded before fees were split out count wholly as membership
            money.
          </p>
          {data.other_currency.count > 0 && (
            <p className="mt-2 text-amber-700">
              {data.other_currency.count} payment{data.other_currency.count === 1 ? "" : "s"} in{" "}
              {data.other_currency.currencies.join(", ")} not included: there is no exchange rate to add them in.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
