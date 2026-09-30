"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  FiActivity,
  FiUserCheck,
  FiTag,
  FiUsers,
  FiAlertCircle,
  FiTrendingUp,
  FiClock,
  FiCalendar,
} from "react-icons/fi";
import { PageHeader, Card, Spinner, Badge, ErrorState } from "./_shared/ui";
import { API_BASE, apiGet } from "./_shared/api";

interface Totals {
  base_currency: string;
  base_amount: number;
  headline_amount: number;
  headline_currency: string;
  mixed?: boolean;
  by_currency: { currency: string; amount: number }[];
}

interface Dashboard {
  today: string;
  base_currency: string;
  revenue: Totals & { orders: number; period: string; note: string };
  revenue_today: Totals & {
    memberships: number;
    admission: number;
    shop: number;
    payments: number;
    sales: number;
    period: string;
  };
  expenses_today: Totals & { entries: number; period: string };
  expenses: Totals & { entries: number; period: string };
  members: {
    total: number;
    active: number;
    expiring: number;
    lapsed: number;
    never_bought: number;
    new_this_month: number;
    expiring_window_days: number;
  };
  attendance_today: {
    member: number;
    staff: number;
    still_in: number;
    paid: number;
    unpaid: number;
    balance_due?: number;
  };
  classes_today: {
    count: number;
    booked: number;
    sessions: {
      class_name: string;
      start_time: string;
      end_time: string;
      instructor_name: string;
      capacity: number;
      booked: number;
      waitlist: number;
      is_closed: boolean;
    }[];
  };
  needs_attention: {
    expiring_memberships: number;
    open_contact_queries: number;
    pending_registrations: number;
  };
  catalogue: { classes: number; trainers: number; packages: number };
  recent_members: { id: string; name: string; email: string; code: string; joined: string }[];
  expiring_soon: {
    order_number: string;
    name: string;
    email: string;
    package: string;
    ends: string;
    days_left: number | null;
  }[];
}

// Intl throws a RangeError on anything that is not an ISO 4217 code, and the
// currency is free text in the setup wizard -- a gym that typed "Rs" must not
// lose its whole dashboard over it.
const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "GBP",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `${currency || ""} ${Math.round(amount || 0).toLocaleString()}`.trim();
  }
};

const shortDate = (value: string) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : "—";

