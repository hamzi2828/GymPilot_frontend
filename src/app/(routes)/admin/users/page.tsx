"use client";

import { useEffect, useState } from "react";
import {
  PageHeader,
  Modal,
  SecondaryButton,
  PrimaryButton,
  DangerButton,
  SelectField,
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
      <PageHeader eyebrow="Customers" title="Users" />

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
