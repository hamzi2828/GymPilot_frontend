"use client";

// One-off timetable changes: cancelled sessions, closed days, stand-in
// instructors and room changes. Cancelling a session cancels its bookings
// and tells the members.

import { useCallback, useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { PageHeader, PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, SelectField, Badge, Spinner, Table, ErrorState } from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { useGymToday } from "@/components/ThemeProvider";

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
const weekdayOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};
// "Friday 9 October 2026": the date as it is said out loud, for the confirm.
const longDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

// What the form is for. Nothing is chosen to start with, and closing for a day
// is its own choice: it used to be what an empty Class box meant, with "cancel"
// preselected, so one click on Save cancelled every class today.
type What = "" | "session" | "day" | "substitute";
type Draft = { what: What; classId: string; date: string; startTime: string; instructorId: string; instructorName: string; room: string; note: string };
const WHAT_OPTIONS: { value: What; label: string }[] = [
  { value: "substitute", label: "Stand-in instructor or room change" },
  { value: "session", label: "Cancel one class" },
  { value: "day", label: "Close for the day (cancel every class)" },
];

export default function TimetableChangesPage() {
  const today = useGymToday();
  const { can } = usePermissions();
  const editable = can("classes", "manage");
  const [rows, setRows] = useState<Exception[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // A failed load is not "no changes", and a failed save belongs in the form
  // that was being filled in, not on the page behind it.
  const [loadError, setLoadError] = useState("");
  const [modalError, setModalError] = useState("");
  // The second step of a cancellation: what is about to be cancelled, in words.
  const [confirming, setConfirming] = useState(false);
  const emptyDraft = (): Draft => ({ what: "", classId: "", date: today(), startTime: "", instructorId: "", instructorName: "", room: "", note: "" });
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Exception[] }>(`${GYMFOLIO_API}/class-exceptions`);
      setRows(r.data || []);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load timetable changes");
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
  const chosenSession = sessionsThatDay.find((s) => s.startTime === draft.startTime);

  const cancelling = draft.what === "session" || draft.what === "day";
  const needsClass = draft.what === "session" || draft.what === "substitute";
  const ready =
    !!draft.what &&
    !!draft.date &&
    (!needsClass || !!draft.classId) &&
    (draft.what !== "substitute" || !!draft.instructorId || !!draft.instructorName.trim() || !!draft.room.trim());

  // Exactly what a cancellation will cancel, for the confirm step.
  const cancelSummary =
    draft.what === "day"
      ? `every class on ${longDate(draft.date)}`
      : `${chosenClass?.name || "this class"} on ${longDate(draft.date)}${chosenSession ? ` (the ${chosenSession.startTime}–${chosenSession.endTime} session)` : " (every session that day)"}`;

  const openNew = () => {
    setDraft(emptyDraft());
    setModalError("");
    setConfirming(false);
    setOpen(true);
  };

  const save = async () => {
    if (!ready) return;
    // A cancellation is confirmed first: the bookings on it do not come back.
    if (cancelling && !confirming) {
      setModalError("");
      setConfirming(true);
      return;
    }
    setSaving(true);
    setNotice(null);
    setModalError("");
    const substitute = draft.what === "substitute";
    try {
      const res = await apiJson<{ message: string }>(`${GYMFOLIO_API}/class-exceptions`, "POST", {
        // Only "close for the day" goes without a class; that is what a
        // missing class means to the server.
        classId: draft.what === "day" ? null : draft.classId,
        date: draft.date,
        startTime: draft.what === "day" ? "" : draft.startTime,
        kind: substitute ? "substitute" : "cancelled",
        instructorId: substitute ? draft.instructorId : "",
        instructorName: substitute ? draft.instructorName : "",
        room: substitute ? draft.room : "",
        note: draft.note,
      });
      setNotice({ tone: "ok", text: res.message });
      setOpen(false);
      await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Could not save");
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
            <PrimaryButton onClick={openNew}>
              <FiPlus className="mr-1.5 h-4 w-4" /> New change
            </PrimaryButton>
          ) : undefined
        }
      />
      <p className="mb-4 text-sm text-neutral-600">Cancel a session or a whole day (a holiday), or put a stand-in instructor or a different room on one session. The public timetable shows the change straight away.</p>
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      {loading ? (
        <Spinner />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
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

      <Modal open={open} onClose={() => setOpen(false)} title={confirming ? "Cancel and tell the members?" : "Timetable change"} size="lg">
        {confirming ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-4 py-4 text-sm text-rose-900">
            <p className="font-semibold">You are about to cancel {cancelSummary}.</p>
            <p className="mt-2">Every booking on {draft.what === "day" ? "those classes" : "it"} is cancelled and the members are told. Removing this change later does not bring those bookings back.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField
                label="What do you want to do?"
                value={draft.what}
                allowClear={false}
                placeholder="Choose one"
                onChange={(v) => setDraft({ ...draft, what: v as What, ...(v === "day" ? { classId: "", startTime: "" } : {}) })}
                options={WHAT_OPTIONS}
              />
              <TextField label="Date" type="date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v, startTime: "" })} />
              {needsClass && (
                <>
                  <SelectField label="Class" value={draft.classId} allowClear={false} onChange={(v) => setDraft({ ...draft, classId: v, startTime: "" })} placeholder="Choose a class" options={classes.map((c) => ({ value: c._id, label: c.name }))} />
                  <SelectField label="Session" value={draft.startTime} onChange={(v) => setDraft({ ...draft, startTime: v })} placeholder={draft.classId ? "Every session that day" : "Choose a class first"} options={sessionsThatDay.map((s) => ({ value: s.startTime, label: `${s.startTime}–${s.endTime}` }))} />
                </>
              )}
              {draft.what === "substitute" && (
                <>
                  <SelectField label="Stand-in trainer" value={draft.instructorId} onChange={(v) => setDraft({ ...draft, instructorId: v })} placeholder="Pick a trainer" options={trainers.map((t) => ({ value: t._id, label: t.name }))} />
                  <TextField label="…or a name" value={draft.instructorName} onChange={(v) => setDraft({ ...draft, instructorName: v })} placeholder="Guest coach" />
                  <TextField label="Room" value={draft.room} onChange={(v) => setDraft({ ...draft, room: v })} placeholder="Studio B" />
                </>
              )}
              {draft.what && (
                <div className="md:col-span-2">
                  <TextField label="Note shown to members" value={draft.note} onChange={(v) => setDraft({ ...draft, note: v })} placeholder="Public holiday, instructor unwell…" />
                </div>
              )}
            </div>
            {needsClass && chosenClass && draft.date && !sessionsThatDay.length && (
              <p className="mt-3 text-xs text-amber-700">{chosenClass.name} has no session on a {weekdayOf(draft.date)}. Check the date.</p>
            )}
            {cancelling && <p className="mt-3 text-xs text-amber-700">Existing bookings on the cancelled session(s) are cancelled and the members are told. Session-pack credits go back.</p>}
          </>
        )}
        {modalError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{modalError}</p>}
        <div className="mt-6 flex justify-end gap-2">
          {confirming ? (
            <>
              <SecondaryButton onClick={() => { setConfirming(false); setModalError(""); }} disabled={saving}>
                Go back
              </SecondaryButton>
              <DangerButton onClick={save} disabled={saving}>
                {saving ? "Cancelling…" : draft.what === "day" ? "Yes, cancel every class" : "Yes, cancel it"}
              </DangerButton>
            </>
          ) : (
            <>
              <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>
                Close
              </SecondaryButton>
              <PrimaryButton onClick={save} disabled={saving || !ready}>
                {saving ? "Saving…" : cancelling ? "Continue" : "Save"}
              </PrimaryButton>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
