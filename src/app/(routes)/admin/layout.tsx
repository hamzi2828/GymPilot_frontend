"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { PermissionsProvider, usePermissions } from "@/components/admin/PermissionsProvider";
import { isAuthenticated, removeToken } from "@/helper/helper";
import { getSubscription, type BillingSubscription } from "./settings/billingApi";

// Which tab each admin route belongs to. Longest prefix wins, so
// /admin/package-registrations is not mistaken for /admin/package-orders.
const ROUTE_TABS: { prefix: string; tab: string }[] = [
  { prefix: "/admin/reports", tab: "reports" },
  { prefix: "/admin/classes", tab: "classes" },
  { prefix: "/admin/timetable-changes", tab: "classes" },
  { prefix: "/admin/pt", tab: "pt" },
  { prefix: "/admin/trainers", tab: "trainers" },
  { prefix: "/admin/packages", tab: "packages" },
  { prefix: "/admin/package-orders", tab: "package-orders" },
  { prefix: "/admin/fee-expiry", tab: "package-orders" },
  { prefix: "/admin/package-registrations", tab: "registrations" },
  { prefix: "/admin/coupons", tab: "coupons" },
  { prefix: "/admin/pos", tab: "pos" },
  { prefix: "/admin/inventory", tab: "pos" },
  { prefix: "/admin/lockers", tab: "lockers" },
  { prefix: "/admin/attendance", tab: "attendance" },
  { prefix: "/admin/fingerprints", tab: "attendance" },
  { prefix: "/admin/accounts", tab: "accounts" },
  { prefix: "/admin/staff", tab: "staff" },
  { prefix: "/admin/roles", tab: "roles" },
  { prefix: "/admin/users", tab: "users" },
  { prefix: "/admin/contact-queries", tab: "contact-queries" },
  { prefix: "/admin/messaging", tab: "messaging" },
  { prefix: "/admin/leads", tab: "leads" },
  { prefix: "/admin/homepage", tab: "homepage" },
  { prefix: "/admin/hero-slides", tab: "hero-slides" },
  { prefix: "/admin/testimonials", tab: "testimonials" },
  { prefix: "/admin/blog-settings", tab: "blog-settings" },
  { prefix: "/admin/blogs", tab: "blogs" },
  { prefix: "/admin/settings", tab: "settings" },
  { prefix: "/admin/setup", tab: "settings" },
  { prefix: "/admin/audit-log", tab: "audit" },
];

function tabForPath(pathname: string | null): string {
  if (!pathname) return "dashboard";
  const match = ROUTE_TABS.filter((entry) => pathname.startsWith(entry.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length
  )[0];
  return match ? match.tab : "dashboard";
}

// A trial with this many days or fewer left gets the banner.
const TRIAL_BANNER_DAYS = 14;

/** What the billing banner says, or null for no banner. */
function billingBanner(sub: BillingSubscription | null): { text: string; action: string; tone: "warn" | "bad" } | null {
  if (!sub) return null;
  if (sub.status === "past_due") {
    return { text: "Payment overdue — update billing to keep your website, member app and admin running.", action: "Update billing", tone: "bad" };
  }
  // A trial with a card on file is already taken care of.
  if (sub.status === "trialing" && !sub.hasStripeSubscription && sub.daysLeft !== null && sub.daysLeft <= TRIAL_BANNER_DAYS) {
    const when =
      sub.daysLeft <= 0 ? "Your trial has ended" : sub.daysLeft === 1 ? "Your trial ends tomorrow" : `Your trial ends in ${sub.daysLeft} days`;
    return { text: `${when} — choose a plan to keep everything running.`, action: "Choose a plan", tone: "warn" };
  }
  return null;
}

// The shell, once permissions are known.
//
// Access is decided by permissions rather than by role === "admin": that check
// is what would keep a receptionist out of a panel their role was created to
// let them into. Anyone holding at least one tab gets in, and the page they
// asked for is checked separately.
function AdminShell({ children }: { children: React.ReactNode }) {
  // Closed to start with: below lg the sidebar is a drawer over the page, and
  // opening it unasked covered the page on every phone. From lg up it is
  // always shown, whatever this says.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loading, tabs, can, me, error } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);

  const tab = tabForPath(pathname);
  const allowedHere = tab === "dashboard" ? tabs.length > 0 : can(tab);
  const canViewSettings = can("settings");

  useEffect(() => {
    if (loading) return;
    // No tabs and no error means this is a gym member who found the URL. A
    // failed /roles/me is not that: an ended session is already on its way
    // to sign-in (PermissionsProvider), and anything else is shown below
    // rather than bounced to the homepage as if the panel were not theirs.
    if (!tabs.length && !error) router.replace("/");
  }, [loading, tabs, error, router]);

  // Fetched once for whoever can see Settings; any failure just means no banner.
  useEffect(() => {
    if (loading || !canViewSettings) return;
    let cancelled = false;
    getSubscription({ usage: false })
      .then((res) => {
        if (!cancelled && res.ok && res.data) setSubscription(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loading, canViewSettings]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-[var(--accent)]" />
      </div>
    );
  }

  if (!tabs.length) {
    if (!error) return null;
    return (
      <div className="flex h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md rounded-xl border border-neutral-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-neutral-900">The admin panel could not load</p>
          <p className="mt-2 text-[13px] text-neutral-500">{error}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                removeToken();
                router.replace("/authentication");
              }}
              className="inline-flex h-9 items-center rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-700"
            >
              Sign in again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const banner = canViewSettings ? billingBanner(subscription) : null;

  return (
    <div className="admin-scroll flex h-screen bg-white text-neutral-900">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader isSidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />

        <main className="admin-scroll flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-[1400px]">
            {banner && (
              <div
                className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                  banner.tone === "bad" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <span>{banner.text}</span>
                <button
                  type="button"
                  onClick={() => router.push("/admin/settings?tab=billing")}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {banner.action}
                </button>
              </div>
            )}
            {/* A brand-new gym is pointed at the setup wizard until its owner
                has been through it; nobody is forced, it is just always there. */}
            {me && me.setup_completed === false && can("settings", "manage") && pathname !== "/admin/setup" && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span>Your gym is not fully set up yet — name, currency, a first package and how you get paid take a few minutes.</span>
                <button type="button" onClick={() => router.push("/admin/setup")} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">
                  Finish setup
                </button>
              </div>
            )}
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
