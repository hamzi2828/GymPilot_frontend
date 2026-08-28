"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import {
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  Modal,
  TextField,
  TextArea,
  Toggle,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson, apiForm, absoluteUrl } from "../_shared/api";

interface Trainer {
  _id: string;
  name: string;
  slug?: string;
  role: string;
  bio?: string;
  image?: string;
  email?: string;
  phone?: string;
  experience?: number;
  isActive: boolean;
  isFeatured?: boolean;
}

export default function TrainersAdminPage() {
  const [list, setList] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trainer | null>(null);
  const [form, setForm] = useState<Partial<Trainer>>({});
  const [img, setImg] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Trainer[] }>(`${GYMFOLIO_API}/trainers`);
      setList(r.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ isActive: true });
    setImg(null);
    setOpen(true);
  };

  const openEdit = (t: Trainer) => {
    setEditing(t);
    setForm(t);
    setImg(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (typeof v === "object") return;
        fd.append(k, String(v));
      });
      if (img) fd.append("image", img);
      if (editing) {
        await apiForm(`${GYMFOLIO_API}/trainers/${editing._id}`, "PUT", fd);
      } else {
        await apiForm(`${GYMFOLIO_API}/trainers`, "POST", fd);
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
    if (!confirm("Delete this trainer?")) return;
    try {
      await apiJson(`${GYMFOLIO_API}/trainers/${id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleActive = async (t: Trainer) => {
    try {
      await apiJson(`${GYMFOLIO_API}/trainers/${t._id}/toggle-active`, "PATCH");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Fitness"
        title="Trainers"
        actions={
          <PrimaryButton onClick={openCreate}>
            <FiPlus className="w-4 h-4 mr-1.5" /> New Trainer
          </PrimaryButton>
        }
      />

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["", "Name", "Role", "Experience", "Email", "Status", "Actions"]}
          rows={list.map((t) => [
            t.image ? (
              <Image
                src={absoluteUrl(t.image)}
                alt={t.name}
                width={48}
                height={48}
                className="rounded-full object-cover w-12 h-12"
                unoptimized
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-neutral-100" />
            ),
            <div key="n" className="font-medium text-neutral-900">{t.name}</div>,
            t.role,
            t.experience ? `${t.experience} yrs` : "—",
            t.email || "—",
            <button key="b" onClick={() => toggleActive(t)}>
              <Badge color={t.isActive ? "green" : "neutral"}>
                {t.isActive ? "Active" : "Inactive"}
              </Badge>
            </button>,
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => openEdit(t)}>
                <FiEdit2 className="w-3.5 h-3.5" />
              </SecondaryButton>
              <DangerButton onClick={() => remove(t._id)}>
                <FiTrash2 className="w-3.5 h-3.5" />
              </DangerButton>
            </div>,
          ])}
          empty="No trainers yet — click 'New Trainer' to add one."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Trainer" : "New Trainer"} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <TextField label="Role" required value={form.role} onChange={(v) => setForm({ ...form, role: v })} />
          <TextField label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          <TextField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <TextField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <TextField label="Experience (years)" type="number" value={form.experience} onChange={(v) => setForm({ ...form, experience: Number(v) })} />
          <label className="block md:col-span-2">
            <span className="text-xs font-medium text-neutral-600">Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImg(e.target.files?.[0] || null)}
              className="mt-1 w-full text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <TextArea label="Bio" value={form.bio} rows={5} onChange={(v) => setForm({ ...form, bio: v })} />
          </div>
          <Toggle label="Active" checked={!!form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
          <Toggle label="Featured" checked={!!form.isFeatured} onChange={(v) => setForm({ ...form, isFeatured: v })} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
