"use client";

import { useCallback, useEffect, useState } from "react";
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
  ErrorState,
  Pager,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";

// Field names as the contact model stores them (models/contactModel.js).
interface Contact {
  _id: string;
  fullName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  subject?: string;
  message?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
}

// contactController.getAllContacts pages with page/limit (newest first).
const PAGE_SIZE = 25;

const statuses = ["new", "in_progress", "resolved", "closed"];
const priorities = ["low", "medium", "high", "urgent"];

const statusColor: Record<string, "neutral" | "green" | "amber" | "rose" | "blue"> = {
  new: "blue",
  in_progress: "amber",
  resolved: "green",
  closed: "neutral",
};

export default function ContactQueriesAdminPage() {
  const { can } = usePermissions();
  const editable = can("contact-queries", "manage");
  const [list, setList] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: Contact[]; pagination?: { total: number; pages: number } }>(
        `${API_BASE}/api/contact?page=${page}&limit=${PAGE_SIZE}`
      );
      const rows = r.data || [];
      const lastPage = Math.max(1, r.pagination?.pages || 1);
      // Deleting the last query on the last page leaves nothing to show here.
      if (!rows.length && page > lastPage) {
        setPage(lastPage);
        return;
      }
      setList(rows);
      setPages(lastPage);
      setTotal(r.pagination?.total ?? rows.length);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load contact queries.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

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
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : (
        <Table
          columns={["Name", "Email", "Subject", "Priority", "Status", "Created", "Actions"]}
          rows={list.map((c) => [
            <div key="n" className="font-medium text-neutral-900">{c.fullName || "—"}</div>,
            c.emailAddress || "—",
            <span key="s" className="text-neutral-700 line-clamp-1">{c.subject}</span>,
            <Badge key="p" color={c.priority === "high" || c.priority === "urgent" ? "rose" : "neutral"}>{c.priority || "—"}</Badge>,
            <Badge key="st" color={statusColor[c.status || "new"] || "neutral"}>{c.status || "new"}</Badge>,
            c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—",
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => open(c)}>View</SecondaryButton>
              {editable && <DangerButton onClick={() => remove(c._id)}>Delete</DangerButton>}
            </div>,
          ])}
          empty="No contact queries yet."
        />
      )}
      {!loading && !loadErr && <Pager page={page} pages={pages} total={total} onChange={setPage} />}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Contact Query" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><span className="text-neutral-500">From:</span> <span className="font-medium text-neutral-900">{selected.fullName}</span> ({selected.emailAddress})</p>
              {selected.phoneNumber && <p><span className="text-neutral-500">Phone:</span> {selected.phoneNumber}</p>}
              {selected.subject && <p><span className="text-neutral-500">Subject:</span> {selected.subject}</p>}
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded p-3 text-sm whitespace-pre-wrap">
              {selected.message}
            </div>
            {editable && (
              <>
                <SelectField label="Status" value={status} onChange={setStatus} options={statuses.map((s) => ({ value: s, label: s }))} />
                <SelectField label="Priority" value={priority} onChange={setPriority} options={priorities.map((s) => ({ value: s, label: s }))} />
                <TextArea label="Add Note" value={note} onChange={setNote} />
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setSelected(null)}>Close</SecondaryButton>
              {editable && <PrimaryButton onClick={save}>Save</PrimaryButton>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
