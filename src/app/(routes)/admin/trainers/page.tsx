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
  Toggle,
  SelectField,
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
  /**
   * Their cut of a completed session: a percent of what it was worth, or a
   * fixed amount per session. null = the gym's default percent.
   */
  commissionType?: "percent" | "amount" | null;
  commissionValue?: number | null;
  /**
   * Salary per pay cycle, used while the trainer has no staff account (a
   * linked one is paid by the account's pay rate). null = not set; 0 =
   * commission only. Only the admin list returns it.
   */
  salary?: number | null;
  salaryCycle?: "monthly" | "biweekly" | "weekly";
}

const CYCLE_LABEL: Record<string, string> = { monthly: "month", biweekly: "fortnight", weekly: "week" };

// "31,000 / month · 500 per session", for the list.
function payLabel(t: Trainer) {
  const parts: string[] = [];
  if (t.userId) parts.push("Staff pay rate");
  else if (t.salary !== null && t.salary !== undefined) parts.push(t.salary ? `${t.salary.toLocaleString()} / ${CYCLE_LABEL[t.salaryCycle || "monthly"]}` : "No salary");
  if (t.commissionType === "amount" && t.commissionValue !== null && t.commissionValue !== undefined) parts.push(`${t.commissionValue.toLocaleString()} per session`);
  else if (t.commissionType === "percent" && t.commissionValue !== null && t.commissionValue !== undefined) parts.push(`${t.commissionValue}% of session`);
  else if (t.commissionPercent !== null && t.commissionPercent !== undefined) parts.push(`${t.commissionPercent}% of session`);
  return parts.join(" · ") || "—";
}

function TrainersAdminPageInner() {
  const { can } = usePermissions();
  const { ask, dialog: confirmDialog } = useConfirm();
  const editable = can("trainers", "manage");
  // The address can name a trainer to open (?id=, from the header search),
  // read again whenever it changes.
  const urlId = useSearchParams().get("id");
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
    // A trainer given a percent before the fixed amount existed carries only
    // commissionPercent: shown (and saved) as the percent it is, not as the
    // gym's default.
    const legacyPercent =
      !t.commissionType && t.commissionPercent !== null && t.commissionPercent !== undefined
        ? { commissionType: "percent" as const, commissionValue: t.commissionPercent }
        : {};
    setForm({ ...t, ...legacyPercent });
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

  // Fetched on its own, as it need not be on the page shown, and then dropped
  // from the address: closing the editor is final, and the same link
  // followed again opens it again. The editor is the only view of one
  // trainer, so without the manage permission the link just lands on the list.
  useEffect(() => {
    if (!urlId) return;
    replaceParams({ id: null });
    if (!editable) return;
    // The admin list narrowed to one: the public read by id leaves the pay
    // terms out.
    apiGet<{ data?: Trainer[] }>(`${GYMFOLIO_API}/trainers?id=${encodeURIComponent(urlId)}`)
      .then((r) => {
        if (r.data && r.data[0]) openEdit(r.data[0]);
      })
      .catch((e) => alert(e instanceof Error ? e.message : "Could not open that trainer"));
  }, [urlId, editable]);

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
        // Pay terms are sent below, where a blank means something.
        if (["commissionPercent", "commissionType", "commissionValue", "salary", "salaryCycle"].includes(k)) return;
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
      // Always sent: an empty type is "the gym's default", an empty salary is
      // "none set" (0 is a real salary: commission only).
      fd.append("commissionType", form.commissionType || "");
      fd.append("commissionValue", form.commissionType && form.commissionValue !== null && form.commissionValue !== undefined ? String(form.commissionValue) : "");
      fd.append("salary", form.salary === null || form.salary === undefined ? "" : String(form.salary));
      fd.append("salaryCycle", form.salaryCycle || "monthly");
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

  const remove = async (t: Trainer) => {
    const answer = await ask({ title: `Delete ${t.name}?`, body: "Their trainer profile is deleted. This cannot be undone.", confirmLabel: "Delete trainer" });
    if (answer === null) return;
    try {
      await apiJson(`${GYMFOLIO_API}/trainers/${t._id}`, "DELETE");
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
      {confirmDialog}
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
          columns={["", "Name", "Role", "Experience", "Email", "Pay", "Status", "Actions"]}
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
            <span key="p" className="text-xs text-neutral-600">{payLabel(t)}</span>,
            <button key="b" onClick={() => toggleActive(t)} disabled={!editable} className="disabled:cursor-default">
              <Badge color={t.isActive ? "green" : "neutral"}>
                {t.isActive ? "Active" : "Inactive"}
              </Badge>
            </button>,
            editable ? (
              <div key="a" className="flex gap-2">
                <SecondaryButton onClick={() => openEdit(t)} label={`Edit ${t.name}`}>
                  <FiEdit2 className="w-3.5 h-3.5" />
                </SecondaryButton>
                <DangerButton onClick={() => remove(t)} label={`Delete ${t.name}`}>
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
          <SelectField
            label="PT commission"
            value={form.commissionType || ""}
            onChange={(v) => {
              const type = v === "percent" || v === "amount" ? v : null;
              // A new kind of commission starts blank: 15 meant 15%, not 15 per session.
              setForm({ ...form, commissionType: type, commissionValue: type && type === form.commissionType ? form.commissionValue ?? null : null });
            }}
            placeholder="Gym default (Settings)"
            options={[
              { value: "percent", label: "Percent of each session" },
              { value: "amount", label: "Fixed amount per session" },
            ]}
          />
          {form.commissionType ? (
            <TextField
              label={form.commissionType === "percent" ? "Commission %" : "Commission per session"}
              type="number"
              value={form.commissionValue ?? ""}
              onChange={(v) => setForm({ ...form, commissionValue: v === "" ? null : Number(v) })}
            />
          ) : (
            <div />
          )}
          <TextField
            label="Salary per cycle (blank = none, 0 = commission only)"
            type="number"
            value={form.salary ?? ""}
            onChange={(v) => setForm({ ...form, salary: v === "" ? null : Number(v) })}
          />
          <SelectField
            label="Pay cycle"
            value={form.salaryCycle || "monthly"}
            allowClear={false}
            onChange={(v) => setForm({ ...form, salaryCycle: (v || "monthly") as Trainer["salaryCycle"] })}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "biweekly", label: "Every two weeks" },
              { value: "weekly", label: "Weekly" },
            ]}
          />
          {form.userId ? (
            <p className="md:col-span-2 -mt-2 text-[12px] text-neutral-500">
              Linked to a staff account: payslips and the wage bill use that account&apos;s pay rate, and the
              commission is paid on the payslip. The salary here counts only while the trainer is unlinked.
            </p>
          ) : (
            <p className="md:col-span-2 -mt-2 text-[12px] text-neutral-500">
              With no staff account the salary here is the trainer&apos;s wage cost on Accounts, and their PT
              commission shows as payable on the Personal Training page.
            </p>
          )}
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

export default function TrainersAdminPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <TrainersAdminPageInner />
    </Suspense>
  );
}
