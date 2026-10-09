"use client";

import { useRouter } from "next/navigation";
import { FiMenu, FiX, FiLogOut } from "react-icons/fi";
import { removeToken } from "@/helper/helper";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminNotifications from "@/components/admin/AdminNotifications";

interface AdminHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function AdminHeader({
  isSidebarOpen,
  onToggleSidebar,
}: AdminHeaderProps) {
  const router = useRouter();
  // Who is signed in comes from /roles/me, which the shell has already loaded
  // before this header renders.
  const { me } = usePermissions();

  const displayName = me?.name || me?.email || "Signed in";
  const roleLabel = me?.role_name || me?.job_title || "";
  const initial = (me?.name || me?.email || "?").trim().charAt(0).toUpperCase() || "?";

  // Same sign-out as the website header: drop the token and role, then go to
  // the sign-in page rather than a panel that can no longer load.
  const logout = () => {
    removeToken();
    router.replace("/authentication");
  };

  return (
    // `relative`: on a phone the search box lays itself over the header.
    <header className="relative flex items-center justify-between h-16 px-6 bg-white border-b border-neutral-200 lg:px-10">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 text-neutral-500 rounded-md lg:hidden hover:bg-neutral-100 transition-colors"
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isSidebarOpen ? (
            <FiX className="w-5 h-5" />
          ) : (
            <FiMenu className="w-5 h-5" />
          )}
        </button>
        {/* Both answer only from the tabs this account's role can open --
            the backend decides, so neither needs the permission map here. */}
        <AdminSearch />
      </div>

      <div className="flex items-center gap-4">
        <AdminNotifications />
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-xs font-medium text-neutral-900">{displayName}</span>
            {roleLabel && <span className="text-[11px] text-neutral-500">{roleLabel}</span>}
          </div>
          {/* Rendered from theme tokens rather than a remote avatar service, so
              it follows the selected colour scheme and needs no network round-trip. */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
            style={{
              background: "var(--accent, #ff6b2c)",
              color: "var(--on-accent, #0e0e10)",
              boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent, #ff6b2c) 22%, transparent)",
            }}
            aria-hidden="true"
          >
            {initial}
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-md hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
          aria-label="Log out"
          title="Log out"
        >
          <FiLogOut className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}
