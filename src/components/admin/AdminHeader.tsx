"use client";

import Image from "next/image";
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

        <div className="hidden md:flex items-center gap-2 px-3 h-9 w-72 border border-neutral-200 rounded-md text-sm text-neutral-400">
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
          <div className="w-8 h-8 overflow-hidden bg-[#bee304] rounded-full ring-2 ring-[#bee304]/30 flex items-center justify-center text-black text-xs font-bold">
            <Image
              className="object-cover w-full h-full"
              src="https://ui-avatars.com/api/?name=Admin&background=bee304&color=000000&bold=true"
              alt="Admin"
              width={32}
              height={32}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
