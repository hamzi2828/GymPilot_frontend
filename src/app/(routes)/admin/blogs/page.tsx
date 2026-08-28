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
  Toggle,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";

interface Blog {
  _id: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  thumbnail?: string;
  status?: "published" | "draft";
  isFeatured?: boolean;
  views?: number;
}

const BLOGS_API = `${API_BASE}/blogs`;

export default function BlogsAdminPage() {
  const [list, setList] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Blog | null>(null);
  const [form, setForm] = useState<Partial<Blog>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Blog[] }>(BLOGS_API);
      setList(r.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ status: "draft" });
    setOpen(true);
  };

  const openEdit = (b: Blog) => {
    setEditing(b);
    setForm(b);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await apiJson(`${BLOGS_API}/${editing._id}`, "PUT", form);
      } else {
        await apiJson(BLOGS_API, "POST", form);
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
    if (!confirm("Delete this blog?")) return;
    try {
      await apiJson(`${BLOGS_API}/${id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="Blogs"
        actions={
          <PrimaryButton onClick={openCreate}>
            <FiPlus className="w-4 h-4 mr-1.5" /> New Blog
          </PrimaryButton>
        }
      />

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["Title", "Status", "Views", "Featured", "Actions"]}
          rows={list.map((b) => [
            <div key="t" className="font-medium text-neutral-900">{b.title}</div>,
            <Badge key="s" color={b.status === "published" ? "green" : "neutral"}>
              {b.status || "draft"}
            </Badge>,
            b.views ?? 0,
            b.isFeatured ? <Badge color="amber">Featured</Badge> : "—",
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => openEdit(b)}>
                <FiEdit2 className="w-3.5 h-3.5" />
              </SecondaryButton>
              <DangerButton onClick={() => remove(b._id)}>
                <FiTrash2 className="w-3.5 h-3.5" />
              </DangerButton>
            </div>,
          ])}
          empty="No blogs yet."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Blog" : "New Blog"} size="lg">
        <div className="grid grid-cols-1 gap-4">
          <TextField label="Title" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <TextField label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          <TextField label="Thumbnail URL" value={form.thumbnail} onChange={(v) => setForm({ ...form, thumbnail: v })} />
          <TextArea label="Excerpt" value={form.excerpt} onChange={(v) => setForm({ ...form, excerpt: v })} />
          <TextArea label="Content" value={form.content} rows={10} onChange={(v) => setForm({ ...form, content: v })} />
          <div className="flex gap-6">
            <Toggle label="Published" checked={form.status === "published"} onChange={(v) => setForm({ ...form, status: v ? "published" : "draft" })} />
            <Toggle label="Featured" checked={!!form.isFeatured} onChange={(v) => setForm({ ...form, isFeatured: v })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
