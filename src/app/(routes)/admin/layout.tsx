"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { PermissionsProvider, usePermissions } from "@/components/admin/PermissionsProvider";
import { isAuthenticated } from "@/helper/helper";

// Which tab each admin route belongs to. Longest prefix wins, so
// /admin/package-registrations is not mistaken for /admin/package-orders.
const ROUTE_TABS: { prefix: string; tab: string }[] = [
  { prefix: "/admin/classes", tab: "classes" },
  { prefix: "/admin/trainers", tab: "trainers" },
  { prefix: "/admin/packages", tab: "packages" },
  { prefix: "/admin/package-orders", tab: "package-orders" },
  { prefix: "/admin/package-registrations", tab: "registrations" },
  { prefix: "/admin/attendance", tab: "attendance" },
  { prefix: "/admin/accounts", tab: "accounts" },
  { prefix: "/admin/staff", tab: "staff" },
  { prefix: "/admin/roles", tab: "roles" },
  { prefix: "/admin/users", tab: "users" },
  { prefix: "/admin/contact-queries", tab: "contact-queries" },
  { prefix: "/admin/homepage", tab: "homepage" },
  { prefix: "/admin/hero-slides", tab: "hero-slides" },
  { prefix: "/admin/testimonials", tab: "testimonials" },
  { prefix: "/admin/blog-settings", tab: "blog-settings" },
  { prefix: "/admin/blogs", tab: "blogs" },
  { prefix: "/admin/settings", tab: "settings" },
];

function tabForPath(pathname: string | null): string {
  if (!pathname) return "dashboard";
  const match = ROUTE_TABS.filter((entry) => pathname.startsWith(entry.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length
  )[0];
  return match ? match.tab : "dashboard";
}

// The shell, once permissions are known.
//
// Access is decided by permissions rather than by role === "admin": that check
// is what would keep a receptionist out of a panel their role was created to
// let them into. Anyone holding at least one tab gets in, and the page they
// asked for is checked separately.
function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { loading, tabs, can, me } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  const tab = tabForPath(pathname);
  const allowedHere = tab === "dashboard" ? tabs.length > 0 : can(tab);

  useEffect(() => {
    if (loading) return;
    // No tabs at all means this is a gym member who found the URL.
    if (!tabs.length) router.replace("/");
  }, [loading, tabs, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-[var(--accent)]" />
      </div>
    );
  }

  if (!tabs.length) return null;

  return (
    <div className="admin-scroll flex h-screen bg-white text-neutral-900">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader isSidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />

        <main className="admin-scroll flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-[1400px]">
            {allowedHere ? (
              children
            ) : (
              // Told plainly rather than redirected: a page that silently
              // bounces somewhere else reads as a broken link, and the person
              // needs to know it is their role so they can ask for the right
              // thing.
              <div className="mx-auto max-w-md rounded-xl border border-neutral-200 bg-white px-6 py-10 text-center">
                <p className="text-sm font-semibold text-neutral-900">You do not have access to this page</p>
                <p className="mt-2 text-[13px] text-neutral-500">
                  Your role{me?.role_name ? ` (${me.role_name})` : ""} does not include the{" "}
                  <span className="font-medium text-neutral-700">{tab}</span> section. Ask an administrator
                  to grant it under Roles &amp; Access.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/admin")}
                  className="mt-5 inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white"
                >
                  Back to dashboard
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/authentication");
      return;
    }
    setAuthed(true);
  }, [router]);

  if (!authed) return null;

  return (
    <PermissionsProvider>
      <AdminShell>{children}</AdminShell>
    </PermissionsProvider>
  );
}
