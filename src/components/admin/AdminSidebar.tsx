"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSiteSettings } from "@/components/ThemeProvider";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import Link from "next/link";
import {
  FiHome,
  FiUsers,
  FiSettings,
  FiBookOpen,
  FiImage,
  FiEdit3,
  FiMessageSquare,
  FiTag,
  FiUserCheck,
  FiActivity,
  FiShoppingBag,
  FiClipboard,
  FiLayout,
  FiStar,
  FiClock,
  FiWatch,
  FiBriefcase,
  FiShield,
  FiDollarSign,
  FiCalendar,
  FiFileText,
  FiSend,
  FiUserPlus,
  FiTarget,
  FiAlertCircle,
  FiBarChart2,
  FiShoppingCart,
  FiArchive,
  FiCreditCard,
  FiMonitor,
  FiChevronDown,
} from "react-icons/fi";
// Feather has no fingerprint or face; these two entries are drawn from another set.
import { MdFace, MdFingerprint } from "react-icons/md";

interface MenuItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  // The permission tab this entry belongs to. Matches the keys in
  // src/config/permissions.js on the backend -- the menu and the route guard
  // must be reading the same list or one will offer what the other refuses.
  tab: string;
  // Also shown to an account that may use the front-desk app, whatever its
  // tabs: the Desk app page is where it gets a code to link a desk.
  forDeskAppUsers?: boolean;
}

interface MenuSection {
  heading: string;
  items: MenuItem[];
}

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const iconCls = "w-[18px] h-[18px]";

// Which menu groups the admin has closed, kept in this browser.
const CLOSED_KEY = "admin-sidebar-closed";

