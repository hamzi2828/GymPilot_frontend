"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiLock, FiShield } from "react-icons/fi";
import {
  PageHeader,
  Card,
  Modal,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  TextField,
  TextArea,
  Spinner,
  EmptyState,
  ErrorState,
  useConfirm,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";

type Level = "none" | "view" | "manage";

interface PermissionTab {
  key: string;
  label: string;
  group: string;
  path: string;
}

interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_staff: boolean;
  is_system: boolean;
  is_active: boolean;
  permissions: Record<string, Level>;
  granted_tabs: number;
  member_count: number;
}

const LEVELS: { value: Level; label: string; className: string }[] = [
  { value: "none", label: "None", className: "text-neutral-500" },
  { value: "view", label: "View", className: "text-sky-700" },
  { value: "manage", label: "Manage", className: "text-emerald-700" },
];

// The three states of one tab for one role. A segmented control rather than a
// dropdown because the whole point of this screen is scanning a column at a
// glance to see what a role can reach.
function LevelPicker({
  value,
  onChange,
  disabled,
}: {
  value: Level;
  onChange: (level: Level) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-neutral-200">
      {LEVELS.map((level) => {
        const active = value === level.value;
        return (
          <button
            key={level.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level.value)}
            className={`h-7 px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              active
                ? level.value === "manage"
                  ? "bg-emerald-600 text-white"
                  : level.value === "view"
                  ? "bg-sky-600 text-white"
                  : "bg-neutral-700 text-white"
                : "bg-white text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}

function LevelBadge({ level }: { level: Level }) {
  if (level === "manage") {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
        Manage
      </span>
    );
  }
  if (level === "view") {
    return (
      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-600/15">
        View
      </span>
    );
  }
  return <span className="text-[11px] text-neutral-300">—</span>;
}

const emptyDraft = { name: "", description: "", isStaff: true };

export default function RolesAdminPage() {
  const { can, reload: reloadPermissions } = usePermissions();
  const { ask, dialog: confirmDialog } = useConfirm();
  const editable = can("roles", "manage");

  const [roles, setRoles] = useState<Role[]>([]);
  const [tabs, setTabs] = useState<PermissionTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [permissions, setPermissions] = useState<Record<string, Level>>({});
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, catalogRes] = await Promise.all([
        apiGet<{ roles: Role[] }>(`${API_BASE}/roles`),
        apiGet<{ tabs: PermissionTab[] }>(`${API_BASE}/roles/catalog`),
      ]);
      setRoles(rolesRes.roles || []);
      setTabs(catalogRes.tabs || []);
      setLoadErr(null);
      setErr(null);
    } catch (e) {
      // Shown in place of the list, not as "No roles yet".
      setLoadErr(e instanceof Error ? e.message : "Could not load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, PermissionTab[]>();
    for (const tab of tabs) {
      if (!map.has(tab.group)) map.set(tab.group, []);
      map.get(tab.group)!.push(tab);
    }
    return [...map.entries()];
  }, [tabs]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setPermissions(Object.fromEntries(tabs.map((tab) => [tab.key, "none" as Level])));
    setFormErr(null);
    setOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditing(role);
    setDraft({ name: role.name, description: role.description, isStaff: role.is_staff });
    setPermissions({ ...role.permissions });
    setFormErr(null);
    setOpen(true);
  };

  const setAll = (level: Level) => {
    setPermissions(Object.fromEntries(tabs.map((tab) => [tab.key, level])));
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setFormErr("Give the role a name.");
      return;
    }
    setSaving(true);
    setFormErr(null);
    try {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        isStaff: draft.isStaff,
        permissions,
      };

      if (editing) {
        await apiJson(`${API_BASE}/roles/${editing.id}`, "PUT", body);
        setNotice(`${draft.name} updated.`);
      } else {
        await apiJson(`${API_BASE}/roles`, "POST", body);
        setNotice(`${draft.name} created.`);
      }

      setOpen(false);
      await load();
      // The signed-in account may have just changed its own role's access.
      await reloadPermissions();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Could not save the role");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: Role) => {
    const answer = await ask({ title: `Delete the "${role.name}" role?`, body: "This cannot be undone.", confirmLabel: "Delete role" });
    if (answer === null) return;
    try {
      await apiJson(`${API_BASE}/roles/${role.id}`, "DELETE");
      setNotice(`${role.name} deleted.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete the role");
    }
  };

  return (
    <div>
      {confirmDialog}
      <PageHeader
        eyebrow="Operations"
        title="Roles & Access"
        actions={editable ? <PrimaryButton onClick={openCreate}>New Role</PrimaryButton> : undefined}
      />

      <p className="-mt-4 mb-6 max-w-2xl text-[13px] text-neutral-500">
        A role decides which sidebar tabs an account can open, and whether it can change what it
        finds there. Everyone signs in through the same login: the role is what makes one person a
        gym member and another a receptionist.
      </p>

      {notice && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {err && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">{err}</div>
      )}

      {loading ? (
        <Spinner />
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : !roles.length ? (
        <EmptyState title="No roles yet" hint="Create one to start handing out access." />
      ) : (
        <div className="space-y-4">
          {roles.map((role) => (
            <Card key={role.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FiShield className="h-4 w-4 text-neutral-400" />
                    <span className="text-[15px] font-semibold text-neutral-900">{role.name}</span>
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
                      {role.slug}
                    </code>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                        role.is_staff
                          ? "bg-violet-50 text-violet-700 ring-violet-600/15"
                          : "bg-neutral-100 text-neutral-600 ring-neutral-500/15"
                      }`}
                    >
                      {role.is_staff ? "Staff role" : "Member role"}
                    </span>
                    {role.is_system && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                        <FiLock className="h-3 w-3" /> System
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p className="mt-1.5 text-[13px] text-neutral-500">{role.description}</p>
                  )}
                  <p className="mt-1.5 text-[12px] text-neutral-400">
                    {role.member_count} account{role.member_count === 1 ? "" : "s"} ·{" "}
                    {role.granted_tabs} tab{role.granted_tabs === 1 ? "" : "s"} granted
                  </p>
                </div>

                {editable && (
                  <div className="flex shrink-0 items-center gap-2">
                    <SecondaryButton onClick={() => openEdit(role)}>Edit</SecondaryButton>
                    {!role.is_system && <DangerButton onClick={() => remove(role)}>Delete</DangerButton>}
                  </div>
                )}
              </div>

              {/* What this role can actually reach, without opening the editor. */}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-neutral-100 pt-4">
                {tabs
                  .filter((tab) => (role.permissions[tab.key] || "none") !== "none")
                  .map((tab) => (
                    <span key={tab.key} className="flex items-center gap-1.5">
                      <span className="text-[12px] text-neutral-600">{tab.label}</span>
                      <LevelBadge level={role.permissions[tab.key]} />
                    </span>
                  ))}
                {role.granted_tabs === 0 && (
                  <span className="text-[12px] text-neutral-400">No admin access — this is a gym member role.</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit role — ${editing.name}` : "New role"}
        size="xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Role name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} required />
            <div>
              <span className="text-xs font-semibold text-neutral-700">This role is for</span>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  disabled={!!editing?.is_system}
                  onClick={() => setDraft({ ...draft, isStaff: true })}
                  className={`h-9 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-60 ${
                    draft.isStaff
                      ? "border-violet-300 bg-violet-50 text-violet-800"
                      : "border-neutral-200 bg-white text-neutral-600"
                  }`}
                >
                  Staff — payroll & roster
                </button>
                <button
                  type="button"
                  disabled={!!editing?.is_system}
                  onClick={() => setDraft({ ...draft, isStaff: false })}
                  className={`h-9 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-60 ${
                    !draft.isStaff
                      ? "border-neutral-400 bg-neutral-100 text-neutral-800"
                      : "border-neutral-200 bg-white text-neutral-600"
                  }`}
                >
                  Gym member
                </button>
              </div>
            </div>
          </div>

          <TextArea
            label="Description"
            value={draft.description}
            onChange={(v) => setDraft({ ...draft, description: v })}
            rows={2}
            placeholder="What this role is for, in a line."
          />

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Sidebar permissions
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAll("none")}
                  className="text-[12px] font-medium text-neutral-500 hover:text-neutral-800"
                >
                  Clear all
                </button>
                <span className="text-neutral-300">·</span>
                <button
                  type="button"
                  onClick={() => setAll("view")}
                  className="text-[12px] font-medium text-sky-600 hover:text-sky-800"
                >
                  View all
                </button>
                <span className="text-neutral-300">·</span>
                <button
                  type="button"
                  onClick={() => setAll("manage")}
                  className="text-[12px] font-medium text-emerald-600 hover:text-emerald-800"
                >
                  Manage all
                </button>
              </div>
            </div>

            {editing?.slug === "admin" && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                The Administrator role always keeps full access — it is the way back in if permissions
                are set wrong elsewhere.
              </p>
            )}

            <div className="space-y-4">
              {groups.map(([group, groupTabs]) => (
                <div key={group} className="rounded-xl border border-neutral-200">
                  <p className="border-b border-neutral-100 bg-neutral-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    {group}
                  </p>
                  <div className="divide-y divide-neutral-100">
                    {groupTabs.map((tab) => (
                      <div key={tab.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-neutral-800">{tab.label}</p>
                          <p className="truncate text-[11px] text-neutral-400">{tab.path}</p>
                        </div>
                        <LevelPicker
                          value={permissions[tab.key] || "none"}
                          onChange={(level) => setPermissions((prev) => ({ ...prev, [tab.key]: level }))}
                          disabled={editing?.slug === "admin"}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {formErr && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formErr}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create role"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
