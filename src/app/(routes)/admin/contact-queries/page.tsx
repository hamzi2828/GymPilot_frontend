"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  useConfirm,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson, replaceParams } from "../_shared/api";
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

function ContactQueriesAdminPageInner() {
  const { can } = usePermissions();
  const { ask, dialog: confirmDialog } = useConfirm();
  const editable = can("contact-queries", "manage");
  // The status filter lives in the address too (?status=new, from the bell),
  // which can also name a query to open (?id=). Read again whenever the
  // address changes, so a second link followed from this page lands too.
  const searchParams = useSearchParams();
  const askedStatus = searchParams.get("status");
  const urlStatus = askedStatus && statuses.includes(askedStatus) ? askedStatus : "";
  const urlId = searchParams.get("id");
  const [statusFilter, setStatusFilter] = useState(urlStatus);
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
        `${API_BASE}/api/contact?page=${page}&limit=${PAGE_SIZE}${statusFilter ? `&status=${statusFilter}` : ""}`
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
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setStatusFilter(urlStatus);
    setPage(1);
  }, [urlStatus]);

  const open = (c: Contact) => {
    setSelected(c);
    setStatus(c.status || "new");
    setPriority(c.priority || "medium");
    setNote("");
  };

  // Fetched on its own, as it need not be on the page shown, and then dropped
  // from the address: closing it is final, and the same link followed again
  // opens it again.
  useEffect(() => {
    if (!urlId) return;
    replaceParams({ id: null });
    apiGet<{ data?: Contact }>(`${API_BASE}/api/contact/${encodeURIComponent(urlId)}`)
      .then((r) => {
        if (r.data) open(r.data);
      })
      .catch((e) => alert(e instanceof Error ? e.message : "Could not open that query"));
  }, [urlId]);

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

  const remove = async (c: Contact) => {
    const answer = await ask({
      title: c.fullName ? `Delete the message from ${c.fullName}?` : "Delete this message?",
      body: "This cannot be undone.",
      confirmLabel: "Delete message",
    });
    if (answer === null) return;
    try {
      await apiJson(`${API_BASE}/api/contact/${c._id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div>
      {confirmDialog}
      <PageHeader eyebrow="Customers" title="Contact Queries" />

      <div className="mb-4 w-48">
        <SelectField
          label="Status"
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
            replaceParams({ status: v });
          }}
          placeholder="All"
          options={statuses.map((s) => ({ value: s, label: s }))}
        />
      </div>

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
              {editable && <DangerButton onClick={() => remove(c)}>Delete</DangerButton>}
            </div>,
          ])}
          empty={statusFilter ? "No contact queries with this status." : "No contact queries yet."}
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

export default function ContactQueriesAdminPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <ContactQueriesAdminPageInner />
    </Suspense>
  );
}
