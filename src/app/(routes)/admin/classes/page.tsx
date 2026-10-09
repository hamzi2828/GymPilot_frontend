"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
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
  useConfirm,
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson, apiForm, absoluteUrl, replaceParams } from "../_shared/api";
import {
  WeekScheduleEditor,
  validateSchedule,
  type ScheduleRow,
  type InstructorOption,
} from "../_shared/WeekScheduleEditor";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { Pager, LoadError, pageCount } from "../_ops/lists";

const PAGE_SIZE = 20;
// Enough for any gym's trainer list in one dropdown. The trainers endpoint
// defaults to twenty, which quietly left later trainers out of the picker.
const ALL_TRAINERS = 500;

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
  room?: string;
  category?: string;
  price?: number;
  isActive: boolean;
  isFeatured?: boolean;
  /**
   * The weekly template this class runs to. Bookable sessions are expanded
   * from it on the server, so a class with an empty schedule cannot be booked
   * at all — which is why this is now editable here.
   */
  schedule?: ScheduleRow[];
}

const difficulties = ["Beginner", "Intermediate", "Advanced", "All Levels"];
const categories = ["Yoga", "Cardio", "Strength", "Boxing", "HIIT", "Dance", "Martial Arts", "Other"];

function ClassesAdminPageInner() {
  const { can } = usePermissions();
  const { ask, dialog: confirmDialog } = useConfirm();
  const editable = can("classes", "manage");
  // The address can name a class to open (?id=, from the header search),
  // read again whenever it changes.
  const urlId = useSearchParams().get("id");
  const [list, setList] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // What the server said a change did (bookings cancelled, members told).
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GymClass | null>(null);
  const [form, setForm] = useState<Partial<GymClass>>({});
  const [thumb, setThumb] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [trainers, setTrainers] = useState<InstructorOption[]>([]);

  // Paged: the endpoint returns twenty at a time, and reading only the first
  // page used to make every class after the twentieth vanish from here.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: GymClass[]; pagination?: { total?: number; pages?: number; limit?: number } }>(
        `${GYMFOLIO_API}/gym-classes?page=${page}&limit=${PAGE_SIZE}`
      );
      // Deleting the last class on the last page leaves nothing to show.
      if (!(r.data || []).length && page > 1) {
        setPage(page - 1);
        return;
      }
      setList(r.data || []);
      setPages(pageCount(r.pagination));
      setTotal(r.pagination?.total ?? (r.data || []).length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load classes");
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Instructors for the per-session dropdown. Someone with the Classes tab
  // but not the Trainers one falls back to the public list of active
  // trainers. A failure here costs the dropdown, not the page.
  useEffect(() => {
    if (!editable) return;
    apiGet<{ data: InstructorOption[] }>(`${GYMFOLIO_API}/trainers?limit=${ALL_TRAINERS}`)
      .catch(() => apiGet<{ data: InstructorOption[] }>(`${GYMFOLIO_API}/trainers/active`))
      .then((r) => setTrainers(r.data || []))
      .catch(() => setTrainers([]));
  }, [editable]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ isActive: true, difficulty: "All Levels", category: "Other", capacity: 20 });
    setSchedule([]);
    setThumb(null);
    setOpen(true);
  };

  const openEdit = (c: GymClass) => {
    setEditing(c);
    setForm(c);
    // The API populates `instructor` into an object; the editor works in ids.
    setSchedule(
      (c.schedule || []).map((row) => ({
        day: row.day,
        startTime: row.startTime,
        endTime: row.endTime,
        instructor:
          typeof row.instructor === "object" && row.instructor
            ? (row.instructor as { _id: string })._id
            : row.instructor || null,
        instructorName: row.instructorName || "",
      }))
    );
    setThumb(null);
    setOpen(true);
  };

  // Fetched on its own, as it need not be on the page shown, and then dropped
  // from the address: closing the editor is final, and the same link
  // followed again opens it again. The editor is the only view of one
  // class, so without the manage permission the link just lands on the list.
  useEffect(() => {
    if (!urlId) return;
    replaceParams({ id: null });
    if (!editable) return;
    apiGet<{ data?: GymClass }>(`${GYMFOLIO_API}/gym-classes/${encodeURIComponent(urlId)}`)
      .then((r) => {
        if (r.data) openEdit(r.data);
      })
      .catch((e) => alert(e instanceof Error ? e.message : "Could not open that class"));
  }, [urlId, editable]);

  const save = async () => {
    const problems = validateSchedule(schedule);
    if (problems.length) {
      alert(["Fix the timetable first:", ...problems].join("\n"));
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        // Sent as JSON below; String(array) would post "[object Object]".
        if (k === "schedule") return;
        if (v === undefined || v === null) return;
        if (typeof v === "boolean") fd.append(k, String(v));
        else fd.append(k, String(v));
      });
      // Always sent, so clearing every row really does clear the timetable.
      fd.append(
        "schedule",
        JSON.stringify(
          schedule.map((row) => ({
            day: row.day,
            startTime: row.startTime,
            endTime: row.endTime,
            instructor: row.instructor || undefined,
            instructorName: row.instructorName || "",
          }))
        )
      );
      if (thumb) fd.append("thumbnail", thumb);
      if (editing) {
        // An edit that takes the class off the timetable cancels its upcoming
        // bookings; the server's message says how many.
        const res = await apiForm<{ message?: string; cancelled_bookings?: number }>(`${GYMFOLIO_API}/gym-classes/${editing._id}`, "PUT", fd);
        setNotice(res.cancelled_bookings ? res.message || null : null);
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

  const remove = async (c: GymClass) => {
    const answer = await ask({
      title: `Delete ${c.name}?`,
      body: "The class comes off the timetable and the website. Upcoming bookings for it are cancelled, any credits are returned, and the members are told. This cannot be undone.",
      confirmLabel: "Delete class",
    });
    if (answer === null) return;
    try {
      const res = await apiJson<{ message?: string }>(`${GYMFOLIO_API}/gym-classes/${c._id}`, "DELETE");
      setNotice(res.message || `${c.name} was deleted.`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleActive = async (c: GymClass) => {
    // Switching a class back on needs no question; switching it off does.
    if (c.isActive) {
      const answer = await ask({
        title: `Deactivate ${c.name}?`,
        body: "The class comes off the timetable until you activate it again. Upcoming bookings for it are cancelled, any credits are returned, and the members are told.",
        confirmLabel: "Deactivate class",
      });
      if (answer === null) return;
    }
    try {
      const res = await apiJson<{ message?: string }>(`${GYMFOLIO_API}/gym-classes/${c._id}/toggle-active`, "PATCH");
      setNotice(res.message || null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  return (
    <div>
      {confirmDialog}
      <PageHeader
        eyebrow="Fitness"
        title="Classes"
        actions={
          editable ? (
            <PrimaryButton onClick={openCreate}>
              <FiPlus className="w-4 h-4 mr-1.5" /> New Class
            </PrimaryButton>
          ) : undefined
        }
      />

      {notice && (
        <div role="status" className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {error && <LoadError message={error} onRetry={load} />}

      {loading ? (
        <Spinner />
      ) : error && !list.length ? null : (
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
            <button key="b" onClick={() => toggleActive(c)} disabled={!editable} className="disabled:cursor-default">
              <Badge color={c.isActive ? "green" : "neutral"}>
                {c.isActive ? "Active" : "Inactive"}
              </Badge>
            </button>,
            editable ? (
              <div key="a" className="flex gap-2">
                <SecondaryButton onClick={() => openEdit(c)}>
                  <FiEdit2 className="w-3.5 h-3.5" />
                </SecondaryButton>
                <DangerButton onClick={() => remove(c)}>
                  <FiTrash2 className="w-3.5 h-3.5" />
                </DangerButton>
              </div>
            ) : (
              <span key="a" />
            ),
          ])}
          empty={editable ? "No classes yet — click 'New Class' to add one." : "No classes yet."}
        />
      )}

      <Pager page={page} pages={pages} total={total} onChange={setPage} disabled={loading} />

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
          <TextField label="Room / studio" value={form.room ?? ""} onChange={(v) => setForm({ ...form, room: v })} placeholder="Studio A" />
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
          <div className="md:col-span-2 border-t border-neutral-200 pt-4">
            <h3 className="text-sm font-semibold text-neutral-900">Weekly timetable</h3>
            <p className="mb-3 mt-1 text-[12px] text-neutral-500">
              When this class runs each week. Members book against these times, so a
              class with nothing here cannot be booked. Capacity is {form.capacity ?? 0}{" "}
              per session.
            </p>
            <WeekScheduleEditor
              rows={schedule}
              onChange={setSchedule}
              withInstructor
              instructors={trainers}
              addLabel="Add a session"
              emptyHint="No sessions yet — add one so members can book this class."
            />
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

export default function ClassesAdminPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <ClassesAdminPageInner />
    </Suspense>
  );
}
