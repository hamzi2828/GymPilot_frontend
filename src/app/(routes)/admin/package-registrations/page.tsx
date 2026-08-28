"use client";

import { useEffect, useState } from "react";
import {
  PageHeader,
  Modal,
  SecondaryButton,
  PrimaryButton,
  DangerButton,
  SelectField,
  TextArea,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";

interface Registration {
  _id: string;
  username: string;
  email: string;
  phone: string;
  platform: string;
  status: "pending" | "contacted" | "registered" | "rejected";
  notes?: string;
  createdAt: string;
}

const statuses = ["pending", "contacted", "registered", "rejected"];

const colorMap: Record<string, "neutral" | "green" | "amber" | "rose" | "blue"> = {
  pending: "amber",
  contacted: "blue",
  registered: "green",
  rejected: "rose",
};

export default function PackageRegistrationsAdminPage() {
  const [list, setList] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Registration | null>(null);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Registration[] }>(`${GYMFOLIO_API}/package-registrations`);
      setList(r.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const open = (r: Registration) => {
    setSelected(r);
    setStatus(r.status);
    setNotes(r.notes || "");
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiJson(`${GYMFOLIO_API}/package-registrations/${selected._id}/status`, "PUT", { status, notes });
      setSelected(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this registration?")) return;
    try {
      await apiJson(`${GYMFOLIO_API}/package-registrations/${id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Sales" title="Package Registrations" />

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["Name", "Email", "Phone", "Platform", "Status", "Created", "Actions"]}
          rows={list.map((r) => [
            <div key="n" className="font-medium text-neutral-900">{r.username}</div>,
            r.email,
            r.phone,
            r.platform,
            <Badge key="s" color={colorMap[r.status] || "neutral"}>{r.status}</Badge>,
            new Date(r.createdAt).toLocaleDateString(),
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => open(r)}>Update</SecondaryButton>
              <DangerButton onClick={() => remove(r._id)}>Delete</DangerButton>
            </div>,
          ])}
          empty="No registrations yet."
        />
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Update Registration" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="text-neutral-900 font-medium">{selected.username}</p>
              <p className="text-neutral-500">{selected.email} · {selected.phone}</p>
            </div>
            <SelectField
              label="Status"
              value={status}
              onChange={setStatus}
              options={statuses.map((s) => ({ value: s, label: s }))}
            />
            <TextArea label="Notes" value={notes} onChange={setNotes} />
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setSelected(null)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
