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
import { API_BASE, apiGet, apiJson, apiForm, absoluteUrl } from "../_shared/api";

interface HeroSlide {
  _id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  image?: string;
  order?: number;
  isActive: boolean;
}

const SLIDES_API = `${API_BASE}/hero-slides`;

export default function HeroSlidesAdminPage() {
  const [list, setList] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HeroSlide | null>(null);
  const [form, setForm] = useState<Partial<HeroSlide>>({});
  const [img, setImg] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: HeroSlide[]; slides?: HeroSlide[] }>(SLIDES_API);
      setList(r.data || r.slides || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ isActive: true, order: 0 });
    setImg(null);
    setOpen(true);
  };

  const openEdit = (s: HeroSlide) => {
    setEditing(s);
    setForm(s);
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
        await apiForm(`${SLIDES_API}/${editing._id}`, "PUT", fd);
      } else {
        await apiForm(SLIDES_API, "POST", fd);
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
    if (!confirm("Delete this slide?")) return;
    try {
      await apiJson(`${SLIDES_API}/${id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleActive = async (s: HeroSlide) => {
    try {
      await apiJson(`${SLIDES_API}/${s._id}/status`, "PATCH");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="Hero Slides"
        actions={
          <PrimaryButton onClick={openCreate}>
            <FiPlus className="w-4 h-4 mr-1.5" /> New Slide
          </PrimaryButton>
        }
      />

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["", "Title", "CTA", "Order", "Status", "Actions"]}
          rows={list.map((s) => [
            s.image ? (
              <Image src={absoluteUrl(s.image)} alt={s.title || ""} width={64} height={40} className="rounded object-cover w-16 h-10" unoptimized />
            ) : (
              <div className="w-16 h-10 rounded bg-neutral-100" />
            ),
            <div key="t">
              <div className="font-medium text-neutral-900">{s.title}</div>
              <div className="text-xs text-neutral-500 line-clamp-1">{s.subtitle}</div>
            </div>,
            s.ctaText || "—",
            s.order ?? 0,
            <button key="st" onClick={() => toggleActive(s)}>
              <Badge color={s.isActive ? "green" : "neutral"}>{s.isActive ? "Active" : "Inactive"}</Badge>
            </button>,
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => openEdit(s)}><FiEdit2 className="w-3.5 h-3.5" /></SecondaryButton>
              <DangerButton onClick={() => remove(s._id)}><FiTrash2 className="w-3.5 h-3.5" /></DangerButton>
            </div>,
          ])}
          empty="No hero slides yet."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Slide" : "New Slide"} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <TextField label="Subtitle" value={form.subtitle} onChange={(v) => setForm({ ...form, subtitle: v })} />
          <TextField label="CTA Text" value={form.ctaText} onChange={(v) => setForm({ ...form, ctaText: v })} />
          <TextField label="CTA Link" value={form.ctaLink} onChange={(v) => setForm({ ...form, ctaLink: v })} />
          <TextField label="Order" type="number" value={form.order} onChange={(v) => setForm({ ...form, order: Number(v) })} />
          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Image</span>
            <input type="file" accept="image/*" onChange={(e) => setImg(e.target.files?.[0] || null)} className="mt-1 w-full text-sm" />
          </label>
          <div className="md:col-span-2">
            <TextArea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
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
