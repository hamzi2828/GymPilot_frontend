"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiTag } from "react-icons/fi";
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
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { Pager, LoadError, pageCount } from "../_ops/lists";

interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface Blog {
  _id: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  thumbnail?: string;
  status?: "published" | "draft";
  // The model's field. The list used to read `isFeatured`, which the API
  // never returns, so every post showed as not featured.
  featured?: boolean;
  views?: number;
  // An id on write; the list hands it back populated.
  categoryId?: string | { _id: string; name?: string } | null;
  categoryName?: string;
}

type BlogForm = {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  thumbnail?: string;
  status?: "published" | "draft";
  featured?: boolean;
  categoryId?: string;
};

const BLOGS_API = `${API_BASE}/blogs`;
const CATEGORIES_API = `${API_BASE}/admin/blogs/categories`;
const PAGE_SIZE = 20;

const categoryIdOf = (b: Blog) => (b.categoryId && typeof b.categoryId === "object" ? b.categoryId._id : b.categoryId || "");

export default function BlogsAdminPage() {
  const { can } = usePermissions();
  const { ask, dialog: confirmDialog } = useConfirm();
  const editable = can("blogs", "manage");
  const [list, setList] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Blog | null>(null);
  const [form, setForm] = useState<BlogForm>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);

  // Paged: the endpoint returns ten at a time, and reading only the first
  // page used to hide every older post.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Blog[]; pagination?: { total?: number; pages?: number; limit?: number } }>(
        `${BLOGS_API}?page=${page}&limit=${PAGE_SIZE}`
      );
      // Deleting the last post on the last page leaves nothing to show.
      if (!(r.data || []).length && page > 1) {
        setPage(page - 1);
        return;
      }
      setList(r.data || []);
      setPages(pageCount(r.pagination));
      setTotal(r.pagination?.total ?? (r.data || []).length);
      setError(null);
    } catch (e) {
      // Said out loud: swallowed, a failed load read as "No blogs yet".
      setError(e instanceof Error ? e.message : "Could not load blog posts");
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadCategories = useCallback(async () => {
    try {
      const r = await apiGet<{ data: Category[] }>(CATEGORIES_API);
      setCategories(r.data || []);
      setCategoryError(null);
    } catch (e) {
      setCategoryError(e instanceof Error ? e.message : "Could not load categories");
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const openCreate = () => {
    setEditing(null);
    // A post needs a category; start on the first one rather than on nothing.
    setForm({ status: "draft", featured: false, categoryId: categories[0]?._id || "" });
    setOpen(true);
  };

  const openEdit = (b: Blog) => {
    setEditing(b);
    setForm({
      title: b.title,
      slug: b.slug,
      excerpt: b.excerpt,
      content: b.content,
      thumbnail: b.thumbnail,
      status: b.status || "draft",
      featured: !!b.featured,
      categoryId: categoryIdOf(b),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title?.trim() || !form.content?.trim() || !form.categoryId) {
      alert("A post needs a title, some content and a category.");
      return;
    }
    setSaving(true);
    try {
      // Only the fields this form edits. The list rows carry populated and
      // computed extras (author, reading time) that are not the API's input.
      const payload = {
        title: form.title,
        slug: form.slug || undefined,
        excerpt: form.excerpt ?? "",
        content: form.content,
        thumbnail: form.thumbnail ?? "",
        status: form.status || "draft",
        featured: !!form.featured,
        categoryId: form.categoryId,
      };
      if (editing) {
        await apiJson(`${BLOGS_API}/${editing._id}`, "PUT", payload);
      } else {
        await apiJson(BLOGS_API, "POST", payload);
      }
      setOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: Blog) => {
    const answer = await ask({ title: `Delete "${b.title}"?`, body: "The post is taken off the website and deleted. This cannot be undone.", confirmLabel: "Delete post" });
    if (answer === null) return;
    try {
      await apiJson(`${BLOGS_API}/${b._id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  // Publish or pull a post without opening the editor.
  const toggleStatus = async (b: Blog) => {
    setBusyId(b._id);
    try {
      await apiJson(`${BLOGS_API}/${b._id}/status`, "PATCH", { status: b.status === "published" ? "draft" : "published" });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not change the status");
    } finally {
      setBusyId(null);
    }
  };

  // --- Categories -------------------------------------------------------
  const categoryCall = async (fn: () => Promise<unknown>) => {
    setCategoryBusy(true);
    setCategoryError(null);
    try {
      await fn();
      await loadCategories();
      return true;
    } catch (e) {
      setCategoryError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setCategoryBusy(false);
    }
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    if (await categoryCall(() => apiJson(CATEGORIES_API, "POST", { name }))) setNewCategory("");
  };

  const renameCategory = async () => {
    if (!renaming || !renaming.name.trim()) return;
    if (await categoryCall(() => apiJson(`${CATEGORIES_API}/${renaming.id}`, "PUT", { name: renaming.name.trim() }))) {
      setRenaming(null);
      // Rows show the category name they were loaded with.
      await load();
    }
  };

  const deleteCategory = async (c: Category) => {
    const answer = await ask({ title: `Delete the category "${c.name}"?`, body: "This cannot be undone.", confirmLabel: "Delete category" });
    if (answer === null) return;
    await categoryCall(() => apiJson(`${CATEGORIES_API}/${c._id}`, "DELETE"));
  };

  const categoryName = (b: Blog) =>
    b.categoryName || (b.categoryId && typeof b.categoryId === "object" ? b.categoryId.name : "") || categories.find((c) => c._id === b.categoryId)?.name || "—";

  return (
    <div>
      {confirmDialog}
      <PageHeader
        eyebrow="Content"
        title="Blogs"
        actions={
          editable ? (
            <>
              <SecondaryButton onClick={() => { setCategoryError(null); setCategoriesOpen(true); }}>
                <FiTag className="w-3.5 h-3.5 mr-1.5" /> Categories
              </SecondaryButton>
              <PrimaryButton onClick={openCreate}>
                <FiPlus className="w-4 h-4 mr-1.5" /> New Blog
              </PrimaryButton>
            </>
          ) : undefined
        }
      />

      {error && <LoadError message={error} onRetry={load} />}

      {loading ? (
        <Spinner />
      ) : error && !list.length ? null : (
        <Table
          columns={["Title", "Category", "Status", "Views", "Featured", "Actions"]}
          rows={list.map((b) => [
            <div key="t" className="font-medium text-neutral-900">{b.title}</div>,
            <span key="c" className="text-xs text-neutral-600">{categoryName(b)}</span>,
            <button
              key="s"
              type="button"
              onClick={() => toggleStatus(b)}
              disabled={!editable || busyId === b._id}
              title={editable ? (b.status === "published" ? "Click to unpublish" : "Click to publish") : undefined}
              className="disabled:cursor-default"
            >
              <Badge color={b.status === "published" ? "green" : "neutral"}>
                {b.status || "draft"}
              </Badge>
            </button>,
            b.views ?? 0,
            b.featured ? <Badge color="amber">Featured</Badge> : "—",
            editable ? (
              <div key="a" className="flex gap-2">
                <SecondaryButton onClick={() => openEdit(b)} label={`Edit ${b.title}`}>
                  <FiEdit2 className="w-3.5 h-3.5" />
                </SecondaryButton>
                <DangerButton onClick={() => remove(b)} label={`Delete ${b.title}`}>
                  <FiTrash2 className="w-3.5 h-3.5" />
                </DangerButton>
              </div>
            ) : (
              <span key="a" />
            ),
          ])}
          empty="No blogs yet."
        />
      )}

      <Pager page={page} pages={pages} total={total} onChange={setPage} disabled={loading} />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Blog" : "New Blog"} size="lg">
        <div className="grid grid-cols-1 gap-4">
          <TextField label="Title" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <SelectField
                label="Category *"
                value={form.categoryId}
                allowClear={false}
                onChange={(v) => setForm({ ...form, categoryId: v })}
                placeholder={categories.length ? "Choose a category" : "No categories yet"}
                options={categories.map((c) => ({ value: c._id, label: c.name }))}
              />
              {categoryError && !categoriesOpen && <p className="mt-1 text-[12px] text-rose-600">{categoryError}</p>}
              {!categories.length && !categoryError && (
                <button
                  type="button"
                  onClick={() => { setCategoryError(null); setCategoriesOpen(true); }}
                  className="mt-1 text-[12px] font-semibold text-neutral-600 underline hover:text-neutral-900"
                >
                  Add a category first
                </button>
              )}
            </div>
            <TextField label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          </div>
          <TextField label="Thumbnail URL" value={form.thumbnail} onChange={(v) => setForm({ ...form, thumbnail: v })} />
          <TextArea label="Excerpt" value={form.excerpt} onChange={(v) => setForm({ ...form, excerpt: v })} />
          <TextArea label="Content *" value={form.content} rows={10} onChange={(v) => setForm({ ...form, content: v })} />
          <div className="flex gap-6">
            <Toggle label="Published" checked={form.status === "published"} onChange={(v) => setForm({ ...form, status: v ? "published" : "draft" })} />
            <Toggle label="Featured" checked={!!form.featured} onChange={(v) => setForm({ ...form, featured: v })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</PrimaryButton>
        </div>
      </Modal>

      <Modal open={categoriesOpen} onClose={() => { setCategoriesOpen(false); setRenaming(null); }} title="Blog categories" size="md">
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">Every post sits in one category. A category still holding posts cannot be deleted — move them first.</p>
          <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {categories.map((c) => (
              <div key={c._id} className="flex items-center gap-2 px-3 py-2">
                {renaming?.id === c._id ? (
                  <>
                    <input
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: c._id, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") renameCategory(); }}
                      className="h-8 flex-1 rounded-lg border border-neutral-200 px-2.5 text-sm focus:border-[var(--accent)] focus:outline-none"
                      autoFocus
                    />
                    <PrimaryButton onClick={renameCategory} disabled={categoryBusy || !renaming.name.trim()}>Save</PrimaryButton>
                    <SecondaryButton onClick={() => setRenaming(null)} disabled={categoryBusy}>Cancel</SecondaryButton>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-neutral-900">
                      {c.name} <span className="text-xs text-neutral-400">/{c.slug}</span>
                    </span>
                    <SecondaryButton onClick={() => setRenaming({ id: c._id, name: c.name })} disabled={categoryBusy} label={`Rename the category ${c.name}`}>
                      <FiEdit2 className="w-3.5 h-3.5" />
                    </SecondaryButton>
                    <DangerButton onClick={() => deleteCategory(c)} disabled={categoryBusy} label={`Delete the category ${c.name}`}>
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </DangerButton>
                  </>
                )}
              </div>
            ))}
            {!categories.length && <p className="px-3 py-4 text-center text-sm text-neutral-500">No categories yet.</p>}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextField label="New category" value={newCategory} onChange={setNewCategory} placeholder="Training tips, Nutrition, Gym news…" />
            </div>
            <PrimaryButton onClick={addCategory} disabled={categoryBusy || !newCategory.trim()}>Add</PrimaryButton>
          </div>
          {categoryError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{categoryError}</p>}
        </div>
      </Modal>
    </div>
  );
}
