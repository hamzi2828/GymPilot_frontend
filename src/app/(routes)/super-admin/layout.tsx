"use client";

// The platform panel: every gym on GymPilot, their plans and their numbers.
//
// Not part of any gym's website. It has its own session (see _shared/api.ts)
// and its own shell -- the gym admin's sidebar, permissions and theme do not
// apply here, and the gym header/footer are hidden by ClientLayout.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiGrid, FiHome, FiLayers, FiList, FiLogOut, FiUser } from "react-icons/fi";
import { clearPlatformToken, getPlatformToken, platformFetch, type PlatformAdmin } from "./_shared/api";

const NAV = [
  { name: "Overview", path: "/super-admin", icon: <FiHome className="h-[18px] w-[18px]" />, exact: true },
  { name: "Gyms", path: "/super-admin/gyms", icon: <FiGrid className="h-[18px] w-[18px]" /> },
  { name: "Plans", path: "/super-admin/plans", icon: <FiLayers className="h-[18px] w-[18px]" /> },
  { name: "Audit log", path: "/super-admin/audit", icon: <FiList className="h-[18px] w-[18px]" /> },
  { name: "My account", path: "/super-admin/account", icon: <FiUser className="h-[18px] w-[18px]" /> },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Pages that work without a session: sign-in and the password reset flow.
  const isLogin = pathname === "/super-admin/login" || pathname === "/super-admin/forgot" || pathname === "/super-admin/reset";

  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isLogin) {
      setChecked(true);
      return;
    }
    if (!getPlatformToken()) {
      router.replace("/super-admin/login");
      return;
    }
    let cancelled = false;
    platformFetch<{ admin: PlatformAdmin }>("/auth/me")
      .then((res) => {
        if (!cancelled) setAdmin(res.admin);
      })
      .catch(() => {
        if (!cancelled) router.replace("/super-admin/login");
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLogin, router]);

  if (isLogin) return <>{children}</>;

  if (!checked || !admin) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  const signOut = () => {
    clearPlatformToken();
    router.replace("/super-admin/login");
  };

  return (
    <div className="admin-scroll flex h-screen bg-white text-neutral-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-950 text-neutral-200">
        <div className="px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">GymPilot</p>
          <p className="mt-1 text-sm font-semibold text-white">Platform panel</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-5 py-4">
          <p className="truncate text-xs text-neutral-400">{admin.email}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-neutral-300 hover:text-white"
          >
            <FiLogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-scroll flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
