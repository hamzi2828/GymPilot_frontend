"use client";

import { useEffect, useState } from "react";
import {
  PageHeader,
  Modal,
  SecondaryButton,
  PrimaryButton,
  DangerButton,
  SelectField,
  TextField,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";

interface User {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role?: "user" | "admin" | "moderator";
  status?: "active" | "inactive" | "blocked";
  createdAt?: string;
}

const roles = ["user", "admin", "moderator"];

export default function UsersAdminPage() {
  const [list, setList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<User | null>(null);
  const [role, setRole] = useState("");

  // Create-user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const emptyDraft = { firstName: "", lastName: "", email: "", phone: "", role: "user" };
  const [draft, setDraft] = useState(emptyDraft);

  const openCreate = () => {
    setDraft(emptyDraft);
    setCreateErr(null);
    setCreateOpen(true);
  };

  const createUser = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.email.trim()) {
      setCreateErr("First name, last name and email are all required.");
      return;
    }
    setCreating(true);
    setCreateErr(null);
    try {
      // The password is generated server-side and emailed — it is never sent
      // from or shown in the browser.
      const res = await apiJson<{ message: string; emailed?: boolean; emailError?: string }>(
        `${API_BASE}/admin/users`,
        "POST",
        draft
      );
      setCreateOpen(false);
      setNotice(
        res.emailed
          ? { tone: "ok", text: `${draft.email} was created and their password emailed.` }
          : {
              tone: "warn",
              text: `${draft.email} was created, but the password email failed${
                res.emailError ? ` (${res.emailError})` : ""
              }. Check the SMTP settings.`,
            }
      );
      await load();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Could not create the user.");
    } finally {
      setCreating(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: User[]; users?: User[] }>(`${API_BASE}/get/allUsers`);
      setList(r.data || r.users || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveRole = async () => {
    if (!selected || !role) return;
    try {
      await apiJson(`${API_BASE}/update/role/${selected._id}`, "PUT", { role });
      setSelected(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    try {
      await apiJson(`${API_BASE}/delete/${id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Customers"
        title="Users"
        actions={<PrimaryButton onClick={openCreate}>New User</PrimaryButton>}
      />

      {notice && (
        <div
          className={`mb-6 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["Name", "Email", "Role", "Status", "Joined", "Actions"]}
          rows={list.map((u) => [
            <div key="n" className="font-medium text-neutral-900">{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</div>,
            u.email,
            <Badge key="r" color={u.role === "admin" ? "blue" : "neutral"}>{u.role || "user"}</Badge>,
            <Badge key="s" color={u.status === "active" ? "green" : "neutral"}>{u.status || "active"}</Badge>,
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—",
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => { setSelected(u); setRole(u.role || "user"); }}>Role</SecondaryButton>
              <DangerButton onClick={() => remove(u._id)}>Delete</DangerButton>
            </div>,
          ])}
          empty="No users yet."
        />
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create User" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            A secure password is generated automatically and emailed to the user. You will not
            need to share it yourself.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="First Name" value={draft.firstName} onChange={(v) => setDraft({ ...draft, firstName: v })} />
            <TextField label="Last Name" value={draft.lastName} onChange={(v) => setDraft({ ...draft, lastName: v })} />
          </div>
          <TextField label="Email" type="email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} />
          <TextField label="Phone (optional)" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
          <SelectField
            label="Role"
            value={draft.role}
            onChange={(v) => setDraft({ ...draft, role: v })}
            options={roles.map((r) => ({ value: r, label: r }))}
          />

          {createErr && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createErr}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={createUser} disabled={creating}>
              {creating ? "Creating..." : "Create & Email Password"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Update Role" size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="text-neutral-900 font-medium">{[selected.firstName, selected.lastName].filter(Boolean).join(" ") || selected.email}</p>
              <p className="text-neutral-500">{selected.email}</p>
            </div>
            <SelectField
              label="Role"
              value={role}
              onChange={setRole}
              options={roles.map((s) => ({ value: s, label: s }))}
            />
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setSelected(null)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={saveRole}>Save</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
