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
import { GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";

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
}

export default function PackagesAdminPage() {
  const [list, setList] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [form, setForm] = useState<Partial<Package>>({});
  const [featuresText, setFeaturesText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Package[] }>(`${GYMFOLIO_API}/packages`);
      setList(r.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ isActive: true, currency: "PKR", theme: "light", period: "month" });
    setFeaturesText("");
    setOpen(true);
  };

  const openEdit = (p: Package) => {
    setEditing(p);
    setForm(p);
    setFeaturesText((p.features || []).join("\n"));
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        features: featuresText.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      if (editing) {
        await apiJson(`${GYMFOLIO_API}/packages/${editing._id}`, "PUT", payload);
      } else {
        await apiJson(`${GYMFOLIO_API}/packages`, "POST", payload);
      }
      setOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
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
          columns={["Name", "Price", "Period", "Features", "Status", "Actions"]}
          rows={list.map((p) => [
            <div key="n" className="font-medium text-neutral-900">{p.name}{p.badge && <span className="ml-2 text-[10px] uppercase tracking-wider text-[#bee304]">{p.badge}</span>}</div>,
            `${p.currency} ${p.price}`,
            p.period,
            <span key="f" className="text-neutral-500 text-xs">{(p.features || []).length} items</span>,
            <button key="b" onClick={() => toggleActive(p)}>
              <Badge color={p.isActive ? "green" : "neutral"}>
                {p.isActive ? "Active" : "Inactive"}
              </Badge>
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
          <TextField label="Badge" value={form.badge} onChange={(v) => setForm({ ...form, badge: v })} />
          <TextField label="Price" required value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          <TextField label="Currency" required value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
          <TextField label="Period" required value={form.period} placeholder="e.g. month, year" onChange={(v) => setForm({ ...form, period: v })} />
          <SelectField
            label="Theme"
            value={form.theme}
            onChange={(v) => setForm({ ...form, theme: v as "light" | "dark" })}
            options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          />
          <TextField label="Order" type="number" value={form.order} onChange={(v) => setForm({ ...form, order: Number(v) })} />
          <div className="md:col-span-2">
            <TextArea
              label="Features (one per line)"
              value={featuresText}
              rows={6}
              onChange={setFeaturesText}
            />
          </div>
          <div className="md:col-span-2">
            <TextArea label="Supporting Text" value={form.supportingText} onChange={(v) => setForm({ ...form, supportingText: v })} />
          </div>
          <Toggle label="Active" checked={!!form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