function readClosed(): string[] {
  try {
    const raw = localStorage.getItem(CLOSED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const sections: MenuSection[] = [
  {
    heading: "Overview",
    items: [
      { name: "Dashboard", path: "/admin", icon: <FiHome className={iconCls} />, tab: "dashboard" },
      { name: "Reports", path: "/admin/reports", icon: <FiBarChart2 className={iconCls} />, tab: "reports" },
    ],
  },
  {
    heading: "Fitness",
    items: [
      { name: "Classes", path: "/admin/classes", icon: <FiActivity className={iconCls} />, tab: "classes" },
      { name: "Bookings", path: "/admin/bookings", icon: <FiCalendar className={iconCls} />, tab: "bookings" },
      { name: "Timetable changes", path: "/admin/timetable-changes", icon: <FiAlertCircle className={iconCls} />, tab: "classes" },
      { name: "Personal Training", path: "/admin/pt", icon: <FiTarget className={iconCls} />, tab: "pt" },
      { name: "Trainers", path: "/admin/trainers", icon: <FiUserCheck className={iconCls} />, tab: "trainers" },
      { name: "Packages", path: "/admin/packages", icon: <FiTag className={iconCls} />, tab: "packages" },
    ],
  },
  {
    heading: "Sales",
    items: [
      { name: "Package Orders", path: "/admin/package-orders", icon: <FiShoppingBag className={iconCls} />, tab: "package-orders" },
      // The front desk's fee till: renewals, dues and first memberships.
      { name: "Collect fees", path: "/admin/fee-collection", icon: <FiCreditCard className={iconCls} />, tab: "package-orders" },
      { name: "Fee expiry", path: "/admin/fee-expiry", icon: <FiWatch className={iconCls} />, tab: "package-orders" },
      { name: "Registrations", path: "/admin/package-registrations", icon: <FiClipboard className={iconCls} />, tab: "registrations" },
      { name: "Coupons", path: "/admin/coupons", icon: <FiTag className={iconCls} />, tab: "coupons" },
      { name: "Shop / POS", path: "/admin/pos", icon: <FiShoppingCart className={iconCls} />, tab: "pos" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { name: "Attendance", path: "/admin/attendance", icon: <FiClock className={iconCls} />, tab: "attendance" },
      // Same tab as Attendance: seeing who has a finger on file needs it at
      // view, removing one needs it at manage (checked on the page and by
      // the API).
      { name: "Fingerprints", path: "/admin/fingerprints", icon: <MdFingerprint className={iconCls} />, tab: "attendance" },
      // The faces registered for face check-in at the desk, on the same terms.
      { name: "Faces", path: "/admin/faces", icon: <MdFace className={iconCls} />, tab: "attendance" },
      // Download the Windows desk app and link a desk with a one-time code.
      { name: "Desk app", path: "/admin/desk-app", icon: <FiMonitor className={iconCls} />, tab: "attendance", forDeskAppUsers: true },
      { name: "Accounts", path: "/admin/accounts", icon: <FiDollarSign className={iconCls} />, tab: "accounts" },
      { name: "Staff", path: "/admin/staff", icon: <FiBriefcase className={iconCls} />, tab: "staff" },
      { name: "Lockers", path: "/admin/lockers", icon: <FiArchive className={iconCls} />, tab: "lockers" },
      { name: "Roles & Access", path: "/admin/roles", icon: <FiShield className={iconCls} />, tab: "roles" },
    ],
  },
  {
    heading: "Customers",
    items: [
      { name: "Users", path: "/admin/users", icon: <FiUsers className={iconCls} />, tab: "users" },
      { name: "Contact Queries", path: "/admin/contact-queries", icon: <FiMessageSquare className={iconCls} />, tab: "contact-queries" },
      { name: "Leads", path: "/admin/leads", icon: <FiUserPlus className={iconCls} />, tab: "leads" },
      { name: "Messaging", path: "/admin/messaging", icon: <FiSend className={iconCls} />, tab: "messaging" },
    ],
  },
  {
    heading: "Content",
    items: [
      { name: "Homepage", path: "/admin/homepage", icon: <FiLayout className={iconCls} />, tab: "homepage" },
      { name: "Hero Slides", path: "/admin/hero-slides", icon: <FiImage className={iconCls} />, tab: "hero-slides" },
      { name: "Testimonials", path: "/admin/testimonials", icon: <FiStar className={iconCls} />, tab: "testimonials" },
      { name: "Blogs", path: "/admin/blogs", icon: <FiBookOpen className={iconCls} />, tab: "blogs" },
      { name: "Blog Settings", path: "/admin/blog-settings", icon: <FiEdit3 className={iconCls} />, tab: "blog-settings" },
      { name: "Pages", path: "/admin/pages", icon: <FiFileText className={iconCls} />, tab: "pages" },
    ],
  },
  {
    heading: "System",
    items: [
      { name: "Settings", path: "/admin/settings", icon: <FiSettings className={iconCls} />, tab: "settings" },
      { name: "Audit log", path: "/admin/audit-log", icon: <FiFileText className={iconCls} />, tab: "audit" },
    ],
  },
];

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  // Business name comes from admin settings rather than being hardcoded.
  const { siteName } = useSiteSettings();
  const { can, me } = usePermissions();

  // A section disappears entirely once every item in it is out of reach, so
  // the menu never shows an empty heading.
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => can(item.tab) || (item.forDeskAppUsers && !!me?.allow_attendance_app)),
    }))
    .filter((section) => section.items.length > 0);

  const isActive = (path: string) => pathname === path || (path !== "/admin" && !!pathname?.startsWith(path));

  // Groups start open and are read from storage after mount, so the server
  // and first client render match.
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => setClosed(readClosed()), []);
  const save = (next: string[]) => {
    setClosed(next);
    try {
      localStorage.setItem(CLOSED_KEY, JSON.stringify(next));
    } catch {}
  };
  const toggle = (heading: string) =>
    save(closed.includes(heading) ? closed.filter((h) => h !== heading) : [...closed, heading]);
  const isOpenGroup = (section: MenuSection) => !closed.includes(section.heading);
  const allClosed = visibleSections.every((section) => closed.includes(section.heading));
  const toggleAll = () => save(allClosed ? [] : visibleSections.map((section) => section.heading));

  // Going to a page opens the group it is in, so the active row is visible.
  const activeHeading = visibleSections.find((section) => section.items.some((item) => isActive(item.path)))?.heading;
  useEffect(() => {
    if (!activeHeading) return;
    setClosed((prev) => {
      if (!prev.includes(activeHeading)) return prev;
      const next = prev.filter((h) => h !== activeHeading);
      try {
        localStorage.setItem(CLOSED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [activeHeading, pathname]);

  return (
    <>
      {/* Scrim sits behind the drawer while it is OPEN, so tapping outside
          dismisses it. Rendering it while closed would blanket the page. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-neutral-900/40 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`admin-scroll fixed inset-y-0 left-0 z-30 flex w-64 flex-col overflow-y-auto border-r border-neutral-200 bg-white transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:inset-0 lg:translate-x-0`}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-neutral-200 px-5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-bold"
            style={{ background: "var(--accent, #ff6b2c)", color: "var(--on-accent, #0e0e10)" }}
            aria-hidden="true"
          >
            {(siteName || "G").trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">{siteName}</p>
            <p className="truncate text-[11px] text-neutral-400">{me?.role_name || "Admin Panel"}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4" aria-label="Admin menu">
          <div className="mb-2 flex justify-end px-1">
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
            >
              {allClosed ? "Expand all" : "Collapse all"}
            </button>
          </div>
          {visibleSections.map((section, idx) => {
            const open = isOpenGroup(section);
            const id = `admin-menu-${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            return (
              <div key={section.heading} className={idx > 0 ? "mt-3" : ""}>
                <button
                  type="button"
                  onClick={() => toggle(section.heading)}
                  aria-expanded={open}
                  aria-controls={id}
                  className="group/head flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                >
                  <span className="flex items-center gap-2">
                    {section.heading}
                    {!open && (
                      <span className="rounded-full bg-neutral-100 px-1.5 py-px text-[9px] font-semibold tracking-normal text-neutral-500">
                        {section.items.length}
                      </span>
                    )}
                  </span>
                  <FiChevronDown
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
                  />
                </button>
                {/* Grid rows 0fr -> 1fr animates the height without measuring it. */}
                <div
                  id={id}
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                  inert={!open}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="space-y-0.5 pb-1 pt-1">
                      {section.items.map((item) => {
                        const active = isActive(item.path);
                        return (
                          <Link
                            key={item.path}
                            href={item.path}
                            onClick={onClose}
                            aria-current={active ? "page" : undefined}
                            className={`group relative flex items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm transition-colors ${
                              active
                                ? "bg-neutral-100 font-semibold text-neutral-900"
                                : "font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                            }`}
                          >
                            {/* Accent rail marks the active row without flooding the
                                whole item in brand colour. */}
                            <span
                              aria-hidden="true"
                              className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity ${
                                active ? "opacity-100" : "opacity-0"
                              }`}
                              style={{ background: "var(--accent, #ff6b2c)" }}
                            />
                            <span
                              className={active ? "" : "text-neutral-400 transition-colors group-hover:text-neutral-600"}
                              style={active ? { color: "var(--accent, #ff6b2c)" } : undefined}
                            >
                              {item.icon}
                            </span>
                            <span className="truncate">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-neutral-200 px-5 py-4">
          <p className="text-[10px] text-neutral-400">© {new Date().getFullYear()} {siteName}</p>
        </div>
      </aside>
    </>
  );
}
