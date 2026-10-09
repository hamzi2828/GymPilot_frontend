"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { FiPlus, FiEdit2, FiTrash2, FiMenu } from "react-icons/fi";
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
  useConfirm,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson, apiForm, absoluteUrl } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { LoadError } from "../_ops/lists";
import { directUploadIfLarge } from "../_ops/directUpload";

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
  const { can } = usePermissions();
  const { ask, dialog: confirmDialog } = useConfirm();
  const editable = can("hero-slides", "manage");
  const [list, setList] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HeroSlide | null>(null);
  const [form, setForm] = useState<Partial<HeroSlide>>({});
  const [img, setImg] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: HeroSlide[]; slides?: HeroSlide[] }>(SLIDES_API);
      setList(r.data || r.slides || []);
      setError(null);
    } catch (e) {
      // Said out loud: swallowed, a failed load read as "No hero slides yet".
      setError(e instanceof Error ? e.message : "Could not load hero slides");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      if (img) {
        // Too large for the API: already in storage, so only its URL is sent.
        const uploaded = await directUploadIfLarge("hero-slide", img);
        if (uploaded) fd.append("uploadedImageUrl", uploaded);
        else fd.append("image", img);
      }
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

  const remove = async (slide: HeroSlide) => {
    const answer = await ask({
      title: slide.title ? `Delete the slide "${slide.title}"?` : "Delete this slide?",
      body: "It comes off the home page. This cannot be undone.",
      confirmLabel: "Delete slide",
    });
    if (answer === null) return;
    try {
      await apiJson(`${SLIDES_API}/${slide._id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  // --- Drag-and-drop ordering -------------------------------------------
  // Replaces the manual Order number field: the list order IS the order.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  const persistOrder = async (ordered: HeroSlide[]) => {
    setSavingOrder(true);
    setOrderNotice(null);
    try {
      await apiJson(`${SLIDES_API}/reorder`, "PUT", {
        order: ordered.map((s, i) => ({ id: s._id, order: i })),
      });
      setOrderNotice("Slide order saved.");
    } catch (e) {
      setOrderNotice(e instanceof Error ? e.message : "Could not save the new order.");
      await load(); // fall back to the server's ordering
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
    // Optimistic: reflect the new order immediately, then persist.
    setList(next);
    persistOrder(next);
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
      {confirmDialog}
      <PageHeader
        eyebrow="Content"
        title="Hero Slides"
        actions={
          editable ? (
            <PrimaryButton onClick={openCreate}>
              <FiPlus className="w-4 h-4 mr-1.5" /> New Slide
            </PrimaryButton>
          ) : undefined
        }
      />

      {error && <LoadError message={error} onRetry={load} />}

      {loading ? (
        <Spinner />
      ) : error && !list.length ? null : (
        <div>
          <div className="mb-4 flex items-center gap-3 text-xs text-neutral-500">
            <span>{editable ? "Drag a slide to reorder. The order here is the order on the site." : "The order here is the order on the site."}</span>
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
              <p className="text-sm font-medium text-neutral-900">No hero slides yet</p>
              <p className="mt-1 text-xs text-neutral-500">Add one to control the homepage banner.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {list.map((s, i) => (
                <li
                  key={s._id}
                  draggable={editable}
                  onDragStart={() => setDragIndex(i)}
                  onDragEnter={() => setOverIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                  onDrop={() => handleDrop(i)}
                  className={`flex items-center gap-4 rounded-xl border bg-white p-3 transition-all ${
                    dragIndex === i
                      ? "opacity-40"
                      : overIndex === i
                      ? "border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                      : "border-neutral-200"
                  }`}
                >
                  {editable && (
                    <span
                      className="cursor-grab select-none text-neutral-300 active:cursor-grabbing"
                      title="Drag to reorder"
                      aria-hidden="true"
                    >
                      <FiMenu className="h-4 w-4" />
                    </span>
                  )}

                  <span className="w-6 shrink-0 text-center text-xs font-semibold text-neutral-400">{i + 1}</span>

                  {s.image ? (
                    <Image
                      src={absoluteUrl(s.image)}
                      alt={s.title || ""}
                      width={80}
                      height={48}
                      className="h-12 w-20 shrink-0 rounded-lg object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="h-12 w-20 shrink-0 rounded-lg bg-neutral-100" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-neutral-900">{s.title}</div>
                    <div className="truncate text-xs text-neutral-500">{s.subtitle}</div>
                    {s.ctaText && (
                      <div className="mt-0.5 truncate text-[11px] text-neutral-400">CTA: {s.ctaText}</div>
                    )}
                  </div>

                  <button type="button" onClick={() => toggleActive(s)} disabled={!editable} className="shrink-0 disabled:cursor-default">
                    <Badge color={s.isActive ? "green" : "neutral"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                  </button>

                  {editable && (
                    <div className="flex shrink-0 gap-2">
                      <SecondaryButton onClick={() => openEdit(s)}><FiEdit2 className="h-3.5 w-3.5" /></SecondaryButton>
                      <DangerButton onClick={() => remove(s)}><FiTrash2 className="h-3.5 w-3.5" /></DangerButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Slide" : "New Slide"} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <TextField label="Subtitle" value={form.subtitle} onChange={(v) => setForm({ ...form, subtitle: v })} />
          <TextField label="CTA Text" value={form.ctaText} onChange={(v) => setForm({ ...form, ctaText: v })} />
          <TextField label="CTA Link" value={form.ctaLink} onChange={(v) => setForm({ ...form, ctaLink: v })} />
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
