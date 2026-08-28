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
  SelectField,
  Toggle,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson, apiForm, absoluteUrl } from "../_shared/api";

interface GymClass {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  thumbnail?: string;
  duration?: number;
  difficulty?: string;
  capacity?: number;
  category?: string;
  price?: number;
  isActive: boolean;
  isFeatured?: boolean;
}

const difficulties = ["Beginner", "Intermediate", "Advanced", "All Levels"];
const categories = ["Yoga", "Cardio", "Strength", "Boxing", "HIIT", "Dance", "Martial Arts", "Other"];

export default function ClassesAdminPage() {
  const [list, setList] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GymClass | null>(null);
  const [form, setForm] = useState<Partial<GymClass>>({});
  const [thumb, setThumb] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: GymClass[] }>(`${GYMFOLIO_API}/gym-classes`);
      setList(r.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ isActive: true, difficulty: "All Levels", category: "Other", capacity: 20 });
    setThumb(null);
    setOpen(true);
  };

  const openEdit = (c: GymClass) => {
    setEditing(c);
    setForm(c);
    setThumb(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (typeof v === "boolean") fd.append(k, String(v));
        else fd.append(k, String(v));
      });
      if (thumb) fd.append("thumbnail", thumb);
      if (editing) {
        await apiForm(`${GYMFOLIO_API}/gym-classes/${editing._id}`, "PUT", fd);
      } else {
        await apiForm(`${GYMFOLIO_API}/gym-classes`, "POST", fd);
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
    if (!confirm("Delete this class?")) return;
    try {
      await apiJson(`${GYMFOLIO_API}/gym-classes/${id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleActive = async (c: GymClass) => {
    try {
      await apiJson(`${GYMFOLIO_API}/gym-classes/${c._id}/toggle-active`, "PATCH");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Fitness"
        title="Classes"
        actions={
          <PrimaryButton onClick={openCreate}>
            <FiPlus className="w-4 h-4 mr-1.5" /> New Class
          </PrimaryButton>
        }
      />

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["", "Name", "Category", "Difficulty", "Capacity", "Status", "Actions"]}
          rows={list.map((c) => [
            c.thumbnail ? (
              <Image
                src={absoluteUrl(c.thumbnail)}
                alt={c.name}
                width={48}
                height={48}
                className="rounded object-cover w-12 h-12"
                unoptimized
              />
            ) : (
              <div className="w-12 h-12 rounded bg-neutral-100" />
            ),
            <div key="n" className="font-medium text-neutral-900">{c.name}</div>,
            c.category || "—",
            c.difficulty || "—",
            c.capacity ?? "—",
            <button key="b" onClick={() => toggleActive(c)}>
              <Badge color={c.isActive ? "green" : "neutral"}>
                {c.isActive ? "Active" : "Inactive"}
              </Badge>
            </button>,
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => openEdit(c)}>
                <FiEdit2 className="w-3.5 h-3.5" />
              </SecondaryButton>
              <DangerButton onClick={() => remove(c._id)}>
                <FiTrash2 className="w-3.5 h-3.5" />
              </DangerButton>
            </div>,
          ])}
          empty="No classes yet — click 'New Class' to add one."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Class" : "New Class"} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <TextField label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          <SelectField
            label="Category"
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={categories.map((x) => ({ value: x, label: x }))}
          />
          <SelectField
            label="Difficulty"
            value={form.difficulty}
            onChange={(v) => setForm({ ...form, difficulty: v })}
            options={difficulties.map((x) => ({ value: x, label: x }))}
          />
          <TextField label="Duration (min)" type="number" value={form.duration} onChange={(v) => setForm({ ...form, duration: Number(v) })} />
          <TextField label="Capacity" type="number" value={form.capacity} onChange={(v) => setForm({ ...form, capacity: Number(v) })} />
          <TextField label="Price" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: Number(v) })} />
          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Thumbnail</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumb(e.target.files?.[0] || null)}
              className="mt-1 w-full text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <TextArea label="Short Description" value={form.shortDescription} onChange={(v) => setForm({ ...form, shortDescription: v })} />
          </div>
          <div className="md:col-span-2">
            <TextArea label="Description" value={form.description} rows={6} onChange={(v) => setForm({ ...form, description: v })} />
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
