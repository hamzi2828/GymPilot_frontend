"use client";

import { usePathname } from "next/navigation";
import { useSiteSettings } from "@/components/ThemeProvider";
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
} from "react-icons/fi";

interface MenuItem {
  name: string;
  path: string;
  icon: React.ReactNode;
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

const sections: MenuSection[] = [
  {
    heading: "Overview",
    items: [{ name: "Dashboard", path: "/admin", icon: <FiHome className={iconCls} /> }],
  },
  {
    heading: "Fitness",
    items: [
      { name: "Classes", path: "/admin/classes", icon: <FiActivity className={iconCls} /> },
      { name: "Trainers", path: "/admin/trainers", icon: <FiUserCheck className={iconCls} /> },
      { name: "Packages", path: "/admin/packages", icon: <FiTag className={iconCls} /> },
    ],
  },
  {
    heading: "Sales",
    items: [
      { name: "Package Orders", path: "/admin/package-orders", icon: <FiShoppingBag className={iconCls} /> },
      { name: "Registrations", path: "/admin/package-registrations", icon: <FiClipboard className={iconCls} /> },
    ],
  },
  {
    heading: "Customers",
    items: [
      { name: "Users", path: "/admin/users", icon: <FiUsers className={iconCls} /> },
      { name: "Contact Queries", path: "/admin/contact-queries", icon: <FiMessageSquare className={iconCls} /> },
    ],
  },
  {
    heading: "Content",
    items: [
      { name: "Hero Slides", path: "/admin/hero-slides", icon: <FiImage className={iconCls} /> },
      { name: "Blogs", path: "/admin/blogs", icon: <FiBookOpen className={iconCls} /> },
      { name: "Blog Settings", path: "/admin/blog-settings", icon: <FiEdit3 className={iconCls} /> },
    ],
  },
  {
    heading: "System",
    items: [{ name: "Settings", path: "/admin/settings", icon: <FiSettings className={iconCls} /> }],
  },
];

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  // Business name comes from admin settings rather than being hardcoded.
  const { siteName } = useSiteSettings();

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
            <p className="truncate text-[11px] text-neutral-400">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5">
          {sections.map((section, idx) => (
            <div key={section.heading} className={idx > 0 ? "mt-7" : ""}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                {section.heading}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.path ||
                    (item.path !== "/admin" && pathname?.startsWith(item.path));
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
          ))}
        </nav>

        <div className="shrink-0 border-t border-neutral-200 px-5 py-4">
          <p className="text-[10px] text-neutral-400">© {new Date().getFullYear()} {siteName}</p>
        </div>
      </aside>
    </>
  );
}
