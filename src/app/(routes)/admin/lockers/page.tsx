"use client";

// Lockers: the wall as a grid by zone -- free, assigned (to whom, until
// when), out of order.

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { PageHeader, Card, PrimaryButton, SecondaryButton, DangerButton, Modal, TextField } from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { MemberPicker, type MemberOption } from "../_ops/MemberPicker";

interface Locker {
  id: string;
  number: string;
  zone: string;
  status: "free" | "assigned" | "maintenance";
  member_id: string | null;
  member_name: string;
  until: string | null;
  overdue: boolean;
  fee: number;
  currency: string;
  notes: string;
}

export default function LockersPage() {
  const { can } = usePermissions();
  const editable = can("lockers", "manage");
  const [rows, setRows] = useState<Locker[]>([]);
  const [counts, setCounts] = useState<{ total: number; free: number; assigned: number; maintenance: number; overdue: number } | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({ from: "1", to: "20", zone: "", fee: "0" });
  const [selected, setSelected] = useState<Locker | null>(null);
  const [member, setMember] = useState<MemberOption | null>(null);
  const [assign, setAssign] = useState({ until: "", fee: "" });
  const [saving, setSaving] = useState(false);
  // Every save here starts from a dialog (add, or one locker), so a refusal
  // is shown in whichever is open.
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ counts: typeof counts; data: Locker[] }>(`${API_BASE}/admin/lockers`);
      setRows(r.data || []);
      setCounts(r.counts);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load lockers" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const zones = useMemo(() => Array.from(new Set(rows.map((l) => l.zone))).sort(), [rows]);

  const open = (l: Locker) => {
    setSelected(l);
    setSaveErr(null);
    setAssign({ until: "", fee: String(l.fee || "") });
    setMember(null);
  };

  const run = async (fn: () => Promise<{ message?: string } | void>) => {
    setSaving(true);
    setNotice(null);
    setSaveErr(null);
    try {
      const r = await fn();
      if (r && r.message) setNotice({ tone: "ok", text: r.message });
      setSelected(null);
      await load();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // A cancelled prompt returns null and must leave the locker as it was; an
  // empty answer is still a yes, just without a note.
  const markOutOfOrder = (l: Locker) => {
    const notes = prompt("What is wrong with it?");
    if (notes === null) return;
    run(() => apiJson(`${API_BASE}/admin/lockers/${l.id}`, "PUT", { status: "maintenance", notes }));
  };

  const tone = (l: Locker) => (l.status === "maintenance" ? "border-neutral-300 bg-neutral-100 text-neutral-400" : l.status === "assigned" ? (l.overdue ? "border-rose-300 bg-rose-50 text-rose-800" : "border-neutral-900 bg-neutral-900 text-white") : "border-emerald-200 bg-emerald-50 text-emerald-800");

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Lockers"
        actions={
          editable ? (
            <PrimaryButton onClick={() => { setSaveErr(null); setAddOpen(true); }}>
              <FiPlus className="mr-1.5 h-4 w-4" /> Add lockers
            </PrimaryButton>
          ) : undefined
        }
      />
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      {counts && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[["Total", counts.total], ["Free", counts.free], ["Assigned", counts.assigned], ["Overdue", counts.overdue], ["Out of order", counts.maintenance]].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
            </div>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-neutral-500">No lockers yet. Add a range to draw the wall.</Card>
      ) : (
        zones.map((zone) => (
          <div key={zone} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{zone ? `Zone ${zone}` : "Lockers"}</h2>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-12">
              {rows
                .filter((l) => l.zone === zone)
                .map((l) => (
                  <button key={l.id} type="button" onClick={() => open(l)} className={`rounded-lg border p-2 text-left text-xs ${tone(l)}`} title={l.member_name || l.status}>
                    <span className="block text-sm font-bold">{l.number}</span>
                    <span className="block truncate text-[10px] opacity-80">{l.status === "assigned" ? l.member_name : l.status === "maintenance" ? "out of order" : "free"}</span>
                  </button>
                ))}
            </div>
          </div>
        ))
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add lockers" size="sm" busy={saving} error={saveErr}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="From number" type="number" value={addDraft.from} onChange={(v) => setAddDraft({ ...addDraft, from: v })} />
            <TextField label="To number" type="number" value={addDraft.to} onChange={(v) => setAddDraft({ ...addDraft, to: v })} />
          </div>
          <TextField label="Zone (optional)" value={addDraft.zone} onChange={(v) => setAddDraft({ ...addDraft, zone: v })} placeholder="A, Ladies, Ground floor…" />
          <TextField label="Monthly fee (0 = free)" type="number" value={addDraft.fee} onChange={(v) => setAddDraft({ ...addDraft, fee: v })} />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setAddOpen(false)} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton onClick={() => run(async () => { const r = await apiJson<{ message: string }>(`${API_BASE}/admin/lockers`, "POST", { from: Number(addDraft.from), to: Number(addDraft.to), zone: addDraft.zone, fee: Number(addDraft.fee) || 0 }); setAddOpen(false); return r; })} disabled={saving}>Add</PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Locker ${selected.zone ? `${selected.zone}-` : ""}${selected.number}` : ""} size="sm" busy={saving} error={saveErr}>
        {selected && (
          <div className="space-y-4 text-sm">
            {selected.status === "assigned" ? (
              <>
                <p>
                  Assigned to <strong>{selected.member_name}</strong>
                  {selected.until ? ` until ${selected.until}` : ""}
                  {selected.overdue && <span className="ml-1 font-semibold text-rose-600">(overdue)</span>}
                </p>
                {editable && <PrimaryButton onClick={() => run(() => apiJson<{ message: string }>(`${API_BASE}/admin/lockers/${selected.id}/release`, "POST"))} disabled={saving}>Release</PrimaryButton>}
              </>
            ) : (
              <>
                {selected.status === "maintenance" && <p className="text-neutral-500">Out of order{selected.notes ? ` — ${selected.notes}` : ""}.</p>}
                {editable && selected.status === "free" && (
                  <>
                    <MemberPicker label="Assign to member" type="member" value={member} onChange={setMember} placeholder="Name, email or code" />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField label="Until (optional)" type="date" value={assign.until} onChange={(v) => setAssign({ ...assign, until: v })} />
                      <TextField label="Fee" type="number" value={assign.fee} onChange={(v) => setAssign({ ...assign, fee: v })} />
                    </div>
                    <PrimaryButton onClick={() => run(() => apiJson<{ message: string }>(`${API_BASE}/admin/lockers/${selected.id}/assign`, "POST", { memberId: member?.id, until: assign.until || null, fee: assign.fee === "" ? undefined : Number(assign.fee) }))} disabled={saving || !member}>Assign</PrimaryButton>
                  </>
                )}
              </>
            )}
            {editable && selected.status !== "assigned" && (
              <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                {selected.status === "free" ? (
                  <SecondaryButton onClick={() => markOutOfOrder(selected)} disabled={saving}>Mark out of order</SecondaryButton>
                ) : (
                  <SecondaryButton onClick={() => run(() => apiJson(`${API_BASE}/admin/lockers/${selected.id}`, "PUT", { status: "free", notes: "" }))} disabled={saving}>Back in service</SecondaryButton>
                )}
                <DangerButton onClick={() => confirm("Remove this locker?") && run(() => apiJson(`${API_BASE}/admin/lockers/${selected.id}`, "DELETE"))} disabled={saving}>Remove</DangerButton>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
