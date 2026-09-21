"use client";

// Admin → Homepage
//
// Controls everything on the homepage below the hero banner: section order
// (drag), visibility (toggle) and content (per-section editor modal). The
// hero banner itself is managed in /admin/hero-slides and testimonial
// entries in /admin/testimonials — both are linked from here.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  FiEdit2,
  FiMenu,
  FiImage,
  FiMessageSquare,
  FiExternalLink,
  FiPlus,
  FiTrash2,
  FiArrowUp,
  FiArrowDown,
  FiArrowLeft,
  FiArrowRight,
  FiUpload,
  FiVideo,
} from "react-icons/fi";
import {
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  Modal,
  Badge,
  Spinner,
  Card,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson, apiForm, absoluteUrl } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { LoadError } from "../_ops/lists";
import { directUploadIfLarge, uploadLimit, UploadRefused } from "../_ops/directUpload";

const SECTIONS_API = `${API_BASE}/home-sections`;

/** Keep in sync with GALLERY_MAX_PHOTOS in main/services/homeService.ts. */
const GALLERY_MAX_PHOTOS = 12;

// On Vercel a request body over about 4.5 MB is refused before it reaches the
// API, so files over the API's limit go straight to storage instead (see
// _ops/directUpload.ts). Where the server has no storage for that, the API's
// own limit is the most a file can be; a bigger video belongs on a video
// host, linked by URL.

