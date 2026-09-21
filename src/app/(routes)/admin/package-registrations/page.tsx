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
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson, replaceParams } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { Pager, LoadError, pageCount } from "../_ops/lists";

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

const PAGE_SIZE = 50;

function PackageRegistrationsAdminPageInner() {
  const { can } = usePermissions();
  const editable = can("registrations", "manage");
  // The status filter lives in the address too (?status=pending, from the
  // bell), read again whenever the address changes.
  const askedStatus = useSearchParams().get("status");
  const urlStatus = askedStatus && statuses.includes(askedStatus) ? askedStatus : "";
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [list, setList] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Registration | null>(null);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Paged rather than one big request: the endpoint defaults to twenty, and a
  // fixed larger limit only moved the point where registrations went missing.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Registration[]; pagination?: { total?: number; pages?: number; limit?: number } }>(
        `${GYMFOLIO_API}/package-registrations?page=${page}&limit=${PAGE_SIZE}${statusFilter ? `&status=${statusFilter}` : ""}`
      );
      // Deleting the last registration on the last page leaves nothing to show.
      if (!(r.data || []).length && page > 1) {
        setPage(page - 1);
        return;
      }
      setList(r.data || []);
      setPages(pageCount(r.pagination));
      setTotal(r.pagination?.total ?? (r.data || []).length);
      setError(null);
    } catch (e) {
      // Said out loud: an empty list here reads as "no registrations yet".
      setError(e instanceof Error ? e.message : "Could not load registrations");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setStatusFilter(urlStatus);
    setPage(1);
  }, [urlStatus]);

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

      {error && <LoadError message={error} onRetry={load} />}

      {loading ? (
        <Spinner />
      ) : error && !list.length ? null : (
        <Table
          columns={["Name", "Email", "Phone", "Platform", "Status", "Created", "Actions"]}
          rows={list.map((r) => [
            <div key="n" className="font-medium text-neutral-900">{r.username}</div>,
            r.email,
            r.phone,
            r.platform,
            <Badge key="s" color={colorMap[r.status] || "neutral"}>{r.status}</Badge>,
            new Date(r.createdAt).toLocaleDateString(),
            editable ? (
              <div key="a" className="flex gap-2">
                <SecondaryButton onClick={() => open(r)}>Update</SecondaryButton>
                <DangerButton onClick={() => remove(r._id)}>Delete</DangerButton>
              </div>
            ) : (
              <span key="a" />
            ),
          ])}
          empty={statusFilter ? "No registrations with this status." : "No registrations yet."}
        />
      )}

      <Pager page={page} pages={pages} total={total} onChange={setPage} disabled={loading} />

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

export default function PackageRegistrationsAdminPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <PackageRegistrationsAdminPageInner />
    </Suspense>
  );
}
