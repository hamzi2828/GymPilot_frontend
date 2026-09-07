"use client";

// The list of gyms, with search, status filters and the numbers from each
// gym's own database. Used on the overview (compact) and the Gyms page.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge, EmptyState, Spinner } from "../../admin/_shared/ui";
import { platformFetch, planOf, formatDate, type Gym } from "../_shared/api";

type Pagination = { page: number; page_size: number; total: number; pages: number };

export function SubscriptionBadge({ status }: { status: Gym["subscription"]["status"] }) {
  const color = status === "active" ? "green" : status === "trialing" ? "blue" : status === "past_due" ? "amber" : "rose";
  return <Badge color={color}>{status.replace("_", " ")}</Badge>;
}

export default function GymsTable({ title, compact = false }: { title?: string; compact?: boolean }) {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [subscription, setSubscription] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), withStats: "1" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (subscription) params.set("subscription", subscription);
      const res = await platformFetch<{ data: Gym[]; pagination: Pagination }>(`/gyms?${params.toString()}`);
      setGyms(res.data);
      setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load gyms");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, subscription]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const select = "h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700";

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {title && <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search name, slug, domain, owner…"
            className="h-9 w-64 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-neutral-400 focus:outline-none"
          />
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className={select}
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <select
            value={subscription}
            onChange={(e) => {
              setPage(1);
              setSubscription(e.target.value);
            }}
            className={select}
          >
            <option value="">Any subscription</option>
            <option value="trialing">Trialing</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      {loading ? (
        <Spinner />
      ) : !gyms.length ? (
        <EmptyState title="No gyms match" hint="Create one with the New gym button." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["Gym", "Domains", "Plan", "Subscription", "Members", "Active memberships", "Last activity", ...(compact ? [] : ["Database"])].map((c) => (
                    <th key={c} className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gyms.map((gym) => {
                  const plan = planOf(gym);
                  const stats = gym.stats || {};
                  return (
                    <tr key={gym.id} className="border-b border-neutral-100 last:border-b-0 transition-colors hover:bg-neutral-50">
                      <td className="px-5 py-3.5 align-middle">
                        <Link href={`/super-admin/gyms/${gym.id}`} className="font-medium text-neutral-900 hover:underline">
                          {gym.name}
                        </Link>
                        <p className="text-xs text-neutral-500">
                          {gym.slug}
                          {gym.status === "suspended" && (
                            <span className="ml-2">
                              <Badge color="rose">suspended</Badge>
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-middle text-neutral-700">
                        {gym.domains.length ? gym.domains.map((d) => d.host).join(", ") : <span className="text-neutral-400">none</span>}
                      </td>
                      <td className="px-5 py-3.5 align-middle text-neutral-700">{plan ? plan.name : <span className="text-neutral-400">—</span>}</td>
                      <td className="px-5 py-3.5 align-middle">
                        <SubscriptionBadge status={gym.subscription.status} />
                        <p className="mt-1 text-xs text-neutral-500">
                          {gym.subscription.currentPeriodEnd ? `until ${formatDate(gym.subscription.currentPeriodEnd)}` : "no end date"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-middle text-neutral-700">{stats.error ? "—" : stats.members ?? "—"}</td>
                      <td className="px-5 py-3.5 align-middle text-neutral-700">{stats.error ? "—" : stats.active_memberships ?? "—"}</td>
                      <td className="px-5 py-3.5 align-middle text-neutral-700">{formatDate(stats.last_visit_at || stats.last_login_at)}</td>
                      {!compact && <td className="px-5 py-3.5 align-middle font-mono text-xs text-neutral-500">{gym.database.name}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Page {pagination.page} of {pagination.pages} · {pagination.total} gyms
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