/** Sends one homepage image and resolves to the URL to store. */
async function uploadSectionImage(file: File): Promise<string | undefined> {
  const direct = await directUploadIfLarge("homepage-image", file);
  if (direct) return direct;
  const fd = new FormData();
  fd.append("image", file);
  const r = await apiForm<{ data?: { url?: string } }>(`${SECTIONS_API}/upload`, "POST", fd);
  return r.data?.url;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HomeSection {
  key: string;
  enabled: boolean;
  order: number;
  content: Record<string, unknown>;
}

type SubFieldType = "text" | "textarea" | "number" | "image" | "video";

interface SubField {
  key: string;
  label: string;
  type: SubFieldType;
  hint?: string;
}

type FieldDef =
  | { type: "text" | "textarea" | "number" | "image"; key: string; label: string; hint?: string }
  | { type: "stringList"; key: string; label: string; hint?: string }
  | { type: "objectList"; key: string; label: string; fields: SubField[]; itemName: string; hint?: string }
  | { type: "galleryGroups"; key: string; label: string; hint?: string };

interface SectionMeta {
  title: string;
  summary: string;
  fields: FieldDef[];
  dataNote?: { text: string; href: string; linkLabel: string };
}

const HEADING_HINT = "Wrap a word in *asterisks* to colour it with the theme accent.";

// What the editor shows for each section type.
const SECTION_META: Record<string, SectionMeta> = {
  about: {
    title: "About / Intro",
    summary: "Two-column intro with image, bullet points and progress bars.",
    fields: [
      { type: "text", key: "badge", label: "Eyebrow label" },
      { type: "text", key: "heading", label: "Heading", hint: HEADING_HINT },
      { type: "textarea", key: "description", label: "Description" },
      { type: "stringList", key: "bullets", label: "Bullet points" },
      { type: "text", key: "ctaText", label: "Button text" },
      { type: "text", key: "ctaLink", label: "Button link" },
      { type: "image", key: "image", label: "Centre image" },
      { type: "text", key: "secondHeading", label: "Second heading", hint: HEADING_HINT },
      { type: "textarea", key: "secondDescription", label: "Second description" },
      {
        type: "objectList",
        key: "progress",
        label: "Progress bars",
        itemName: "bar",
        fields: [
          { key: "label", label: "Label", type: "text" },
          { key: "value", label: "Value (0–100)", type: "number" },
        ],
      },
    ],
  },
  stats: {
    title: "Stats Band",
    summary: "Accent-coloured strip with animated counters.",
    fields: [
      {
        type: "objectList",
        key: "items",
        label: "Stats",
        itemName: "stat",
        fields: [
          { key: "value", label: "Value (number counts up)", type: "text" },
          { key: "suffix", label: "Suffix (e.g. +, yrs)", type: "text" },
          { key: "label", label: "Label", type: "text" },
        ],
      },
    ],
  },
  classes: {
    title: "Classes Carousel",
    summary: "Header copy for the classes carousel.",
    dataNote: { text: "The class cards come from", href: "/admin/classes", linkLabel: "Fitness → Classes" },
    fields: [
      { type: "text", key: "badge", label: "Eyebrow label" },
      { type: "text", key: "heading", label: "Heading", hint: HEADING_HINT },
      { type: "textarea", key: "description", label: "Description" },
    ],
  },
  gallery: {
    title: "Gallery",
    summary: "Photo sub-sections (Strength, Cardio, …), 4 per row with a slider.",
    fields: [
      { type: "text", key: "badge", label: "Eyebrow label" },
      { type: "text", key: "heading", label: "Heading", hint: HEADING_HINT },
      {
        type: "galleryGroups",
        key: "groups",
        label: "Photo sub-sections",
        hint: `Visitors pick a sub-section, then see photos 4 per row (2 rows per page — more photos page with a slider). Up to ${GALLERY_MAX_PHOTOS} photos each.`,
      },
    ],
  },
  videos: {
    title: "Videos",
    summary: "Gym video clips on a dark panel.",
    fields: [
      { type: "text", key: "badge", label: "Eyebrow label" },
      { type: "text", key: "heading", label: "Heading", hint: HEADING_HINT },
      { type: "textarea", key: "description", label: "Description" },
      {
        type: "objectList",
        key: "videos",
        label: "Videos",
        itemName: "video",
        fields: [
          { key: "title", label: "Title", type: "text" },
          {
            key: "url",
            label: "Video",
            type: "video",
            hint: "Paste a YouTube/Vimeo link or a direct .mp4 URL, or upload an MP4/WebM file.",
          },
          { key: "poster", label: "Poster image (shown before play)", type: "image" },
        ],
      },
    ],
  },
  trainers: {
    title: "Trainers",
    summary: "Header copy for the trainer cards grid.",
    dataNote: { text: "The trainer cards come from", href: "/admin/trainers", linkLabel: "Fitness → Trainers" },
    fields: [
      { type: "text", key: "badge", label: "Eyebrow label" },
      { type: "text", key: "heading", label: "Heading", hint: HEADING_HINT },
      { type: "textarea", key: "description", label: "Description" },
      { type: "number", key: "limit", label: "How many trainers to show" },
    ],
  },
  testimonials: {
    title: "Testimonials",
    summary: "Member reviews on a dark panel.",
    dataNote: { text: "The reviews come from", href: "/admin/testimonials", linkLabel: "Content → Testimonials" },
    fields: [
      { type: "text", key: "badge", label: "Eyebrow label" },
      { type: "text", key: "heading", label: "Heading", hint: HEADING_HINT },
      { type: "textarea", key: "description", label: "Description" },
    ],
  },
  contact: {
    title: "Contact / Registration",
    summary: "Copy beside the registration form.",
    fields: [
      { type: "text", key: "badge", label: "Eyebrow label" },
      { type: "text", key: "heading", label: "Heading", hint: HEADING_HINT },
      { type: "textarea", key: "description", label: "Description" },
      { type: "text", key: "formTitle", label: "Form title" },
      { type: "text", key: "buttonText", label: "Submit button text" },
    ],
  },
  blogs: {
    title: "Latest Blogs",
    summary: "Header copy for the latest blog posts.",
    dataNote: { text: "The posts come from", href: "/admin/blogs", linkLabel: "Content → Blogs" },
    fields: [
      { type: "text", key: "badge", label: "Eyebrow label" },
      { type: "text", key: "heading", label: "Heading" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Nested path helpers ("highlight.value" → content.highlight.value)
// ---------------------------------------------------------------------------

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) return { ...obj, [head]: value };
  const child = obj[head];
  const childObj = child && typeof child === "object" && !Array.isArray(child) ? (child as Record<string, unknown>) : {};
  return { ...obj, [head]: setPath(childObj, rest.join("."), value) };
}

// ---------------------------------------------------------------------------
// Small editors
// ---------------------------------------------------------------------------

/** URL input + upload button + thumbnail preview, for any image field. */
function ImageInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadSectionImage(file);
      if (url) onChange(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        {value ? (
          <Image
            src={absoluteUrl(value)}
            alt=""
            width={56}
            height={40}
            className="h-10 w-14 shrink-0 rounded-md object-cover border border-neutral-200"
            unoptimized
          />
        ) : (
          <div className="h-10 w-14 shrink-0 rounded-md bg-neutral-100 border border-neutral-200" />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload"
          className="flex-1 h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
        />
        <label className="inline-flex items-center h-9 px-3 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
          <FiUpload className="w-3.5 h-3.5 mr-1.5" />
          {uploading ? "…" : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

/** URL input + video-file upload, for the videos section. */
function VideoInput({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  hint?: string;
  onChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [tooBig, setTooBig] = useState<string | null>(null);
  // The most this server takes, direct uploads included; unknown until asked.
  const [limitMb, setLimitMb] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    uploadLimit("homepage-video").then((bytes) => {
      if (live && bytes) setLimitMb(Math.round(bytes / (1024 * 1024)));
    });
    return () => {
      live = false;
    };
  }, []);

  const upload = async (file: File) => {
    setTooBig(null);
    setUploading(true);
    try {
      const direct = await directUploadIfLarge("homepage-video", file);
      if (direct) {
        onChange(direct);
        return;
      }
      const fd = new FormData();
      fd.append("video", file);
      const r = await apiForm<{ data?: { url?: string } }>(`${SECTIONS_API}/upload-video`, "POST", fd);
      if (r.data?.url) onChange(r.data.url);
    } catch (e) {
      if (e instanceof UploadRefused) {
        setTooBig(`${e.message} Or put it on YouTube or Vimeo (or any video host) and paste the link above instead.`);
      } else {
        alert(e instanceof Error ? e.message : "Video upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 border border-neutral-200 text-neutral-400">
          <FiVideo className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setTooBig(null);
            onChange(e.target.value);
          }}
          placeholder={`https://youtube.com/… or upload an mp4${limitMb ? ` (up to ${limitMb} MB)` : ""}`}
          className="flex-1 h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
        />
        <label className="inline-flex items-center h-9 px-3 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
          <FiUpload className="w-3.5 h-3.5 mr-1.5" />
          {uploading ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {tooBig && <span className="mt-1 block text-[11px] text-rose-600">{tooBig}</span>}
      {hint && <span className="mt-1 block text-[11px] text-neutral-400">{hint}</span>}
    </div>
  );
}

function ListControls({
  index,
  total,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  const btn =
    "p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label="Move up">
        <FiArrowUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className={btn}
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label="Move down"
      >
        <FiArrowDown className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className="p-1.5 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        onClick={() => onRemove(index)}
        aria-label="Remove"
      >
        <FiTrash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function StringListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  const move = (from: number, to: number) => {
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };
  return (
    <div>
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <div className="mt-1 space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
              className="flex-1 h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
            />
            <ListControls index={i} total={items.length} onMove={move} onRemove={(idx) => onChange(items.filter((_, j) => j !== idx))} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <FiPlus className="w-3.5 h-3.5" /> Add item
        </button>
      </div>
    </div>
  );
}

function ObjectListEditor({
  def,
  items,
  onChange,
}: {
  def: Extract<FieldDef, { type: "objectList" }>;
  items: Record<string, unknown>[];
  onChange: (v: Record<string, unknown>[]) => void;
}) {
  const move = (from: number, to: number) => {
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };
  const setItem = (i: number, key: string, value: unknown) =>
    onChange(items.map((item, j) => (j === i ? { ...item, [key]: value } : item)));

  return (
    <div>
      <span className="text-xs font-semibold text-neutral-700">{def.label}</span>
      <div className="mt-1 space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                {def.itemName} {i + 1}
              </span>
              <ListControls index={i} total={items.length} onMove={move} onRemove={(idx) => onChange(items.filter((_, j) => j !== idx))} />
            </div>
            <div className="space-y-2">
              {def.fields.map((f) => {
                const v = item[f.key];
                if (f.type === "image") {
                  return <ImageInput key={f.key} label={f.label} value={typeof v === "string" ? v : ""} onChange={(nv) => setItem(i, f.key, nv)} />;
                }
                if (f.type === "video") {
                  return (
                    <VideoInput
                      key={f.key}
                      label={f.label}
                      hint={f.hint}
                      value={typeof v === "string" ? v : ""}
                      onChange={(nv) => setItem(i, f.key, nv)}
                    />
                  );
                }
                if (f.type === "textarea") {
                  return (
                    <label key={f.key} className="block">
                      <span className="text-xs font-semibold text-neutral-700">{f.label}</span>
                      <textarea
                        value={typeof v === "string" ? v : v === undefined || v === null ? "" : String(v)}
                        rows={2}
                        onChange={(e) => setItem(i, f.key, e.target.value)}
                        className="mt-1 w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors resize-none"
                      />
                    </label>
                  );
                }
                return (
                  <label key={f.key} className="block">
                    <span className="text-xs font-semibold text-neutral-700">{f.label}</span>
                    <input
                      type={f.type === "number" ? "number" : "text"}
                      value={v === undefined || v === null ? "" : String(v)}
                      onChange={(e) => setItem(i, f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                      className="mt-1 w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, Object.fromEntries(def.fields.map((f) => [f.key, f.type === "number" ? 0 : ""]))])}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <FiPlus className="w-3.5 h-3.5" /> Add {def.itemName}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gallery groups editor (photo sub-sections: Strength, Cardio, …)
// ---------------------------------------------------------------------------

interface GalleryImageDraft {
  src?: string;
  alt?: string;
}

interface GalleryGroupDraft {
  title?: string;
  images?: GalleryImageDraft[];
}

function GalleryGroupsEditor({
  label,
  hint,
  groups,
  onChange,
}: {
  label: string;
  hint?: string;
  groups: GalleryGroupDraft[];
  onChange: (v: GalleryGroupDraft[]) => void;
}) {
  const [uploadingGroup, setUploadingGroup] = useState<number | null>(null);
  const [urlDrafts, setUrlDrafts] = useState<Record<number, string>>({});

  const setGroup = (i: number, patch: Partial<GalleryGroupDraft>) =>
    onChange(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  const moveGroup = (from: number, to: number) => {
    const next = [...groups];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };

  const imagesOf = (g: GalleryGroupDraft) => (Array.isArray(g.images) ? g.images : []);

  const addImages = (i: number, urls: string[]) => {
    const current = imagesOf(groups[i]);
    const room = Math.max(0, GALLERY_MAX_PHOTOS - current.length);
    const additions = urls.slice(0, room).map((src) => ({ src, alt: "" }));
    if (additions.length) setGroup(i, { images: [...current, ...additions] });
  };

  const moveImage = (i: number, from: number, to: number) => {
    const imgs = [...imagesOf(groups[i])];
    if (to < 0 || to >= imgs.length) return;
    const [m] = imgs.splice(from, 1);
    imgs.splice(to, 0, m);
    setGroup(i, { images: imgs });
  };

  const removeImage = (i: number, idx: number) =>
    setGroup(i, { images: imagesOf(groups[i]).filter((_, j) => j !== idx) });

  const uploadFiles = async (i: number, files: File[]) => {
    setUploadingGroup(i);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const url = await uploadSectionImage(file);
        if (url) urls.push(url);
      }
      addImages(i, urls);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingGroup(null);
    }
  };

  const thumbBtn =
    "flex-1 flex items-center justify-center py-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 transition-colors";

  return (
    <div>
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      {hint && <span className="mt-0.5 block text-[11px] text-neutral-400">{hint}</span>}

      <div className="mt-2 space-y-4">
        {groups.map((group, i) => {
          const imgs = imagesOf(group);
          const full = imgs.length >= GALLERY_MAX_PHOTOS;
          return (
            <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
              {/* Group header: title + reorder/remove */}
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={group.title ?? ""}
                  onChange={(e) => setGroup(i, { title: e.target.value })}
                  placeholder={`Sub-section name (e.g. ${i % 2 === 0 ? "Strength" : "Cardio"})`}
                  className="flex-1 h-9 px-3 text-sm font-medium bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
                />
                <span className={`shrink-0 text-[11px] font-semibold ${full ? "text-amber-600" : "text-neutral-400"}`}>
                  {imgs.length}/{GALLERY_MAX_PHOTOS}
                </span>
                <ListControls
                  index={i}
                  total={groups.length}
                  onMove={moveGroup}
                  onRemove={(idx) => onChange(groups.filter((_, j) => j !== idx))}
                />
              </div>

              {/* Thumbnails: 4 per row, arrows reorder within the group */}
              {imgs.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {imgs.map((img, idx) => (
                    <div key={idx} className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
                      {img.src ? (
                        <Image
                          src={absoluteUrl(img.src)}
                          alt={img.alt || ""}
                          width={120}
                          height={90}
                          className="h-16 w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-16 w-full bg-neutral-100" />
                      )}
                      <div className="flex divide-x divide-neutral-100 border-t border-neutral-100">
                        <button
                          type="button"
                          className={thumbBtn}
                          disabled={idx === 0}
                          onClick={() => moveImage(i, idx, idx - 1)}
                          aria-label="Move photo left"
                        >
                          <FiArrowLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="flex-1 flex items-center justify-center py-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          onClick={() => removeImage(i, idx)}
                          aria-label="Remove photo"
                        >
                          <FiTrash2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className={thumbBtn}
                          disabled={idx === imgs.length - 1}
                          onClick={() => moveImage(i, idx, idx + 1)}
                          aria-label="Move photo right"
                        >
                          <FiArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Photo adders — hidden once the group is full */}
              {!full && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center h-9 px-3 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
                    <FiUpload className="w-3.5 h-3.5 mr-1.5" />
                    {uploadingGroup === i ? "Uploading…" : "Upload photos"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) uploadFiles(i, files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="flex flex-1 min-w-[220px] items-center gap-2">
                    <input
                      type="text"
                      value={urlDrafts[i] ?? ""}
                      onChange={(e) => setUrlDrafts((d) => ({ ...d, [i]: e.target.value }))}
                      placeholder="…or paste an image URL"
                      className="flex-1 h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
                    />
                    <SecondaryButton
                      onClick={() => {
                        const url = (urlDrafts[i] ?? "").trim();
                        if (!url) return;
                        addImages(i, [url]);
                        setUrlDrafts((d) => ({ ...d, [i]: "" }));
                      }}
                    >
                      Add
                    </SecondaryButton>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => onChange([...groups, { title: "", images: [] }])}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <FiPlus className="w-3.5 h-3.5" /> Add sub-section
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomepageAdminPage() {
  const { can } = usePermissions();
  const editable = can("homepage", "manage");
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HomeSection | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: HomeSection[] }>(SECTIONS_API);
      setSections(r.data || []);
      setError(null);
    } catch (e) {
      // Said out loud: swallowed, a failed load showed an empty section list.
      setError(e instanceof Error ? e.message : "Could not load the homepage sections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (s: HomeSection) => {
    setEditing(s);
    setDraft(JSON.parse(JSON.stringify(s.content || {})));
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiJson(`${SECTIONS_API}/${editing.key}`, "PUT", { content: draft });
      setEditing(null);
      setNotice(`"${SECTION_META[editing.key]?.title || editing.key}" saved. The homepage updates on next load.`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s: HomeSection) => {
    try {
      await apiJson(`${SECTIONS_API}/${s.key}/status`, "PATCH");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  // --- Drag-and-drop ordering --------------------------------------------
  // Dropping only STAGES the new order locally; nothing is saved until the
  // admin clicks "Update order" (or discards the change).
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savedOrder, setSavedOrder] = useState<HomeSection[]>([]);

  const handleDrop = (target: number) => {
    setOverIndex(null);
    const from = dragIndex;
    setDragIndex(null);
    if (from === null || from === target) return;
    if (!orderDirty) setSavedOrder(sections); // remember what to fall back to
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    setSections(next);
    setOrderDirty(true);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      await apiJson(`${SECTIONS_API}/reorder`, "PUT", {
        order: sections.map((s, i) => ({ key: s.key, order: i + 1 })),
      });
      setOrderDirty(false);
      setNotice("Section order updated.");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not save the new order.");
    } finally {
      setSavingOrder(false);
    }
  };

  const discardOrder = () => {
    setSections(savedOrder);
    setOrderDirty(false);
  };

  const meta = editing ? SECTION_META[editing.key] : null;

  return (
    <div>
      <PageHeader eyebrow="Content" title="Homepage" />

      {/* Where the rest of the homepage lives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
              <FiImage className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">Hero banner</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                The top slider is managed separately, slide by slide.
              </p>
              <Link
                href="/admin/hero-slides"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-dark)] hover:underline"
              >
                Manage hero slides <FiExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
              <FiMessageSquare className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">Testimonials</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Member reviews shown in the testimonials section.
              </p>
              <Link
                href="/admin/testimonials"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-dark)] hover:underline"
              >
                Manage testimonials <FiExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {error && <LoadError message={error} onRetry={load} />}

      {loading ? (
        <Spinner />
      ) : error && !sections.length ? null : (
        <div>
          <div className="mb-4 flex items-center gap-3 text-xs text-neutral-500">
            {editable ? (
              <span>
                Drag a section to reorder — the order here is the order on the homepage, below the hero banner. Nothing
                is saved until you press <span className="font-semibold text-neutral-700">Update order</span>.
              </span>
            ) : (
              <span>The order here is the order on the homepage, below the hero banner.</span>
            )}
          </div>

          {orderDirty && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,white)] px-4 py-3">
              <span className="text-sm font-medium text-neutral-800">
                Section order changed — it is not live yet.
              </span>
              <div className="flex items-center gap-2">
                <SecondaryButton onClick={discardOrder} disabled={savingOrder}>
                  Discard
                </SecondaryButton>
                <PrimaryButton onClick={saveOrder} disabled={savingOrder}>
                  {savingOrder ? "Saving…" : "Update order"}
                </PrimaryButton>
              </div>
            </div>
          )}

          {notice && (
            <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          <ul className="space-y-2">
            {sections.map((s, i) => {
              const m = SECTION_META[s.key];
              const heading =
                typeof s.content?.heading === "string" && s.content.heading
                  ? (s.content.heading as string).replace(/\*/g, "")
                  : undefined;
              return (
                <li
                  key={s.key}
                  draggable={editable}
                  onDragStart={() => setDragIndex(i)}
                  onDragEnter={() => setOverIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onDrop={() => handleDrop(i)}
                  className={`flex items-center gap-4 rounded-xl border bg-white p-4 transition-all ${
                    dragIndex === i
                      ? "opacity-40"
                      : overIndex === i
                      ? "border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                      : "border-neutral-200"
                  } ${s.enabled ? "" : "bg-neutral-50/70"}`}
                >
                  {editable && (
                    <span className="cursor-grab select-none text-neutral-300 active:cursor-grabbing" title="Drag to reorder" aria-hidden="true">
                      <FiMenu className="h-4 w-4" />
                    </span>
                  )}

                  <span className="w-6 shrink-0 text-center text-xs font-semibold text-neutral-400">{i + 1}</span>

                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-semibold ${s.enabled ? "text-neutral-900" : "text-neutral-400"}`}>
                      {m?.title || s.key}
                    </div>
                    <div className="truncate text-xs text-neutral-500">{heading || m?.summary}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    className="shrink-0 disabled:opacity-40"
                    title={!editable ? undefined : orderDirty ? "Save or discard the new order first" : "Click to toggle visibility"}
                    disabled={!editable || orderDirty}
                  >
                    <Badge color={s.enabled ? "green" : "neutral"}>{s.enabled ? "Visible" : "Hidden"}</Badge>
                  </button>

                  {editable && (
                    <SecondaryButton onClick={() => openEdit(s)} disabled={orderDirty}>
                      <FiEdit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </SecondaryButton>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={meta ? `Edit — ${meta.title}` : "Edit section"}
        size="lg"
      >
        {meta?.dataNote && (
          <div className="mb-4 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            {meta.dataNote.text}{" "}
            <Link href={meta.dataNote.href} className="font-semibold underline">
              {meta.dataNote.linkLabel}
            </Link>
            . Only the header copy is edited here.
          </div>
        )}

        <div className="space-y-4">
          {meta?.fields.map((f) => {
            const raw = getPath(draft, f.key);
            if (f.type === "stringList") {
              const items = Array.isArray(raw) ? raw.map((v) => (typeof v === "string" ? v : String(v ?? ""))) : [];
              return <StringListEditor key={f.key} label={f.label} items={items} onChange={(v) => setDraft((d) => setPath(d, f.key, v))} />;
            }
            if (f.type === "objectList") {
              const items = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
              return <ObjectListEditor key={f.key} def={f} items={items} onChange={(v) => setDraft((d) => setPath(d, f.key, v))} />;
            }
            if (f.type === "galleryGroups") {
              const items = Array.isArray(raw) ? (raw as GalleryGroupDraft[]) : [];
              return (
                <GalleryGroupsEditor
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  groups={items}
                  onChange={(v) => setDraft((d) => setPath(d, f.key, v))}
                />
              );
            }
            if (f.type === "image") {
              return (
                <ImageInput
                  key={f.key}
                  label={f.label}
                  value={typeof raw === "string" ? raw : ""}
                  onChange={(v) => setDraft((d) => setPath(d, f.key, v))}
                />
              );
            }
            if (f.type === "textarea") {
              return (
                <label key={f.key} className="block">
                  <span className="text-xs font-semibold text-neutral-700">{f.label}</span>
                  <textarea
                    value={raw === undefined || raw === null ? "" : String(raw)}
                    rows={3}
                    onChange={(e) => setDraft((d) => setPath(d, f.key, e.target.value))}
                    className="mt-1 w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors resize-none"
                  />
                  {f.hint && <span className="mt-1 block text-[11px] text-neutral-400">{f.hint}</span>}
                </label>
              );
            }
            return (
              <label key={f.key} className="block">
                <span className="text-xs font-semibold text-neutral-700">{f.label}</span>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={raw === undefined || raw === null ? "" : String(raw)}
                  onChange={(e) => setDraft((d) => setPath(d, f.key, f.type === "number" ? Number(e.target.value) : e.target.value))}
                  className="mt-1 w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors"
                />
                {f.hint && <span className="mt-1 block text-[11px] text-neutral-400">{f.hint}</span>}
              </label>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <SecondaryButton onClick={() => setEditing(null)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save section"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
