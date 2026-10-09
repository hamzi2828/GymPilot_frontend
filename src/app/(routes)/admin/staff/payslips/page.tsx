"use client";

// Payslips: drafted from pay rates, hours, leave and PT commission for a
// period; edited, issued, paid (which files the wage as an expense) and
// printed.

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card, PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, TextArea, SelectField, Badge, Spinner, Table, ErrorState, useConfirm } from "../../_shared/ui";
import { API_BASE, apiBlob, apiGet, apiJson } from "../../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { useGymToday } from "@/components/ThemeProvider";

interface Line {
  id?: string;
  label: string;
  amount: number;
}
interface Payslip {
  id: string;
  number: string;
  staff_name: string;
  job_title: string;
  period: { from: string; to: string; label: string };
  currency: string;
  basis: "salaried" | "hourly";
  base: number;
  hours: number;
  rate: number;
  unpaid_leave_days: number;
  unpaid_leave_deduction: number;
  pt_sessions: number;
  pt_commission: number;
  earnings: Line[];
  deductions: Line[];
  gross: number;
  net: number;
  status: "draft" | "issued" | "paid" | "void";
  paid_on: string | null;
  notes: string;
}

const monthStart = (key: string) => `${key.slice(0, 7)}-01`;
const TONE: Record<Payslip["status"], "neutral" | "blue" | "green" | "rose"> = { draft: "neutral", issued: "blue", paid: "green", void: "rose" };
const fmt = (n: number, c: string) => `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// The methods hrController.setPayslipStatus accepts; anything else is filed
// as a bank transfer.
const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "online", label: "Online" },
  { value: "other", label: "Other" },
];

export default function PayslipsPage() {
  const today = useGymToday();
  const { can } = usePermissions();
  const { ask, dialog: confirmDialog } = useConfirm();
  const editable = can("staff", "manage");
  const [from, setFrom] = useState(monthStart(today()));
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Why a save in the open dialog (pay, edit) failed, shown in that dialog.
  const [dialogErr, setDialogErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Payslip | null>(null);
  const [draft, setDraft] = useState<{ earnings: Line[]; deductions: Line[]; notes: string }>({ earnings: [], deductions: [], notes: "" });
  const [paying, setPaying] = useState<Payslip | null>(null);
  const [payDraft, setPayDraft] = useState({ paymentMethod: "bank_transfer", paidOn: today(), reference: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Payslip[] }>(`${API_BASE}/staff/payslips?from=${from}&to=${to}`);
      setRows(r.data || []);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load payslips");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    if (!confirm(`Draft payslips for every active staff member for ${from} → ${to}? Existing drafts are refreshed; issued ones are left alone.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await apiJson<{ message: string }>(`${API_BASE}/staff/payslips/generate`, "POST", { from, to });
      setNotice({ tone: "ok", text: r.message });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not draft payslips" });
    } finally {
      setBusy(false);
    }
  };

  const act = async (p: Payslip, action: "issue" | "pay" | "void", body: Record<string, unknown> = {}) => {
    if (action === "void") {
      const answer = await ask({
        title: `Void payslip ${p.number}?`,
        body: `${p.staff_name}, ${p.period.label}. It can no longer be edited, issued or paid. This cannot be undone.`,
        confirmLabel: "Void payslip",
      });
      if (answer === null) return false;
    }
    try {
      const r = await apiJson<{ message: string }>(`${API_BASE}/staff/payslips/${p.id}/${action}`, "POST", body);
      setNotice({ tone: "ok", text: r.message });
      await load();
      return true;
    } catch (e) {
      const text = e instanceof Error ? e.message : "Could not update";
      // Paying happens in a dialog; issuing and voiding happen on the row.
      if (action === "pay") setDialogErr(text);
      else setNotice({ tone: "error", text });
      return false;
    }
  };

  // Paying files the wage under Accounts → Expenses with this method, so it
  // is asked for rather than assumed.
  const openPay = (p: Payslip) => {
    setPaying(p);
    setNotice(null);
    setDialogErr(null);
    setPayDraft({ paymentMethod: "bank_transfer", paidOn: today(), reference: "" });
  };

  const confirmPay = async () => {
    if (!paying) return;
    setBusy(true);
    setDialogErr(null);
    const done = await act(paying, "pay", {
      paymentMethod: payDraft.paymentMethod,
      paidOn: payDraft.paidOn || undefined,
      reference: payDraft.reference.trim(),
    });
    setBusy(false);
    if (done) setPaying(null);
  };

  const openPdf = async (p: Payslip) => {
    try {
      const { blob } = await apiBlob(`${API_BASE}/staff/payslips/${p.id}/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not open the payslip" });
    }
  };

  const openEdit = (p: Payslip) => {
    setEditing(p);
    setDialogErr(null);
    setDraft({ earnings: p.earnings.map((l) => ({ label: l.label, amount: l.amount })), deductions: p.deductions.map((l) => ({ label: l.label, amount: l.amount })), notes: p.notes });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    setDialogErr(null);
    try {
      await apiJson(`${API_BASE}/staff/payslips/${editing.id}`, "PUT", draft);
      setEditing(null);
      await load();
    } catch (e) {
      setDialogErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const lineEditor = (key: "earnings" | "deductions", title: string) => (
    <div>
      <p className="text-xs font-semibold text-neutral-700">{title}</p>
      {draft[key].map((l, i) => (
        <div key={i} className="mt-2 grid grid-cols-[1fr_120px_auto] gap-2">
          <TextField label="" value={l.label} onChange={(v) => setDraft({ ...draft, [key]: draft[key].map((x, j) => (j === i ? { ...x, label: v } : x)) })} placeholder="Bonus, advance, tax…" />
          <TextField label="" type="number" value={String(l.amount)} onChange={(v) => setDraft({ ...draft, [key]: draft[key].map((x, j) => (j === i ? { ...x, amount: Number(v) || 0 } : x)) })} />
          <DangerButton onClick={() => setDraft({ ...draft, [key]: draft[key].filter((_, j) => j !== i) })}>×</DangerButton>
        </div>
      ))}
      <div className="mt-2">
        <SecondaryButton onClick={() => setDraft({ ...draft, [key]: [...draft[key], { label: "", amount: 0 }] })}>Add line</SecondaryButton>
      </div>
    </div>
  );

  const totals = rows.filter((p) => p.status !== "void").reduce((acc, p) => ({ ...acc, [p.currency]: (acc[p.currency] || 0) + p.net }), {} as Record<string, number>);

  return (
    <div>
      {confirmDialog}
      <PageHeader eyebrow="Operations" title="Payslips" actions={editable ? <PrimaryButton onClick={generate} disabled={busy}>{busy ? "Working…" : "Draft payslips for period"}</PrimaryButton> : undefined} />
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TextField label="Period from" type="date" value={from} onChange={setFrom} />
          <TextField label="Period to" type="date" value={to} onChange={setTo} />
          <div className="flex items-end text-sm text-neutral-600">
            {Object.entries(totals).map(([c, n]) => (
              <span key={c} className="mr-3">
                Net total <strong>{fmt(n, c)}</strong>
              </span>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Salaries are pro-rated to the period; hourly pay comes from recorded attendance; PT commission from completed sessions; approved unpaid leave is deducted. Paying a payslip files the wage under Accounts → Expenses.</p>
      </Card>
      {loading ? (
        <Spinner />
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : (
        <Table
          columns={["Payslip", "Staff", "Base", "PT", "Deductions", "Net", "Status", ""]}
          rows={rows.map((p) => [
            <div key="n">
              <p className="font-mono text-xs text-neutral-900">{p.number}</p>
              <p className="text-[11px] text-neutral-500">{p.period.label}</p>
            </div>,
            <div key="s">
              <p className="font-medium text-neutral-900">{p.staff_name}</p>
              <p className="text-[11px] text-neutral-500">{p.job_title}</p>
            </div>,
            <span key="b" className="text-sm">
              {fmt(p.base, p.currency)}
              <span className="block text-[11px] text-neutral-500">{p.basis === "hourly" ? `${p.hours} h × ${p.rate}` : "salary, pro-rated"}</span>
            </span>,
            <span key="p" className="text-sm">{p.pt_commission ? `${fmt(p.pt_commission, p.currency)} (${p.pt_sessions})` : "—"}</span>,
            <span key="d" className="text-sm">
              {p.unpaid_leave_deduction || p.deductions.length ? fmt(p.unpaid_leave_deduction + p.deductions.reduce((s, l) => s + l.amount, 0), p.currency) : "—"}
              {p.unpaid_leave_days ? <span className="block text-[11px] text-neutral-500">{p.unpaid_leave_days} unpaid day(s)</span> : null}
            </span>,
            <span key="t" className="text-sm font-semibold text-neutral-900">{fmt(p.net, p.currency)}</span>,
            <div key="st">
              <Badge color={TONE[p.status]}>{p.status}</Badge>
              {p.paid_on && <p className="text-[11px] text-neutral-400">{new Date(p.paid_on).toLocaleDateString()}</p>}
            </div>,
            <div key="a" className="flex flex-wrap gap-1.5">
              <SecondaryButton onClick={() => openPdf(p)}>PDF</SecondaryButton>
              {editable && p.status !== "paid" && p.status !== "void" && <SecondaryButton onClick={() => openEdit(p)}>Edit</SecondaryButton>}
              {editable && p.status === "draft" && <SecondaryButton onClick={() => act(p, "issue")}>Issue</SecondaryButton>}
              {editable && (p.status === "draft" || p.status === "issued") && <PrimaryButton onClick={() => openPay(p)}>Mark paid</PrimaryButton>}
              {editable && p.status !== "paid" && p.status !== "void" && <DangerButton onClick={() => act(p, "void")}>Void</DangerButton>}
            </div>,
          ])}
          empty="No payslips for this period yet. Draft them from the button above."
        />
      )}

      <Modal open={!!paying} onClose={() => setPaying(null)} title={paying ? `Pay ${paying.number} · ${paying.staff_name}` : ""} size="sm" busy={busy} error={dialogErr}>
        {paying && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Net pay <strong>{fmt(paying.net, paying.currency)}</strong>. Recording it files the wage under Accounts → Expenses.
            </p>
            <SelectField label="Paid by" value={payDraft.paymentMethod} allowClear={false} onChange={(v) => setPayDraft({ ...payDraft, paymentMethod: v })} options={PAYMENT_METHODS} />
            <TextField label="Paid on" type="date" value={payDraft.paidOn} onChange={(v) => setPayDraft({ ...payDraft, paidOn: v })} />
            <TextField label="Payment reference (optional)" value={payDraft.reference} onChange={(v) => setPayDraft({ ...payDraft, reference: v })} placeholder="Bank ref, cheque number…" />
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setPaying(null)} disabled={busy}>Cancel</SecondaryButton>
              <PrimaryButton onClick={confirmPay} disabled={busy}>{busy ? "Saving…" : "Mark paid"}</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `${editing.number} · ${editing.staff_name}` : ""} size="lg" busy={busy} error={dialogErr}>
        {editing && (
          <div className="space-y-5">
            <p className="text-sm text-neutral-600">
              Base {fmt(editing.base, editing.currency)} · PT commission {fmt(editing.pt_commission, editing.currency)}
              {editing.unpaid_leave_deduction ? ` · unpaid leave −${fmt(editing.unpaid_leave_deduction, editing.currency)}` : ""}
            </p>
            {lineEditor("earnings", "Extra earnings (bonus, overtime, allowance)")}
            {lineEditor("deductions", "Deductions (advance, tax, fines)")}
            <TextArea label="Notes on the payslip" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} />
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setEditing(null)} disabled={busy}>Cancel</SecondaryButton>
              <PrimaryButton onClick={saveEdit} disabled={busy}>{busy ? "Saving…" : "Save"}</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
