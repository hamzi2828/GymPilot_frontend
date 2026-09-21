"use client";

// Leave requests: what staff asked for, approve or reject, and record leave
// agreed in person.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiPlus } from "react-icons/fi";
import { PageHeader, PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, TextArea, SelectField, Toggle, Badge, Spinner, Table, ErrorState } from "../../_shared/ui";
import { API_BASE, apiGet, apiJson, replaceParams } from "../../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";

interface Leave {
  id: string;
  staff_id: string;
  staff_name: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  unpaid: boolean;
  decided_by: string;
  decision_note: string;
}
interface StaffOption {
  id: string;
  name: string;
}

const TYPES = [
  { value: "annual", label: "Annual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "unpaid", label: "Unpaid leave" },
  { value: "other", label: "Other" },
];
const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Withdrawn" },
];
const TONE: Record<Leave["status"], "amber" | "green" | "rose" | "neutral"> = { pending: "amber", approved: "green", rejected: "rose", cancelled: "neutral" };
const today = () => new Date().toISOString().slice(0, 10);

function LeavePageInner() {
  const { can } = usePermissions();
  const editable = can("staff", "manage");
  const [rows, setRows] = useState<Leave[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  // The status filter lives in the address too (?status=pending, from the
  // bell), read again whenever the address changes.
  const askedStatus = useSearchParams().get("status");
  const urlStatus = STATUSES.find((s) => s.value === askedStatus)?.value ?? "";
  const [status, setStatus] = useState(urlStatus);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ staffId: "", type: "annual", from: today(), to: today(), reason: "", approve: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Leave[] }>(`${API_BASE}/staff/leave${status ? `?status=${status}` : ""}`);
      setRows(r.data || []);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load leave");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setStatus(urlStatus);
  }, [urlStatus]);

  useEffect(() => {
    apiGet<{ staff: StaffOption[] }>(`${API_BASE}/staff?status=active`)
      .then((r) => setStaff((r.staff || []).map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => setStaff([]));
  }, []);

  const decide = async (l: Leave, next: "approved" | "rejected" | "pending") => {
    let note = "";
    if (next === "rejected") {
      // Cancel on the prompt means "not now", not "reject without a reason".
      const reason = prompt("Reason (optional):");
      if (reason === null) return;
      note = reason;
    }
    try {
      await apiJson(`${API_BASE}/staff/leave/${l.id}`, "PATCH", { status: next, note });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not update" });
    }
  };

  // Sent on its own, `unpaid` changes only that: the decision, its note and
  // who made it stay as they were. Withdrawn leave is left alone.
  const toggleUnpaid = async (l: Leave) => {
    if (l.status === "cancelled") return;
    try {
      await apiJson(`${API_BASE}/staff/leave/${l.id}`, "PATCH", { unpaid: !l.unpaid });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not update" });
    }
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await apiJson(`${API_BASE}/staff/leave`, "POST", draft);
      setOpen(false);
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not record leave" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Leave"
        actions={
          editable ? (
            <PrimaryButton onClick={() => { setDraft({ staffId: "", type: "annual", from: today(), to: today(), reason: "", approve: true }); setOpen(true); }}>
              <FiPlus className="mr-1.5 h-4 w-4" /> Record leave
            </PrimaryButton>
          ) : undefined
        }
      />
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      <div className="mb-4 w-48">
        <SelectField
          label="Status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            replaceParams({ status: v });
          }}
          placeholder="All"
          options={STATUSES}
        />
      </div>
      {loading ? (
        <Spinner />
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : (
        <Table
          columns={["Who", "Type", "Dates", "Reason", "Status", ""]}
          rows={rows.map((l) => [
            <span key="w" className="font-medium text-neutral-900">{l.staff_name}</span>,
            <span key="t" className="capitalize">{l.type}{l.unpaid && l.type !== "unpaid" ? " (unpaid)" : ""}</span>,
            <span key="d" className="text-sm">
              {l.from}{l.to !== l.from ? ` → ${l.to}` : ""} <span className="text-xs text-neutral-500">({l.days} day{l.days === 1 ? "" : "s"})</span>
            </span>,
            <span key="r" className="text-xs text-neutral-600">{l.reason || "—"}{l.decision_note ? <span className="block text-rose-600">{l.decision_note}</span> : null}</span>,
            <div key="s">
              <Badge color={TONE[l.status]}>{l.status === "cancelled" ? "withdrawn" : l.status}</Badge>
              {l.decided_by && <p className="text-[11px] text-neutral-400">by {l.decided_by}</p>}
            </div>,
            editable ? (
              <div key="a" className="flex flex-wrap gap-1.5">
                {l.status === "pending" && <PrimaryButton onClick={() => decide(l, "approved")}>Approve</PrimaryButton>}
                {l.status === "pending" && <DangerButton onClick={() => decide(l, "rejected")}>Reject</DangerButton>}
                {l.status === "approved" && <SecondaryButton onClick={() => decide(l, "pending")}>Undo</SecondaryButton>}
                {l.status !== "cancelled" && <SecondaryButton onClick={() => toggleUnpaid(l)}>{l.unpaid ? "Mark paid" : "Mark unpaid"}</SecondaryButton>}
              </div>
            ) : (
              <span key="a" />
            ),
          ])}
          empty="No leave requests."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Record leave" size="md">
        <div className="space-y-4">
          <SelectField label="Staff member" value={draft.staffId} allowClear={false} onChange={(v) => setDraft({ ...draft, staffId: v })} options={staff.map((s) => ({ value: s.id, label: s.name }))} />
          <SelectField label="Type" value={draft.type} allowClear={false} onChange={(v) => setDraft({ ...draft, type: v })} options={TYPES} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="From" type="date" value={draft.from} onChange={(v) => setDraft({ ...draft, from: v })} />
            <TextField label="To" type="date" value={draft.to} onChange={(v) => setDraft({ ...draft, to: v })} />
          </div>
          <TextArea label="Reason" value={draft.reason} onChange={(v) => setDraft({ ...draft, reason: v })} />
          <Toggle label="Approved now" checked={draft.approve} onChange={(v) => setDraft({ ...draft, approve: v })} />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton onClick={save} disabled={saving || !draft.staffId}>{saving ? "Saving…" : "Save"}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function LeavePage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <LeavePageInner />
    </Suspense>
  );
}
