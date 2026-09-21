"use client";

import { useCallback, useEffect, useState } from "react";
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
  SelectField,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson, apiForm, absoluteUrl } from "../_shared/api";
import {
  WeekScheduleEditor,
  validateSchedule,
  type ScheduleRow,
} from "../_shared/WeekScheduleEditor";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { useMemberSearch } from "../_ops/MemberPicker";
import { Pager, LoadError, pageCount } from "../_ops/lists";

const PAGE_SIZE = 20;

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
  /**
   * The staff account this profile belongs to, when the trainer is also
   * employed here. Attendance files a trainer's punches against the trainer
   * record, so without this link their hours never reach the payroll figure
   * on the Accounts screen.
   */
  userId?: string | null;
  /**
   * The shifts this trainer is rostered for. The front-desk attendance app
   * judges their check-in against this — early, on time, late — so a trainer
   * with nothing here always comes out as "no schedule".
   */
  availability?: ScheduleRow[];
  /** Personal training: bookable one-to-one, the per-session rate, their cut. */
  acceptsPt?: boolean;
  ptRate?: number;
  commissionPercent?: number | null;
}

export default function TrainersAdminPage() {
  const { can } = usePermissions();
  const editable = can("trainers", "manage");
  const [list, setList] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trainer | null>(null);
  const [form, setForm] = useState<Partial<Trainer>>({});
  const [img, setImg] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<ScheduleRow[]>([]);

  // Paged: the endpoint returns twenty at a time, and reading only the first
  // page used to make every trainer after the twentieth vanish from here.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Trainer[]; pagination?: { total?: number; pages?: number; limit?: number } }>(
        `${GYMFOLIO_API}/trainers?page=${page}&limit=${PAGE_SIZE}`
      );
      // Deleting the last trainer on the last page leaves nothing to show.
      if (!(r.data || []).length && page > 1) {
        setPage(page - 1);
        return;
      }
      setList(r.data || []);
      setPages(pageCount(r.pagination));
      setTotal(r.pagination?.total ?? (r.data || []).length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load trainers");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  // Staff accounts available to link a trainer to, from the staff-readable
  // picker endpoint rather than the whole user list (which needs the Users
  // tab). Only fetched for someone who can edit; a failure here only costs
  // the dropdown, so it must not break the page.
  const { results: staff } = useMemberSearch("", { type: "staff", limit: 50, enabled: editable });

  const openCreate = () => {
    setEditing(null);
    setForm({ isActive: true });
    setAvailability([]);
    setImg(null);
    setOpen(true);
  };

  const openEdit = (t: Trainer) => {
    setEditing(t);
    setForm(t);
    setAvailability(
      (t.availability || []).map((row) => ({
        day: row.day,
        startTime: row.startTime,
        endTime: row.endTime,
      }))
    );
    setImg(null);
    setOpen(true);
  };

  const save = async () => {
    const problems = validateSchedule(availability);
    if (problems.length) {
      alert(["Fix the roster first:", ...problems].join("\n"));
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        // userId is handled below: it is the one field whose null is
        // meaningful, and skipping it here would make "unlink" impossible.
        if (k === "userId") return;
        // Same for the commission: blank means "use the gym's default".
        if (k === "commissionPercent") return;
        // Sent as JSON below.
        if (k === "availability") return;
        if (v === undefined || v === null) return;
        if (typeof v === "object") return;
        fd.append(k, String(v));
      });
      // Always sent, empty when unlinked. The general rule above drops nulls,
      // so without this an admin could link a trainer to a staff account but
      // never undo it -- the field simply would not be in the request, and the
      // server would keep whatever it had.
      fd.append("userId", form.userId || "");
      fd.append("commissionPercent", form.commissionPercent === null || form.commissionPercent === undefined ? "" : String(form.commissionPercent));
      // Always sent, so clearing every shift really clears the roster.
      fd.append(
        "availability",
        JSON.stringify(
          availability.map((row) => ({
            day: row.day,
            startTime: row.startTime,
            endTime: row.endTime,
          }))
        )
      );
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
          editable ? (
            <PrimaryButton onClick={openCreate}>
              <FiPlus className="w-4 h-4 mr-1.5" /> New Trainer
            </PrimaryButton>
          ) : undefined
        }
      />

      {error && <LoadError message={error} onRetry={load} />}

      {loading ? (
        <Spinner />
      ) : error && !list.length ? null : (
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
            <button key="b" onClick={() => toggleActive(t)} disabled={!editable} className="disabled:cursor-default">
              <Badge color={t.isActive ? "green" : "neutral"}>
                {t.isActive ? "Active" : "Inactive"}
              </Badge>
            </button>,
            editable ? (
              <div key="a" className="flex gap-2">
                <SecondaryButton onClick={() => openEdit(t)}>
                  <FiEdit2 className="w-3.5 h-3.5" />
                </SecondaryButton>
                <DangerButton onClick={() => remove(t._id)}>
                  <FiTrash2 className="w-3.5 h-3.5" />
                </DangerButton>
              </div>
            ) : (
              <span key="a" />
            ),
          ])}
          empty={editable ? "No trainers yet — click 'New Trainer' to add one." : "No trainers yet."}
        />
      )}

      <Pager page={page} pages={pages} total={total} onChange={setPage} disabled={loading} />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Trainer" : "New Trainer"} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <TextField label="Role" required value={form.role} onChange={(v) => setForm({ ...form, role: v })} />
          <TextField label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          <TextField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <TextField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <TextField label="Experience (years)" type="number" value={form.experience} onChange={(v) => setForm({ ...form, experience: Number(v) })} />
          <TextField label="PT rate per session (0 = pack only)" type="number" value={form.ptRate ?? 0} onChange={(v) => setForm({ ...form, ptRate: Number(v) || 0 })} />
          <TextField label="PT commission % (blank = gym default)" type="number" value={form.commissionPercent ?? ""} onChange={(v) => setForm({ ...form, commissionPercent: v === "" ? null : Number(v) })} />
          <Toggle label="Takes personal training bookings" checked={form.acceptsPt !== false} onChange={(v) => setForm({ ...form, acceptsPt: v })} />
          <div className="md:col-span-2">
            <SelectField
              label="Staff account (for payroll)"
              value={form.userId || ""}
              onChange={(v) => setForm({ ...form, userId: v || null })}
              placeholder="Not on the payroll"
              options={staff.map((u) => ({
                value: u.id,
                label: `${u.name}${u.job_title ? ` — ${u.job_title}` : ""}`,
                hint: u.email,
              }))}
            />
            <p className="mt-1 text-[12px] text-neutral-500">
              Link a trainer to their staff account and the hours they clock at the
              front desk count towards the wage bill on Accounts. Leave empty for a
              visiting or self-employed coach.
            </p>
          </div>
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
          <div className="md:col-span-2 border-t border-neutral-200 pt-4">
            <h3 className="text-sm font-semibold text-neutral-900">Weekly roster</h3>
            <p className="mb-3 mt-1 text-[12px] text-neutral-500">
              The shifts this trainer is expected for. The front-desk app judges their
              check-in against these times — without a roster every punch reads as
              &ldquo;no schedule&rdquo;.
            </p>
            <WeekScheduleEditor
              rows={availability}
              onChange={setAvailability}
              addLabel="Add a shift"
              emptyHint="No shifts set — attendance will not report early, on time or late."
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
