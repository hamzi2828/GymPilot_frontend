"use client";

import { FiMenu, FiX, FiSearch, FiBell } from "react-icons/fi";

interface AdminHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function AdminHeader({
  isSidebarOpen,
  onToggleSidebar,
}: AdminHeaderProps) {
  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-neutral-200 lg:px-10">
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

        <div
          className="hidden md:flex items-center gap-2 px-3 h-9 w-72 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 select-none"
          title="Search is not wired up yet"
          aria-hidden="true"
        >
          <FiSearch className="w-4 h-4" />
          <span>Search…</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          className="p-1.5 text-neutral-500 rounded-md hover:bg-neutral-100 transition-colors"
          aria-label="Notifications"
        >
          <FiBell className="w-[18px] h-[18px]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-xs font-medium text-neutral-900">Admin</span>
            <span className="text-[11px] text-neutral-500">Administrator</span>
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
            A
          </div>
        </div>
      </div>
    </header>
  );
}
