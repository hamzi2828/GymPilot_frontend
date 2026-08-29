"use client";

// Admin → Testimonials
//
// Member reviews rendered by the homepage testimonials section. Same list /
// modal / drag-reorder patterns as Hero Slides.

import { useEffect, useState } from "react";
import Image from "next/image";
import { FiPlus, FiEdit2, FiTrash2, FiMenu, FiStar } from "react-icons/fi";
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
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson, apiForm, absoluteUrl } from "../_shared/api";

interface Testimonial {
  _id: string;
  name?: string;
  role?: string;
  quote?: string;
  rating?: number;
  imageUrl?: string;
  order?: number;
  isActive: boolean;
}

const TESTIMONIALS_API = `${API_BASE}/testimonials`;

function RatingPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <span className="text-xs font-semibold text-neutral-700">Rating</span>
      <div className="mt-1 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="p-1"
          >
            <FiStar
              className={`h-5 w-5 transition-colors ${
                n <= value ? "fill-[var(--accent)] text-[var(--accent)]" : "text-neutral-300"
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-xs text-neutral-500">{value} / 5</span>
      </div>
    </div>
  );
}

export default function TestimonialsAdminPage() {
  const [list, setList] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<Partial<Testimonial>>({});
  const [img, setImg] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: Testimonial[] }>(TESTIMONIALS_API);
      setList(r.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ isActive: true, rating: 5 });
    setImg(null);
    setOpen(true);
  };

  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm(t);
    setImg(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      (["name", "role", "quote"] as const).forEach((k) => {
        if (form[k] !== undefined) fd.append(k, String(form[k] ?? ""));
      });
      fd.append("rating", String(form.rating ?? 5));
      fd.append("isActive", String(!!form.isActive));
      if (img) fd.append("image", img);
      if (editing) {
        await apiForm(`${TESTIMONIALS_API}/${editing._id}`, "PUT", fd);
      } else {
        await apiForm(TESTIMONIALS_API, "POST", fd);
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
    if (!confirm("Delete this testimonial?")) return;
    try {
      await apiJson(`${TESTIMONIALS_API}/${id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleActive = async (t: Testimonial) => {
    try {
      await apiJson(`${TESTIMONIALS_API}/${t._id}/status`, "PATCH");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  // --- Drag-and-drop ordering -------------------------------------------
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  const persistOrder = async (ordered: Testimonial[]) => {
    setSavingOrder(true);
    setOrderNotice(null);
    try {
      await apiJson(`${TESTIMONIALS_API}/reorder`, "PUT", {
        order: ordered.map((t, i) => ({ id: t._id, order: i + 1 })),
      });
      setOrderNotice("Order saved.");
    } catch (e) {
      setOrderNotice(e instanceof Error ? e.message : "Could not save the new order.");
      await load();
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDrop = (target: number) => {
    setOverIndex(null);
    const from = dragIndex;
    setDragIndex(null);
    if (from === null || from === target) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    setList(next);
    persistOrder(next);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="Testimonials"
        actions={
          <PrimaryButton onClick={openCreate}>
            <FiPlus className="w-4 h-4 mr-1.5" /> New Testimonial
          </PrimaryButton>
        }
      />

      {loading ? (
        <Spinner />
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3 text-xs text-neutral-500">
            <span>Drag to reorder. Active testimonials appear in the homepage testimonials section.</span>
            {savingOrder && <span className="text-neutral-400">Saving…</span>}
          </div>

          {orderNotice && (
            <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700">
              <span>{orderNotice}</span>
              <button
                type="button"
                onClick={() => setOrderNotice(null)}
                className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center">
              <p className="text-sm font-medium text-neutral-900">No testimonials yet</p>
              <p className="mt-1 text-xs text-neutral-500">
                Until you add one, the homepage shows built-in sample reviews. Add real ones to replace them.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {list.map((t, i) => (
                <li
                  key={t._id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragEnter={() => setOverIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onDrop={() => handleDrop(i)}
                  className={`flex items-center gap-4 rounded-xl border bg-white p-3 transition-all ${
                    dragIndex === i
                      ? "opacity-40"
                      : overIndex === i
                      ? "border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                      : "border-neutral-200"
                  }`}
                >
                  <span className="cursor-grab select-none text-neutral-300 active:cursor-grabbing" title="Drag to reorder" aria-hidden="true">
                    <FiMenu className="h-4 w-4" />
                  </span>

                  {t.imageUrl ? (
                    <Image
                      src={absoluteUrl(t.imageUrl)}
                      alt={t.name || ""}
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-400">
                      {(t.name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-neutral-900">{t.name}</span>
                      <span className="flex items-center gap-0.5 text-[var(--accent)]">
                        {Array.from({ length: Math.max(1, Math.min(5, t.rating || 5)) }, (_, s) => (
                          <FiStar key={s} className="h-3 w-3 fill-current" />
                        ))}
                      </span>
                    </div>
                    <div className="truncate text-xs text-neutral-500">{t.quote}</div>
                  </div>

                  <button type="button" onClick={() => toggleActive(t)} className="shrink-0">
                    <Badge color={t.isActive ? "green" : "neutral"}>{t.isActive ? "Active" : "Inactive"}</Badge>
                  </button>

                  <div className="flex shrink-0 gap-2">
                    <SecondaryButton onClick={() => openEdit(t)}>
                      <FiEdit2 className="h-3.5 w-3.5" />
                    </SecondaryButton>
                    <DangerButton onClick={() => remove(t._id)}>
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </DangerButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Testimonial" : "New Testimonial"} size="md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <TextField
            label="Role / context"
            value={form.role}
            onChange={(v) => setForm({ ...form, role: v })}
            placeholder="e.g. Member for 2 years"
          />
          <div className="md:col-span-2">
            <TextArea label="Quote" value={form.quote} onChange={(v) => setForm({ ...form, quote: v })} rows={4} />
          </div>
          <RatingPicker value={form.rating ?? 5} onChange={(v) => setForm({ ...form, rating: v })} />
          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Photo (optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImg(e.target.files?.[0] || null)}
              className="mt-1 w-full text-sm"
            />
            <span className="mt-1 block text-[11px] text-neutral-400">
              Without a photo the site shows an initials avatar.
            </span>
          </label>
          <Toggle label="Active" checked={!!form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || !form.name || !form.quote}>
            {saving ? "Saving..." : editing ? "Update" : "Create"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
