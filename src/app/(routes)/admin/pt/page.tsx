"use client";

// Personal training from the desk: every appointment in a date range,
// marking them done or missed, booking one for a member, and what each
// trainer has earned.

import { useCallback, useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { PageHeader, Card, PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, SelectField, Badge, Spinner, Table, useConfirm } from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { useGymToday } from "@/components/ThemeProvider";
import { MemberPicker, type MemberOption } from "../_ops/MemberPicker";

const PT_API = `${GYMFOLIO_API}/pt`;

interface Session {
  id: string;
  trainer_id: string;
  trainer_name: string;
  member_id: string;
  member_name: string;
  member_code: string;
  date: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  credit_used: boolean;
  price: number;
  currency: string;
  /** basis: a percent of the session, or a fixed amount per session. */
  commission: { basis?: "percent" | "amount"; percent: number; amount: number };
  booked_by: string;
  late_cancel: boolean;
  notes: string;
}
interface TrainerOption {
  id: string;
  name: string;
}
interface Summary {
  trainer_id: string;
  trainer_name: string;
  scheduled: number;
  completed: number;
  cancelled: number;
  no_show: number;
  value: number;
  commission: number;
  /** What each completed session earns them. */
  commission_terms?: { basis: "percent" | "amount"; value: number };
  /** Paid on a payslip (linked to a staff account) or by hand. */
  paid_by?: "payslip" | "direct";
}

function termsLabel(terms?: Summary["commission_terms"]) {
  if (!terms) return "";
  return terms.basis === "amount" ? `${terms.value} per session` : `${terms.value}% of each session`;
}
interface Slot {
  date: string;
  start_time: string;
  end_time: string;
}

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const STATUS_TONE: Record<Session["status"], "green" | "neutral" | "rose" | "blue"> = { scheduled: "blue", completed: "green", cancelled: "neutral", no_show: "rose" };

export default function PtAdminPage() {
  const today = useGymToday();
  const { can } = usePermissions();
  const { ask, dialog: confirmDialog } = useConfirm();
  const editable = can("pt", "manage");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 14));
  const [trainerId, setTrainerId] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Session[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ trainerId: "", date: today(), startTime: "", notes: "" });
  const [member, setMember] = useState<MemberOption | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);
  // Why the booking was refused, shown in the form itself.
  const [bookErr, setBookErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (trainerId) params.set("trainerId", trainerId);
      if (status) params.set("status", status);
      const [s, sum] = await Promise.all([apiGet<{ data: Session[] }>(`${PT_API}/sessions?${params}`), apiGet<{ data: Summary[] }>(`${PT_API}/summary?from=${from}&to=${to}`)]);
      setRows(s.data || []);
      setSummary(sum.data || []);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load sessions" });
    } finally {
      setLoading(false);
    }
  }, [from, to, trainerId, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiGet<{ data: TrainerOption[] }>(`${PT_API}/trainers`)
      .then((r) => setTrainers(r.data || []))
      .catch(() => setTrainers([]));
  }, []);

  useEffect(() => {
    if (!open || !draft.trainerId || !draft.date) {
      setSlots([]);
      return;
    }
    apiGet<{ data: Slot[] }>(`${PT_API}/availability?trainerId=${draft.trainerId}&from=${draft.date}&to=${draft.date}`)
      .then((r) => setSlots(r.data || []))
      .catch(() => setSlots([]));
  }, [open, draft.trainerId, draft.date]);

  const openBook = () => {
    setDraft({ trainerId: trainerId || "", date: today(), startTime: "", notes: "" });
    setMember(null);
    setBookErr(null);
    setOpen(true);
  };

  const book = async () => {
    setSaving(true);
    setNotice(null);
    setBookErr(null);
    try {
      const res = await apiJson<{ message: string }>(`${PT_API}/sessions/staff`, "POST", { ...draft, userId: member?.id });
      setNotice({ tone: "ok", text: res.message });
      setOpen(false);
      await load();
    } catch (e) {
      setBookErr(e instanceof Error ? e.message : "Could not book");
    } finally {
      setSaving(false);
    }
  };

  const setSessionStatus = async (s: Session, next: string) => {
    try {
      await apiJson(`${PT_API}/sessions/${s.id}/status`, "PATCH", { status: next });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not update" });
    }
  };

  const cancel = async (s: Session) => {
    const reason = await ask({
      title: `Cancel ${s.member_name}'s session?`,
      body: `With ${s.trainer_name} on ${s.date} at ${s.start_time}.`,
      confirmLabel: "Cancel session",
      cancelLabel: "Keep session",
      reason: { label: "Reason (optional)" },
    });
    if (reason === null) return;
    try {
      await apiJson(`${PT_API}/sessions/staff/${s.id}`, "DELETE", { reason });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not cancel" });
    }
  };

  return (
    <div>
      {confirmDialog}
      <PageHeader
        eyebrow="Fitness"
        title="Personal Training"
        actions={
          editable ? (
            <PrimaryButton onClick={openBook}>
              <FiPlus className="mr-1.5 h-4 w-4" /> Book a session
            </PrimaryButton>
          ) : undefined
        }
      />
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <TextField label="From" type="date" value={from} onChange={setFrom} />
          <TextField label="To" type="date" value={to} onChange={setTo} />
          <SelectField label="Trainer" value={trainerId} onChange={setTrainerId} placeholder="All trainers" options={trainers.map((t) => ({ value: t.id, label: t.name }))} />
          <SelectField label="Status" value={status} onChange={setStatus} placeholder="Any" options={[{ value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }, { value: "no_show", label: "No show" }, { value: "cancelled", label: "Cancelled" }]} />
        </div>
      </Card>

      {summary.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((t) => (
            <div key={t.trainer_id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-sm font-semibold text-neutral-900">{t.trainer_name}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {t.completed} done · {t.scheduled} upcoming · {t.no_show} missed
              </p>
              <p className="mt-2 text-sm text-neutral-700">
                Value {t.value.toFixed(0)} · commission payable <span className="font-semibold">{t.commission.toFixed(0)}</span>
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                {[termsLabel(t.commission_terms), t.paid_by === "direct" ? "no staff account: pay directly" : t.paid_by === "payslip" ? "paid on the payslip" : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["When", "Trainer", "Member", "Paid by", "Status", ""]}
          rows={rows.map((s) => [
            <span key="w" className="text-sm">
              {s.date} · {s.start_time}–{s.end_time}
            </span>,
            <span key="t">{s.trainer_name}</span>,
            <div key="m">
              <p className="font-medium text-neutral-900">{s.member_name}</p>
              <p className="text-xs text-neutral-500">{s.member_code}</p>
            </div>,
            <span key="p" className="text-xs text-neutral-600">
              {s.credit_used ? "Session pack" : s.price ? `${s.currency} ${s.price} at reception` : "—"}
              {s.status === "completed" && s.commission.amount ? (
                <span className="block text-[11px] text-neutral-400">
                  {s.commission.basis === "amount" ? `commission ${s.commission.amount} (fixed)` : `commission ${s.commission.percent}% = ${s.commission.amount}`}
                </span>
              ) : null}
            </span>,
            <div key="s">
              <Badge color={STATUS_TONE[s.status]}>{s.status.replace("_", " ")}</Badge>
              {s.late_cancel && <p className="text-[11px] text-rose-600">late cancel</p>}
            </div>,
            editable ? (
              <div key="a" className="flex flex-wrap gap-1.5">
                {s.status === "scheduled" && <SecondaryButton onClick={() => setSessionStatus(s, "completed")}>Done</SecondaryButton>}
                {s.status === "scheduled" && <SecondaryButton onClick={() => setSessionStatus(s, "no_show")}>No show</SecondaryButton>}
                {(s.status === "completed" || s.status === "no_show") && <SecondaryButton onClick={() => setSessionStatus(s, "scheduled")}>Undo</SecondaryButton>}
                {s.status === "scheduled" && <DangerButton onClick={() => cancel(s)}>Cancel</DangerButton>}
              </div>
            ) : (
              <span key="a" />
            ),
          ])}
          empty="No personal training sessions in this range."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Book a session" size="lg" busy={saving} error={bookErr}>
        <div className="space-y-4">
          <SelectField label="Trainer" value={draft.trainerId} allowClear={false} onChange={(v) => setDraft({ ...draft, trainerId: v, startTime: "" })} options={trainers.map((t) => ({ value: t.id, label: t.name }))} />
          <MemberPicker label="Find a member" type="member" value={member} onChange={setMember} listWhenEmpty />
          <TextField label="Date" type="date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v, startTime: "" })} />
          <div>
            <p className="text-xs font-medium text-neutral-600">Free slots</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {slots.map((s) => (
                <button key={s.start_time} type="button" onClick={() => setDraft({ ...draft, startTime: s.start_time })} className={`rounded-lg border px-3 py-1.5 text-sm ${draft.startTime === s.start_time ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 hover:border-neutral-400"}`}>
                  {s.start_time}
                </button>
              ))}
              {draft.trainerId && slots.length === 0 && <p className="text-xs text-neutral-500">No free slots that day (check the trainer&apos;s availability under Trainers).</p>}
            </div>
          </div>
          <TextField label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={book} disabled={saving || !draft.trainerId || !member || !draft.startTime}>
              {saving ? "Booking…" : "Book"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
