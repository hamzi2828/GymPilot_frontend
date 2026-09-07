"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiAlertCircle, FiGrid, FiPauseCircle, FiTrendingUp } from "react-icons/fi";
import { PageHeader, Card, Spinner, Badge } from "../admin/_shared/ui";
import { platformFetch, formatMoney, type Overview } from "./_shared/api";
import GymsTable from "./gyms/GymsTable";

function Stat({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: string; icon: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
        </div>
        <div className="rounded-lg bg-neutral-100 p-2 text-neutral-500">{icon}</div>
      </div>
    </Card>
  );
}

export default function SuperAdminOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platformFetch<{ data: Overview }>("/overview")
      .then((res) => setOverview(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load overview"));
  }, []);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!overview) return <Spinner />;

  const subs = overview.subscriptions;

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Overview"
        actions={
          <Link
            href="/super-admin/gyms/new"
            className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            New gym
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Gyms"
          value={overview.gyms.total}
          hint={`${overview.gyms.active} active`}
          icon={<FiGrid className="h-5 w-5" />}
        />
        <Stat
          label="Suspended"
          value={overview.gyms.suspended}
          hint={`${subs.expired || 0} expired · ${subs.cancelled || 0} cancelled`}
          icon={<FiPauseCircle className="h-5 w-5" />}
        />
        <Stat
          label="Renewing within 30 days"
          value={overview.expiring_within_30_days}
          hint={`${subs.trialing || 0} on trial · ${subs.past_due || 0} past due`}
          icon={<FiAlertCircle className="h-5 w-5" />}
        />
        <Stat
          label="Monthly recurring"
          value={
            overview.mrr.length ? (
              <span className="flex flex-wrap gap-2">
                {overview.mrr.map((row) => (
                  <span key={row.currency}>{formatMoney(row.amount, row.currency)}</span>
                ))}
              </span>
            ) : (
              "—"
            )
          }
          hint="Active subscriptions, yearly plans divided by 12"
          icon={<FiTrendingUp className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {Object.entries(subs).map(([status, count]) => (
          <Badge key={status} color={status === "active" ? "green" : status === "trialing" ? "blue" : status === "past_due" ? "amber" : "rose"}>
            {status.replace("_", " ")}: {count}
          </Badge>
        ))}
      </div>

      <div className="mt-10">
        <GymsTable title="Gyms" compact />
      </div>
    </>
  );
}
