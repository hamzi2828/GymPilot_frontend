"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FiActivity,
  FiUserCheck,
  FiTag,
  FiShoppingBag,
  FiClipboard,
  FiUsers,
  FiMessageSquare,
  FiImage,
  FiBookOpen,
} from "react-icons/fi";
import { PageHeader, Card, Spinner } from "./_shared/ui";
import { GYMFOLIO_API, apiGet } from "./_shared/api";

interface StatRow {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [classes, trainers, packages, pkgOrders, regs] = await Promise.all([
          apiGet<{ data: unknown[] }>(`${GYMFOLIO_API}/gym-classes`).catch(() => ({ data: [] })),
          apiGet<{ data: unknown[] }>(`${GYMFOLIO_API}/trainers`).catch(() => ({ data: [] })),
          apiGet<{ data: unknown[] }>(`${GYMFOLIO_API}/packages`).catch(() => ({ data: [] })),
          apiGet<{ data: unknown[] }>(`${GYMFOLIO_API}/package-orders`).catch(() => ({ data: [] })),
          apiGet<{ data: unknown[] }>(`${GYMFOLIO_API}/package-registrations`).catch(() => ({ data: [] })),
        ]);
        setStats([
          { name: "Classes", href: "/admin/classes", icon: FiActivity, count: classes.data?.length || 0 },
          { name: "Trainers", href: "/admin/trainers", icon: FiUserCheck, count: trainers.data?.length || 0 },
          { name: "Packages", href: "/admin/packages", icon: FiTag, count: packages.data?.length || 0 },
          { name: "Package Orders", href: "/admin/package-orders", icon: FiShoppingBag, count: pkgOrders.data?.length || 0 },
          { name: "Registrations", href: "/admin/package-registrations", icon: FiClipboard, count: regs.data?.length || 0 },
        ]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const quickLinks: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { name: "Users", href: "/admin/users", icon: FiUsers },
    { name: "Contact Queries", href: "/admin/contact-queries", icon: FiMessageSquare },
    { name: "Hero Slides", href: "/admin/hero-slides", icon: FiImage },
    { name: "Blogs", href: "/admin/blogs", icon: FiBookOpen },
  ];

  return (
    <div>
      <PageHeader eyebrow="Overview" title="Dashboard" />

      {loading ? (
        <Spinner />
      ) : (
        <>
          {err && (
            <div className="mb-4 bg-white border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
            {stats.map((s) => (
              <Link
                key={s.name}
                href={s.href}
                className="group bg-white border border-neutral-200 rounded-lg p-5 hover:border-neutral-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                    {s.name}
                  </span>
                  <s.icon className="w-4 h-4 text-neutral-400 group-hover:text-[#bee304] transition-colors" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-neutral-900">{s.count}</p>
              </Link>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-neutral-900 mb-3">Quick Links</h2>
          <Card>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-neutral-100">
              {quickLinks.map((q) => (
                <Link
                  key={q.name}
                  href={q.href}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-neutral-50 transition-colors"
                >
                  <q.icon className="w-5 h-5 text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-700">{q.name}</span>
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