// The full list behind the fees-due card: members whose membership ends
// within the same window the dashboard counts.
const feeExpiryHref = (days: number) => `/admin/fee-expiry?days=${days}`;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{children}</p>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const ring =
    tone === "warn"
      ? "border-amber-200 bg-amber-50/40"
      : tone === "bad"
      ? "border-rose-200 bg-rose-50/40"
      : tone === "good"
      ? "border-emerald-200 bg-emerald-50/40"
      : "border-neutral-200 bg-white";

  const inner = (
    <div className={`h-full rounded-lg border p-5 transition-colors ${ring} ${href ? "hover:border-neutral-400" : ""}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-900">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-neutral-500">{hint}</p>}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function AdminHomePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiGet<Dashboard>(`${API_BASE}/admin/dashboard`));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load the dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <Spinner />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div>
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <ErrorState message={err || "Could not load the dashboard"} onRetry={load} />
      </div>
    );
  }

  const attention =
    data.needs_attention.expiring_memberships +
    data.needs_attention.open_contact_queries +
    data.needs_attention.pending_registrations;

  return (
    <div>
      <PageHeader eyebrow="Overview" title="Dashboard" />

      {/* The row an owner reads first: today's money in and out, who came in
          (and whether they had paid), what is on. */}
      <SectionLabel>Today</SectionLabel>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Revenue today"
          value={money(data.revenue_today.headline_amount, data.revenue_today.headline_currency)}
          hint={`memberships ${money(data.revenue_today.memberships, data.base_currency)} · admission ${money(
            data.revenue_today.admission,
            data.base_currency
          )} · shop ${money(data.revenue_today.shop, data.base_currency)}${
            data.revenue_today.mixed ? " · other currencies not summed" : ""
          }`}
          href={`/admin/reports?tab=daily&from=${data.today}&to=${data.today}`}
          tone="good"
        />
        <Stat
          label="Expenses today"
          value={money(data.expenses_today.headline_amount, data.expenses_today.headline_currency)}
          hint={
            data.expenses_today.entries
              ? `${data.expenses_today.entries} paid expense${data.expenses_today.entries === 1 ? "" : "s"}`
              : "no paid expenses today"
          }
          href="/admin/accounts"
        />
        <Stat
          label="Members in today"
          value={data.attendance_today.member}
          hint={`${data.attendance_today.paid} paid${
            data.attendance_today.balance_due ? ` (${data.attendance_today.balance_due} owing)` : ""
          } · ${data.attendance_today.unpaid} unpaid · ${data.attendance_today.staff} staff${
            data.attendance_today.still_in > 0 ? ` · ${data.attendance_today.still_in} still in` : ""
          }`}
          href="/admin/attendance"
          tone={data.attendance_today.unpaid > 0 ? "warn" : "neutral"}
        />
        <Stat
          label="Classes today"
          value={data.classes_today.count}
          hint={`${data.classes_today.booked} places booked`}
          href="/admin/bookings"
          tone="neutral"
        />
      </div>

      <SectionLabel>This month · {data.revenue.period}</SectionLabel>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Revenue"
          value={money(data.revenue.headline_amount, data.revenue.headline_currency)}
          hint={
            data.revenue.mixed
              ? `${data.revenue.orders} orders · other currencies not summed`
              : `${data.revenue.orders} paid orders`
          }
          href="/admin/accounts"
          tone="good"
        />
        <Stat
          label="Expenses"
          value={money(data.expenses.headline_amount, data.expenses.headline_currency)}
          hint={`${data.expenses.entries} paid expense${data.expenses.entries === 1 ? "" : "s"}`}
          href="/admin/accounts"
        />
        <Stat
          label="New this month"
          value={data.members.new_this_month}
          hint={`${data.members.total} members in total`}
          href="/admin/users"
        />
        <Stat
          label="Active memberships"
          value={data.members.active}
          hint={`${data.members.total} members · ${data.members.never_bought} never bought`}
          href="/admin/package-orders"
        />
      </div>

      {/* Things somebody has to do something about — separated from the
          numbers above, which are only for looking at. */}
      {attention > 0 && (
        <Card className="mb-8 p-5">
          <div className="mb-4 flex items-center gap-2">
            <FiAlertCircle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-neutral-900">Needs attention</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {data.needs_attention.expiring_memberships > 0 && (
              <Link
                href={feeExpiryHref(data.members.expiring_window_days)}
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 hover:border-amber-300"
              >
                <p className="text-lg font-semibold text-amber-900">
                  {data.needs_attention.expiring_memberships}
                </p>
                <p className="text-[12px] text-amber-800">
                  fees due within {data.members.expiring_window_days} days
                </p>
              </Link>
            )}
            {data.needs_attention.open_contact_queries > 0 && (
              <Link
                href="/admin/contact-queries"
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 hover:border-amber-300"
              >
                <p className="text-lg font-semibold text-amber-900">
                  {data.needs_attention.open_contact_queries}
                </p>
                <p className="text-[12px] text-amber-800">unanswered enquiries</p>
              </Link>
            )}
            {data.needs_attention.pending_registrations > 0 && (
              <Link
                href="/admin/package-registrations"
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 hover:border-amber-300"
              >
                <p className="text-lg font-semibold text-amber-900">
                  {data.needs_attention.pending_registrations}
                </p>
                <p className="text-[12px] text-amber-800">registrations not followed up</p>
              </Link>
            )}
          </div>
        </Card>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's timetable */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiCalendar className="h-4 w-4 text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Today&apos;s classes</h2>
            </div>
            <Link href="/admin/bookings" className="text-[12px] font-medium text-neutral-500 hover:text-neutral-900">
              All bookings →
            </Link>
          </div>

          {data.classes_today.sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">Nothing scheduled today.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.classes_today.sessions.map((s, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <span className="w-14 shrink-0 text-sm font-semibold text-neutral-900">
                    {s.start_time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{s.class_name}</p>
                    {s.instructor_name && (
                      <p className="truncate text-[12px] text-neutral-500">{s.instructor_name}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[12px] text-neutral-600">
                    {s.booked}/{s.capacity}
                    {s.waitlist > 0 && ` · ${s.waitlist} waiting`}
                  </span>
                  {s.is_closed && <Badge color="neutral">Closed</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Fees coming due — the most actionable list in the panel. The
            count is people; the list shows the soonest few orders. */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiClock className="h-4 w-4 text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">
                Fees due · next {data.members.expiring_window_days} days
              </h2>
              {data.members.expiring > 0 && <Badge color="amber">{data.members.expiring}</Badge>}
            </div>
            <Link
              href={feeExpiryHref(data.members.expiring_window_days)}
              className="text-[12px] font-medium text-neutral-500 hover:text-neutral-900"
            >
              View all →
            </Link>
          </div>

          {data.expiring_soon.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">
              Nothing lapsing in the next {data.members.expiring_window_days} days.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.expiring_soon.map((m) => (
                <li key={m.order_number} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{m.name || m.email}</p>
                    <p className="truncate text-[12px] text-neutral-500">{m.package}</p>
                  </div>
                  <Badge color={m.days_left !== null && m.days_left <= 3 ? "rose" : "amber"}>
                    {m.days_left !== null
                      ? m.days_left <= 0
                        ? "today"
                        : `${m.days_left}d`
                      : shortDate(m.ends)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Membership health + newest members */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <FiTrendingUp className="h-4 w-4 text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900">Membership health</h2>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            {[
              { label: "Active", value: data.members.active, tone: "text-emerald-700" },
              { label: "Expiring", value: data.members.expiring, tone: "text-amber-700" },
              { label: "Lapsed", value: data.members.lapsed, tone: "text-rose-700" },
              { label: "Never bought", value: data.members.never_bought, tone: "text-neutral-700" },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-[12px] text-neutral-500">{row.label}</dt>
                <dd className={`text-xl font-semibold ${row.tone}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] text-neutral-500">{data.revenue.note}.</p>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiUsers className="h-4 w-4 text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-900">Newest members</h2>
            </div>
            <Link href="/admin/users" className="text-[12px] font-medium text-neutral-500 hover:text-neutral-900">
              All members →
            </Link>
          </div>
          {data.recent_members.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">No members yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.recent_members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{m.name}</p>
                    <p className="truncate text-[12px] text-neutral-500">{m.email}</p>
                  </div>
                  <span className="shrink-0 text-[12px] text-neutral-500">{shortDate(m.joined)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Catalogue counts, demoted to the bottom: they are reference, not news. */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        {[
          { name: "Classes", href: "/admin/classes", icon: FiActivity, count: data.catalogue.classes },
          { name: "Trainers", href: "/admin/trainers", icon: FiUserCheck, count: data.catalogue.trainers },
          { name: "Packages", href: "/admin/packages", icon: FiTag, count: data.catalogue.packages },
        ].map((c) => (
          <Link
            key={c.name}
            href={c.href}
            className="group flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-5 py-4 hover:border-neutral-300"
          >
            <span className="text-sm font-medium text-neutral-700">{c.name}</span>
            <span className="flex items-center gap-2">
              <span className="text-lg font-semibold text-neutral-900">{c.count}</span>
              <c.icon className="h-4 w-4 text-neutral-400 group-hover:text-[var(--accent)]" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
