"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import {
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  Modal,
  TextField,
  TextArea,
  SelectField,
  Toggle,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { API_BASE, GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";
import { currencyOptions } from "@/data/countries";

const CURRENCY_OPTIONS = currencyOptions();

type Kind = "membership" | "session_pack" | "day_pass" | "trial" | "pt_pack";
type BillingMode = "one_time" | "recurring";
type Interval = "day" | "week" | "month" | "year";

interface Billing {
  mode: BillingMode;
  interval: Interval;
  intervalCount: number;
  trialDays: number;
}

interface Package {
  _id: string;
  name: string;
  price: string;
  currency: string;
  period: string;
  features: string[];
  theme?: "light" | "dark";
  badge?: string;
  supportingText?: string;
  isActive: boolean;
  order?: number;
  kind?: Kind;
  billing?: Billing;
  durationDays?: number;
  sessions?: number;
  joiningFee?: number;
}

const KIND_LABELS: Record<Kind, string> = {
  membership: "Membership",
  session_pack: "Session pack",
  day_pass: "Day pass",
  trial: "Trial",
  pt_pack: "Personal training pack",
};

const DEFAULT_BILLING: Billing = { mode: "one_time", interval: "month", intervalCount: 1, trialDays: 0 };

function describeBilling(p: Package) {
  const b = p.billing || DEFAULT_BILLING;
  if (b.mode === "recurring") {
    const every = b.intervalCount > 1 ? `every ${b.intervalCount} ${b.interval}s` : `every ${b.interval}`;
    return `Recurring · ${every}${b.trialDays ? ` · ${b.trialDays}-day trial` : ""}`;
  }
  if (p.durationDays) return `One-off · ${p.durationDays} days`;
  return `One-off · ${p.period}`;
}

export default function PackagesAdminPage() {
  const [list, setList] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [form, setForm] = useState<Partial<Package>>({});
  const [billing, setBilling] = useState<Billing>(DEFAULT_BILLING);
  const [featuresText, setFeaturesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The gym's currency (Settings → General); new packages start on it.
  const [defaultCurrency, setDefaultCurrency] = useState("USD");

  useEffect(() => {
    apiGet<{ data?: { currency?: string } }>(`${API_BASE}/settings`)
      .then((r) => {
        if (r.data?.currency) setDefaultCurrency(r.data.currency);
      })
      .catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Package[] }>(`${GYMFOLIO_API}/packages`);
      setList(r.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ isActive: true, currency: defaultCurrency, theme: "light", period: "month", kind: "membership", durationDays: 0, sessions: 0, joiningFee: 0 });
    setBilling(DEFAULT_BILLING);
    setFeaturesText("");
    setError(null);
    setOpen(true);
  };

  const openEdit = (p: Package) => {
    setEditing(p);
    setForm(p);
    setBilling({ ...DEFAULT_BILLING, ...(p.billing || {}) });
    setFeaturesText((p.features || []).join("\n"));
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const period = billing.mode === "recurring" ? billing.interval : form.period;
      const payload = {
        ...form,
        period,
        billing,
        durationDays: Number(form.durationDays) || 0,
        sessions: Number(form.sessions) || 0,
        joiningFee: Number(form.joiningFee) || 0,
        features: featuresText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (editing) {
        await apiJson(`${GYMFOLIO_API}/packages/${editing._id}`, "PUT", payload);
      } else {
        await apiJson(`${GYMFOLIO_API}/packages`, "POST", payload);
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this package?")) return;
    try {
      await apiJson(`${GYMFOLIO_API}/packages/${id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleActive = async (p: Package) => {
    try {
      await apiJson(`${GYMFOLIO_API}/packages/${p._id}/toggle-active`, "PATCH");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  const kind = (form.kind || "membership") as Kind;
  const isPack = kind === "session_pack" || kind === "pt_pack";

  return (
    <div>
      <PageHeader
        eyebrow="Fitness"
        title="Packages"
        actions={
          <PrimaryButton onClick={openCreate}>
            <FiPlus className="w-4 h-4 mr-1.5" /> New Package
          </PrimaryButton>
        }
      />

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["Name", "Type", "Price", "Billing", "Features", "Status", "Actions"]}
          rows={list.map((p) => [
            <div key="n" className="font-medium text-neutral-900">
              {p.name}
              {p.badge && <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--accent)]">{p.badge}</span>}
            </div>,
            <span key="k" className="text-xs text-neutral-600">
              {KIND_LABELS[(p.kind || "membership") as Kind]}
              {(p.sessions || 0) > 0 && ` · ${p.sessions} sessions`}
            </span>,
            <span key="p">
              {p.currency} {p.price}
              {(p.joiningFee || 0) > 0 && <span className="block text-[11px] text-neutral-500">+ {p.currency} {p.joiningFee} joining fee</span>}
            </span>,
            <span key="b" className="text-xs text-neutral-600">{describeBilling(p)}</span>,
            <span key="f" className="text-neutral-500 text-xs">{(p.features || []).length} items</span>,
            <button key="s" onClick={() => toggleActive(p)}>
              <Badge color={p.isActive ? "green" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge>
            </button>,
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => openEdit(p)}>
                <FiEdit2 className="w-3.5 h-3.5" />
              </SecondaryButton>
              <DangerButton onClick={() => remove(p._id)}>
                <FiTrash2 className="w-3.5 h-3.5" />
              </DangerButton>
            </div>,
          ])}
          empty="No packages yet — click 'New Package' to add one."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Package" : "New Package"} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <SelectField
            label="Type"
            value={kind}
            allowClear={false}
            onChange={(v) => setForm({ ...form, kind: v as Kind })}
            options={(Object.keys(KIND_LABELS) as Kind[]).map((k) => ({ value: k, label: KIND_LABELS[k] }))}
          />
          <TextField label="Price" required value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="e.g. 49 or 49.99" />
          <SelectField label="Currency" value={form.currency} allowClear={false} onChange={(v) => setForm({ ...form, currency: v })} options={CURRENCY_OPTIONS} />

          <div className="md:col-span-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
            <p className="text-xs font-semibold text-neutral-700">Billing</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="How it is paid"
                value={billing.mode}
                allowClear={false}
                onChange={(v) => setBilling({ ...billing, mode: v as BillingMode })}
                options={[
                  { value: "one_time", label: "One-off payment for a fixed term" },
                  { value: "recurring", label: "Recurring — card charged automatically (Stripe)" },
                ]}
              />
              {billing.mode === "recurring" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label="Every"
                      type="number"
                      value={billing.intervalCount}
                      onChange={(v) => setBilling({ ...billing, intervalCount: Math.max(1, Number(v) || 1) })}
                    />
                    <SelectField
                      label="Interval"
                      value={billing.interval}
                      allowClear={false}
                      onChange={(v) => setBilling({ ...billing, interval: v as Interval })}
                      options={[
                        { value: "week", label: "week(s)" },
                        { value: "month", label: "month(s)" },
                        { value: "year", label: "year(s)" },
                      ]}
                    />
                  </div>
                  <TextField
                    label="Free trial days (0 = none)"
                    type="number"
                    value={billing.trialDays}
                    onChange={(v) => setBilling({ ...billing, trialDays: Math.max(0, Number(v) || 0) })}
                  />
                </>
              ) : (
                <>
                  <TextField
                    label="Period label"
                    required
                    value={form.period}
                    placeholder="e.g. month, 3 months, year"
                    onChange={(v) => setForm({ ...form, period: v })}
                  />
                  <TextField
                    label="Valid for (days, 0 = use the period)"
                    type="number"
                    value={form.durationDays}
                    onChange={(v) => setForm({ ...form, durationDays: Number(v) || 0 })}
                  />
                </>
              )}
              <TextField label="Joining fee (charged once)" type="number" value={form.joiningFee} onChange={(v) => setForm({ ...form, joiningFee: Number(v) || 0 })} />
              {isPack && (
                <TextField label="Sessions on the pack" type="number" value={form.sessions} onChange={(v) => setForm({ ...form, sessions: Number(v) || 0 })} />
              )}
            </div>
            {billing.mode === "recurring" && (
              <p className="mt-3 text-xs text-neutral-500">
                Recurring packages are sold through Stripe Checkout and renew automatically; members can cancel from their account. Bank transfer and cash sales of this package are one term at a time.
              </p>
            )}
          </div>

          <TextField label="Badge" value={form.badge} onChange={(v) => setForm({ ...form, badge: v })} placeholder="e.g. Most popular" />
          <SelectField
            label="Theme"
            value={form.theme}
            onChange={(v) => setForm({ ...form, theme: v as "light" | "dark" })}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <TextField label="Order" type="number" value={form.order} onChange={(v) => setForm({ ...form, order: Number(v) })} />
          <div className="flex items-end pb-2">
            <Toggle label="Active" checked={!!form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
          </div>
          <div className="md:col-span-2">
            <TextArea label="Features (one per line)" value={featuresText} rows={6} onChange={setFeaturesText} />
          </div>
          <div className="md:col-span-2">
            <TextArea label="Supporting Text" value={form.supportingText} onChange={(v) => setForm({ ...form, supportingText: v })} />
          </div>
        </div>
        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? "Saving..." : editing ? "Update" : "Create"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
