"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
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
  useConfirm,
  ErrorState,
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";

interface Coupon {
  _id: string;
  code: string;
  description: string;
  type: "percent" | "amount";
  value: number;
  currency: string;
  packageIds: { _id: string; name: string }[] | string[];
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number;
  redemptions: number;
  appliesToRenewals: boolean;
  isActive: boolean;
}

interface PackageOption {
  _id: string;
  name: string;
}

type Draft = {
  code: string;
  description: string;
  type: "percent" | "amount";
  value: string;
  currency: string;
  packageIds: string[];
  validFrom: string;
  validUntil: string;
  maxRedemptions: string;
  appliesToRenewals: boolean;
  isActive: boolean;
};

const emptyDraft: Draft = {
  code: "",
  description: "",
  type: "percent",
  value: "10",
  currency: "",
  packageIds: [],
  validFrom: "",
  validUntil: "",
  maxRedemptions: "0",
  appliesToRenewals: false,
  isActive: true,
};

function dateInput(value: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function describe(c: Coupon) {
  return c.type === "percent" ? `${c.value}% off` : `${c.currency || ""} ${c.value} off`;
}

export default function CouponsAdminPage() {
  const { can } = usePermissions();
  const { ask, dialog: confirmDialog } = useConfirm();
  const editable = can("coupons", "manage");

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        apiGet<{ data: Coupon[] }>(`${GYMFOLIO_API}/coupons`),
        apiGet<{ data: PackageOption[] }>(`${GYMFOLIO_API}/packages`),
      ]);
      setCoupons(c.data || []);
      setPackages(p.data || []);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load coupons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setError(null);
    setOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setDraft({
      code: c.code,
      description: c.description || "",
      type: c.type,
      value: String(c.value),
      currency: c.currency || "",
      packageIds: (c.packageIds || []).map((p) => (typeof p === "string" ? p : p._id)),
      validFrom: dateInput(c.validFrom),
      validUntil: dateInput(c.validUntil),
      maxRedemptions: String(c.maxRedemptions || 0),
      appliesToRenewals: !!c.appliesToRenewals,
      isActive: c.isActive,
    });
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const body = {
      code: draft.code,
      description: draft.description,
      type: draft.type,
      value: Number(draft.value) || 0,
      currency: draft.currency,
      packageIds: draft.packageIds,
      validFrom: draft.validFrom || null,
      validUntil: draft.validUntil || null,
      maxRedemptions: Number(draft.maxRedemptions) || 0,
      appliesToRenewals: draft.appliesToRenewals,
      isActive: draft.isActive,
    };
    try {
      if (editing) await apiJson(`${GYMFOLIO_API}/coupons/${editing._id}`, "PUT", body);
      else await apiJson(`${GYMFOLIO_API}/coupons`, "POST", body);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the coupon");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Coupon) => {
    const answer = await ask({ title: `Delete coupon ${c.code}?`, body: "Nobody can use the code after this. This cannot be undone.", confirmLabel: "Delete coupon" });
    if (answer === null) return;
    try {
      await apiJson(`${GYMFOLIO_API}/coupons/${c._id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const togglePackage = (id: string) =>
    setDraft((d) => ({
      ...d,
      packageIds: d.packageIds.includes(id) ? d.packageIds.filter((x) => x !== id) : [...d.packageIds, id],
    }));

  return (
    <div>
      {confirmDialog}
      <PageHeader
        eyebrow="Sales"
        title="Coupons"
        actions={
          editable ? (
            <PrimaryButton onClick={openCreate}>
              <FiPlus className="w-4 h-4 mr-1.5" /> New Coupon
            </PrimaryButton>
          ) : undefined
        }
      />

      {error && !open && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {loading ? (
        <Spinner />
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : (
        <Table
          columns={["Code", "Discount", "Applies to", "Valid", "Used", "Status", ""]}
          rows={coupons.map((c) => {
            const now = Date.now();
            const expired = c.validUntil && new Date(c.validUntil).getTime() < now;
            const usedUp = c.maxRedemptions > 0 && c.redemptions >= c.maxRedemptions;
            return [
              <div key="c">
                <code className="text-sm font-semibold text-neutral-900">{c.code}</code>
                {c.description && <p className="text-xs text-neutral-500">{c.description}</p>}
              </div>,
              <span key="d">
                {describe(c)}
                {c.appliesToRenewals && <span className="block text-[11px] text-neutral-500">every renewal</span>}
              </span>,
              <span key="p" className="text-xs text-neutral-600">
                {c.packageIds && c.packageIds.length
                  ? (c.packageIds as { _id: string; name: string }[]).map((p) => (typeof p === "string" ? p : p.name)).join(", ")
                  : "All packages"}
              </span>,
              <span key="v" className="text-xs text-neutral-600">
                {c.validFrom ? new Date(c.validFrom).toLocaleDateString() : "—"} → {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : "no end"}
              </span>,
              <span key="u" className="text-xs text-neutral-600">
                {c.redemptions}
                {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
              </span>,
              <Badge key="s" color={!c.isActive ? "neutral" : expired || usedUp ? "amber" : "green"}>
                {!c.isActive ? "Inactive" : expired ? "Expired" : usedUp ? "Used up" : "Active"}
              </Badge>,
              editable ? (
                <div key="a" className="flex gap-2">
                  <SecondaryButton onClick={() => openEdit(c)}>Edit</SecondaryButton>
                  <DangerButton onClick={() => remove(c)}>Delete</DangerButton>
                </div>
              ) : (
                <span key="a" />
              ),
            ];
          })}
          empty="No coupons yet. Create one to offer a discount at checkout or at the desk."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.code}` : "New coupon"} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Code" required value={draft.code} onChange={(v) => setDraft({ ...draft, code: v.toUpperCase() })} placeholder="SUMMER20" />
          <TextField label="Description" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} />
          <SelectField
            label="Discount type"
            value={draft.type}
            allowClear={false}
            onChange={(v) => setDraft({ ...draft, type: v as "percent" | "amount" })}
            options={[
              { value: "percent", label: "Percentage off" },
              { value: "amount", label: "Fixed amount off" },
            ]}
          />
          <TextField label={draft.type === "percent" ? "Percent (1–100)" : "Amount"} type="number" value={draft.value} onChange={(v) => setDraft({ ...draft, value: v })} />
          {draft.type === "amount" && (
            <TextField label="Currency (blank = any)" value={draft.currency} onChange={(v) => setDraft({ ...draft, currency: v.toUpperCase() })} placeholder="PKR" />
          )}
          <TextField label="Valid from" type="date" value={draft.validFrom} onChange={(v) => setDraft({ ...draft, validFrom: v })} />
          <TextField label="Valid until" type="date" value={draft.validUntil} onChange={(v) => setDraft({ ...draft, validUntil: v })} />
          <TextField label="Max uses (0 = unlimited)" type="number" value={draft.maxRedemptions} onChange={(v) => setDraft({ ...draft, maxRedemptions: v })} />

          <div className="md:col-span-2">
            <p className="text-xs font-semibold text-neutral-700">Packages (none selected = all)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {packages.map((p) => {
                const on = draft.packageIds.includes(p._id);
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => togglePackage(p._id)}
                    className={`rounded-full border px-3 py-1 text-xs ${on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <Toggle label="Also discount every renewal of recurring packages" checked={draft.appliesToRenewals} onChange={(v) => setDraft({ ...draft, appliesToRenewals: v })} />
          <Toggle label="Active" checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} />
        </div>
        <div className="mt-4">
          <TextArea label="Notes" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} />
        </div>
        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || !draft.code.trim()}>
            {saving ? "Saving…" : "Save coupon"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
