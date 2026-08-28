"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getRole, isAuthenticated } from "@/helper/helper";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  useEffect(() => {
    const authed = isAuthenticated();
    const role = getRole();
    if (!authed) {
      router.replace("/authentication");
      return;
    }
    if (role !== "admin") {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="admin-scroll flex h-screen bg-white text-neutral-900">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader
          isSidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
        />

        <main className="admin-scroll flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
