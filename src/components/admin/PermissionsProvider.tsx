"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAuthToken } from "@/helper/helper";
import { API_BASE, apiGet, isSessionEndError } from "@/app/(routes)/admin/_shared/api";

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
  /** False until the owner has completed the setup wizard. */
  setup_completed?: boolean;
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

    // Through the shared helper, so an ended session (deactivated, signed out
    // everywhere, expired) clears the token and goes to sign-in instead of
    // reading as "no tabs" and bouncing to the homepage.
    let signedOut = false;
    try {
      const json = await apiGet<{ user?: AdminIdentity; permissions?: PermissionMap; tabs?: string[] }>(
        `${API_BASE}/roles/me`
      );

      setMe(json.user || null);
      setPermissions(json.permissions || {});
      setTabs(json.tabs || []);
      setError(null);
    } catch (e) {
      // Already on the way to the sign-in page: keep the spinner up rather
      // than let the shell react to an empty permission set.
      if (isSessionEndError(e)) {
        signedOut = true;
        return;
      }
      setError(e instanceof Error ? e.message : "Could not load your permissions");
      setPermissions({});
      setTabs([]);
    } finally {
      if (!signedOut) setLoading(false);
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
