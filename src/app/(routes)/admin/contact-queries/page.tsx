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
import { API_BASE, apiGet, apiJson } from "../_shared/api";

interface Contact {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
}

const statuses = ["new", "in_progress", "resolved", "closed"];
const priorities = ["low", "medium", "high", "urgent"];

const statusColor: Record<string, "neutral" | "green" | "amber" | "rose" | "blue"> = {
  new: "blue",
  in_progress: "amber",
  resolved: "green",
  closed: "neutral",
};

export default function ContactQueriesAdminPage() {
  const [list, setList] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: Contact[]; contacts?: Contact[] }>(`${API_BASE}/api/contact`);
      setList(r.data || r.contacts || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const open = (c: Contact) => {
    setSelected(c);
    setStatus(c.status || "new");
    setPriority(c.priority || "medium");
    setNote("");
  };

  const save = async () => {
    if (!selected) return;
    try {
      if (status !== selected.status) {
        await apiJson(`${API_BASE}/api/contact/${selected._id}/status`, "PUT", { status });
      }
      if (priority !== selected.priority) {
        await apiJson(`${API_BASE}/api/contact/${selected._id}/priority`, "PUT", { priority });
      }
      if (note.trim()) {
        await apiJson(`${API_BASE}/api/contact/${selected._id}/note`, "POST", { note });
      }
      setSelected(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this contact query?")) return;
    try {
      await apiJson(`${API_BASE}/api/contact/${id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Customers" title="Contact Queries" />

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["Name", "Email", "Subject", "Priority", "Status", "Created", "Actions"]}
          rows={list.map((c) => [
            <div key="n" className="font-medium text-neutral-900">{c.name}</div>,
            c.email,
            <span key="s" className="text-neutral-700 line-clamp-1">{c.subject}</span>,
            <Badge key="p" color={c.priority === "high" || c.priority === "urgent" ? "rose" : "neutral"}>{c.priority || "—"}</Badge>,
            <Badge key="st" color={statusColor[c.status || "new"] || "neutral"}>{c.status || "new"}</Badge>,
            c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—",
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => open(c)}>View</SecondaryButton>
              <DangerButton onClick={() => remove(c._id)}>Delete</DangerButton>
            </div>,
          ])}
          empty="No contact queries yet."
        />
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Contact Query" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><span className="text-neutral-500">From:</span> <span className="font-medium text-neutral-900">{selected.name}</span> ({selected.email})</p>
              {selected.phone && <p><span className="text-neutral-500">Phone:</span> {selected.phone}</p>}
              {selected.subject && <p><span className="text-neutral-500">Subject:</span> {selected.subject}</p>}
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded p-3 text-sm whitespace-pre-wrap">
              {selected.message}
            </div>
            <SelectField label="Status" value={status} onChange={setStatus} options={statuses.map((s) => ({ value: s, label: s }))} />
            <SelectField label="Priority" value={priority} onChange={setPriority} options={priorities.map((s) => ({ value: s, label: s }))} />
            <TextArea label="Add Note" value={note} onChange={setNote} />
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setSelected(null)}>Close</SecondaryButton>
              <PrimaryButton onClick={save}>Save</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
