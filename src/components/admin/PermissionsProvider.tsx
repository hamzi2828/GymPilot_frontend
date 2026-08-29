"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAuthToken } from "@/helper/helper";

// The browser half of the permission system. It asks the server once what this
// account may do and hands the answer to the shell, the sidebar and the pages.
//
// Nothing here is a security boundary — every gated endpoint checks the same
// permission again. This exists so the panel does not offer people doors that
// will not open for them.

export type PermissionLevel = "none" | "view" | "manage";
export type PermissionMap = Record<string, PermissionLevel>;

export interface AdminIdentity {
  id: string;
  name: string;
  email: string;
  role: string;
  role_name: string;
  is_staff: boolean;
  job_title: string;
}

interface PermissionsState {
  loading: boolean;
  error: string | null;
  me: AdminIdentity | null;
  permissions: PermissionMap;
  // Tabs with anything above 'none'. Empty means this account has no business
  // in the admin panel at all.
  tabs: string[];
  can: (tab: string, level?: PermissionLevel) => boolean;
  reload: () => Promise<void>;
}

const RANK: Record<PermissionLevel, number> = { none: 0, view: 1, manage: 2 };

const PermissionsContext = createContext<PermissionsState>({
  loading: true,
  error: null,
  me: null,
  permissions: {},
  tabs: [],
  can: () => false,
  reload: async () => {},
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<AdminIdentity | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [tabs, setTabs] = useState<string[]>([]);

  const load = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      setError("Not signed in");
      return;
    }

    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const res = await fetch(`${base}/roles/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.message || "Could not load your permissions");

      setMe(json.user || null);
      setPermissions(json.permissions || {});
      setTabs(json.tabs || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your permissions");
      setPermissions({});
      setTabs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (tab: string, level: PermissionLevel = "view") =>
      RANK[permissions[tab] || "none"] >= RANK[level],
    [permissions]
  );

  const value = useMemo(
    () => ({ loading, error, me, permissions, tabs, can, reload: load }),
    [loading, error, me, permissions, tabs, can, load]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
