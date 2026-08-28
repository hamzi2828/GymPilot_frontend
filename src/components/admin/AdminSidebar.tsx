"use client";

import { usePathname } from "next/navigation";
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
    items: [
      { name: "Dashboard", path: "/admin", icon: <FiHome className={iconCls} /> },
    ],
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
    items: [
      { name: "Settings", path: "/admin/settings", icon: <FiSettings className={iconCls} /> },
    ],
  },
];

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {!isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`admin-scroll fixed inset-y-0 left-0 z-30 w-60 flex flex-col overflow-y-auto transition-transform duration-200 transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } bg-white border-r border-neutral-200 lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex items-center h-16 px-6 border-b border-neutral-200">
          <h1 className="text-sm font-semibold tracking-tight text-neutral-900">
            Gymfolio Admin
          </h1>
        </div>

        <nav className="flex-1 px-3 py-4">
          {sections.map((section, idx) => (
            <div key={section.heading} className={idx > 0 ? "mt-6" : ""}>
              <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
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
                      className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        active
                          ? "bg-[#bee304] text-black font-semibold shadow-[0_2px_8px_-2px_rgba(190,227,4,0.5)]"
                          : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                      }`}
                    >
                      <span
                        className={
                          active
                            ? "text-black"
                            : "text-neutral-400 group-hover:text-neutral-700"
                        }
                      >
                        {item.icon}
                      </span>
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-neutral-200">
          <p className="text-[10px] text-neutral-400">
            © {new Date().getFullYear()} Gymfolio
          </p>
        </div>
      </aside>
    </>
  );
}
