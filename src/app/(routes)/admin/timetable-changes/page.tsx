"use client";

// One-off timetable changes: cancelled sessions, closed days, stand-in
// instructors and room changes. Cancelling a session cancels its bookings
// and tells the members.

import { useCallback, useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { PageHeader, PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, SelectField, Badge, Spinner, Table } from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";

interface Exception {
  id: string;
  class_id: string | null;
  class_name: string;
  date: string;
  start_time: string;
  kind: "cancelled" | "substitute";
  instructor_name: string;
  room: string;
  note: string;
}
interface ClassOption {
  _id: string;
  name: string;
  schedule?: { day: string; startTime: string; endTime: string }[];
}
interface TrainerOption {
  _id: string;
  name: string;
}

const ALL = 500;
const today = () => new Date().toISOString().slice(0, 10);
const weekdayOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

export default function TimetableChangesPage() {
  const { can } = usePermissions();
  const editable = can("classes", "manage");
  const [rows, setRows] = useState<Exception[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [draft, setDraft] = useState({ classId: "", date: today(), startTime: "", kind: "cancelled", instructorId: "", instructorName: "", room: "", note: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Exception[] }>(`${GYMFOLIO_API}/class-exceptions`);
      setRows(r.data || []);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load timetable changes" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Explicit limits: both endpoints default to twenty, which quietly left
    // later classes and trainers out of these dropdowns. Without the Trainers
    // tab, the public list of active trainers stands in.
    apiGet<{ data: ClassOption[] }>(`${GYMFOLIO_API}/gym-classes?limit=${ALL}`)
      .then((r) => setClasses(r.data || []))
      .catch(() => setClasses([]));
    apiGet<{ data: TrainerOption[] }>(`${GYMFOLIO_API}/trainers?limit=${ALL}`)
      .catch(() => apiGet<{ data: TrainerOption[] }>(`${GYMFOLIO_API}/trainers/active`))
      .then((r) => setTrainers(r.data || []))
      .catch(() => setTrainers([]));
  }, [load]);

  const chosenClass = classes.find((c) => c._id === draft.classId);
  const sessionsThatDay = (chosenClass?.schedule || []).filter((s) => s.day === weekdayOf(draft.date));

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await apiJson<{ message: string }>(`${GYMFOLIO_API}/class-exceptions`, "POST", { ...draft, classId: draft.classId || null });
      setNotice({ tone: "ok", text: res.message });
      setOpen(false);
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (x: Exception) => {
    if (!confirm("Remove this change? Bookings that were cancelled stay cancelled.")) return;
    try {
      await apiJson(`${GYMFOLIO_API}/class-exceptions/${x.id}`, "DELETE");
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not remove" });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Fitness"
        title="Timetable changes"
        actions={
          editable ? (
            <PrimaryButton onClick={() => { setDraft({ classId: "", date: today(), startTime: "", kind: "cancelled", instructorId: "", instructorName: "", room: "", note: "" }); setOpen(true); }}>
              <FiPlus className="mr-1.5 h-4 w-4" /> New change
            </PrimaryButton>
          ) : undefined
        }
      />
      <p className="mb-4 text-sm text-neutral-600">Cancel a session or a whole day (a holiday), or put a stand-in instructor or a different room on one session. The public timetable shows the change straight away.</p>
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["Date", "Class", "Session", "Change", "Note", ""]}
          rows={rows.map((x) => [
            <span key="d">{x.date}</span>,
            <span key="c">{x.class_name || <em>Every class</em>}</span>,
            <span key="s">{x.start_time || "All day"}</span>,
            <div key="k">
              <Badge color={x.kind === "cancelled" ? "rose" : "blue"}>{x.kind === "cancelled" ? "Cancelled" : "Substitute"}</Badge>
              {x.kind === "substitute" && <p className="mt-1 text-xs text-neutral-600">{[x.instructor_name && `by ${x.instructor_name}`, x.room && `in ${x.room}`].filter(Boolean).join(", ")}</p>}
            </div>,
            <span key="n" className="text-xs text-neutral-600">{x.note}</span>,
            editable ? <DangerButton key="a" onClick={() => remove(x)}>Remove</DangerButton> : <span key="a" />,
          ])}
          empty="No timetable changes coming up."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Timetable change" size="lg">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField label="What" value={draft.kind} allowClear={false} onChange={(v) => setDraft({ ...draft, kind: v })} options={[{ value: "cancelled", label: "Cancel (session or whole day)" }, { value: "substitute", label: "Stand-in instructor / room change" }]} />
          <TextField label="Date" type="date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v, startTime: "" })} />
          <SelectField label="Class" value={draft.classId} onChange={(v) => setDraft({ ...draft, classId: v, startTime: "" })} placeholder={draft.kind === "cancelled" ? "Every class (closed day)" : "Choose a class"} options={classes.map((c) => ({ value: c._id, label: c.name }))} />
          <SelectField label="Session" value={draft.startTime} onChange={(v) => setDraft({ ...draft, startTime: v })} placeholder={draft.classId ? "All sessions that day" : "—"} options={sessionsThatDay.map((s) => ({ value: s.startTime, label: `${s.startTime}–${s.endTime}` }))} />
          {draft.kind === "substitute" && (
            <>
              <SelectField label="Stand-in trainer" value={draft.instructorId} onChange={(v) => setDraft({ ...draft, instructorId: v })} placeholder="Pick a trainer" options={trainers.map((t) => ({ value: t._id, label: t.name }))} />
              <TextField label="…or a name" value={draft.instructorName} onChange={(v) => setDraft({ ...draft, instructorName: v })} placeholder="Guest coach" />
              <TextField label="Room" value={draft.room} onChange={(v) => setDraft({ ...draft, room: v })} placeholder="Studio B" />
            </>
          )}
          <div className="md:col-span-2">
            <TextField label="Note shown to members" value={draft.note} onChange={(v) => setDraft({ ...draft, note: v })} placeholder="Public holiday, instructor unwell…" />
          </div>
        </div>
        {draft.kind === "cancelled" && <p className="mt-3 text-xs text-amber-700">Existing bookings on the cancelled session(s) are cancelled and the members are told. Session-pack credits go back.</p>}
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || (draft.kind === "substitute" && !draft.classId)}>
            {saving ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
