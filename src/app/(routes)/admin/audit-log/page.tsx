"use client";

// Who changed what in this admin panel: every write that passed a
// permission check, with the request summarised and secrets stripped.

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card, Spinner, EmptyState, Badge } from "../_shared/ui";
import { API_BASE, apiGet } from "../_shared/api";
import { LoadError } from "../_ops/lists";

interface Row {
  _id: string;
  actorEmail: string;
  actorRole: string;
  method: string;
  path: string;
  tab: string;
  status: number;
  body: Record<string, unknown> | null;
  ip: string;
  createdAt: string;
}

const METHOD_COLOR: Record<string, "green" | "blue" | "amber" | "rose" | "neutral"> = { POST: "green", PUT: "blue", PATCH: "blue", DELETE: "rose" };

export default function AuditLogPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ actor: "", tab: "", method: "" });
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (filters.actor.trim()) params.set("actor", filters.actor.trim());
      if (filters.tab) params.set("tab", filters.tab);
      if (filters.method) params.set("method", filters.method);
      const r = await apiGet<{ data: Row[]; pagination: { total: number; pages: number } }>(`${API_BASE}/admin/audit-log?${params.toString()}`);
      setRows(r.data || []);
      setTotal(r.pagination?.total || 0);
      setPages(r.pagination?.pages || 1);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the audit log");
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    const t = setTimeout(load, filters.actor ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.actor]);

  const select = "h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700";

  return (
    <div>
      <PageHeader eyebrow="System" title="Audit log" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={filters.actor} onChange={(e) => { setPage(1); setFilters({ ...filters, actor: e.target.value }); }} placeholder="Filter by staff email…" className="h-9 w-64 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-neutral-400 focus:outline-none" />
        <input value={filters.tab} onChange={(e) => { setPage(1); setFilters({ ...filters, tab: e.target.value }); }} placeholder="Area (e.g. packages)" className="h-9 w-48 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-neutral-400 focus:outline-none" />
        <select value={filters.method} onChange={(e) => { setPage(1); setFilters({ ...filters, method: e.target.value }); }} className={select}>
          <option value="">Any action</option>
          <option value="POST">Create</option>
          <option value="PUT">Update</option>
          <option value="PATCH">Change</option>
          <option value="DELETE">Delete</option>
        </select>
        <span className="text-xs text-neutral-500">{total} entries</span>
      </div>

      {error && <LoadError message={error} onRetry={load} />}

      {loading ? (
        <Spinner />
      ) : error && !rows.length ? null : !rows.length ? (
        <EmptyState title="Nothing recorded yet" hint="Changes made in the admin panel appear here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["When", "Who", "Action", "Area", "Request", "Result"].map((c) => (
                    <th key={c} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="border-b border-neutral-100 last:border-b-0 align-top hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-600">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <p className="text-neutral-900">{r.actorEmail}</p>
                      <p className="text-xs text-neutral-500">{r.actorRole} · {r.ip}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={METHOD_COLOR[r.method] || "neutral"}>{r.method}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-700">{r.tab}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-neutral-700">{r.path}</code>
                      {r.body && (
                        <button type="button" onClick={() => setOpen(open === r._id ? null : r._id)} className="ml-2 text-[11px] font-semibold text-neutral-500 underline">
                          {open === r._id ? "hide" : "details"}
                        </button>
                      )}
                      {open === r._id && r.body && <pre className="mt-2 max-w-xl overflow-x-auto rounded bg-neutral-50 p-2 text-[11px] text-neutral-600">{JSON.stringify(r.body, null, 2)}</pre>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={r.status < 300 ? "green" : r.status < 500 ? "amber" : "rose"}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
