"use client";

// The office's corrections to a visit the front desk recorded, and the one
// attendance setting that lives on this page. Everything here writes through
// /api/attendance and needs 'manage' on the attendance tab; the page only
// offers these to accounts that hold it.
//
// Times are typed as the gym's wall clock -- "09:15 at the gym" -- and sent as
// a bare 'YYYY-MM-DDTHH:MM', which the server reads in the gym's timezone. The
// browser's own timezone never enters into it, for the same reason every time
// on the page is formatted by the server.

import { useEffect, useState } from "react";
import { Modal, PrimaryButton, SecondaryButton, DangerButton, TextArea, Toggle, Spinner } from "../_shared/ui";
import { ATTENDANCE_API, apiGet, apiJson } from "../_shared/api";

/** What a correction needs to know about a punch-log row. */
export interface CorrectableRecord {
  id: string;
  person_type: "member" | "staff";
  person_name: string;
  shift_date: string;
  date_label: string;
  check_in_at?: string | null;
  check_out_at?: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
}

/** A row's corrections, as the punch log reports them. */
export interface CorrectionFields {
  voided?: boolean;
  void_reason?: string;
  edited?: boolean;
  last_correction?: { action: "edit" | "void"; at_label: string | null; by_name: string; note: string } | null;
}

interface CorrectionResponse {
  message?: string;
}

// An instant as the gym's wall clock, in the shape a datetime-local input
// holds. Empty when there is no time, or the zone is one this browser cannot
// read -- the field is then left for the office to fill in.
export function wallClock(iso: string | null | undefined, timeZone: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const parts: Record<string, string> = {};
    const format = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    for (const part of format.formatToParts(date)) parts[part.type] = part.value;
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch {
    return "";
  }
}

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]";

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2 text-[13px] text-rose-700">{message}</p>;
}

// ---------------------------------------------------------------------------
// Edit times
// ---------------------------------------------------------------------------

export function EditTimesModal({
  record,
  timezone,
  onClose,
  onSaved,
}: {
  record: CorrectableRecord;
  timezone: string | undefined;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const initialIn = wallClock(record.check_in_at, timezone);
  const initialOut = wallClock(record.check_out_at, timezone);
  const [checkIn, setCheckIn] = useState(initialIn);
  const [checkOut, setCheckOut] = useState(initialOut);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The visit stays on the day it is filed under; the server refuses anything
  // else, and the picker says so up front.
  const dayStart = `${record.shift_date}T00:00`;
  const dayEnd = `${record.shift_date}T23:59`;
  const nowAtGym = wallClock(new Date().toISOString(), timezone) || undefined;
  // Wall-clock strings of one shape compare in time order.
  const checkInMax = nowAtGym && nowAtGym < dayEnd ? nowAtGym : dayEnd;

  const save = async () => {
    const body: Record<string, string> = { note: note.trim() };
    if (checkIn && checkIn !== initialIn) body.checkInAt = checkIn;
    if (checkOut && checkOut !== initialOut) body.checkOutAt = checkOut;

    if (!body.checkInAt && !body.checkOutAt) {
      setError("Change the check-in or the check-out time first.");
      return;
    }
    if (!body.note) {
      setError("Add a note saying why the times are being changed.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await apiJson<CorrectionResponse>(`${ATTENDANCE_API}/records/${record.id}`, "PATCH", body);
      onSaved(res.message || "Visit times updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update that visit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit times · ${record.person_name}`} size="sm">
      <div className="space-y-4">
        <p className="text-[13px] text-neutral-600">
          {record.date_label} · recorded {record.check_in_time || "—"} → {record.check_out_time || "no check-out"}
        </p>

        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Check in</span>
          <input
            type="datetime-local"
            value={checkIn}
            min={dayStart}
            max={checkInMax}
            onChange={(e) => setCheckIn(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Check out</span>
          <input
            type="datetime-local"
            value={checkOut}
            min={checkIn || dayStart}
            max={nowAtGym}
            onChange={(e) => setCheckOut(e.target.value)}
            className={inputCls}
          />
        </label>

        <TextArea
          label="Note (required)"
          value={note}
          onChange={setNote}
          rows={2}
          placeholder="e.g. Forgot to scan out — left at 22:00 per the shift manager"
        />

        <p className="text-[11px] text-neutral-400">
          Times are at the gym{timezone ? ` (${timezone})` : ""}.{" "}
          {record.person_type === "staff"
            ? "Hours worked and the late / overtime verdicts are recalculated from the roster."
            : "The duration is recalculated."}{" "}
          The change is recorded against your name.
        </p>

        <ErrorLine message={error} />

        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save times"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Void
// ---------------------------------------------------------------------------

export function VoidVisitModal({
  record,
  onClose,
  onVoided,
}: {
  record: CorrectableRecord;
  onClose: () => void;
  onVoided: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason.trim()) {
      setError("Add a reason for voiding this visit.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiJson<CorrectionResponse>(`${ATTENDANCE_API}/records/${record.id}/void`, "POST", {
        reason: reason.trim(),
      });
      onVoided(res.message || "Visit voided.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not void that visit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Void visit · ${record.person_name}`} size="sm">
      <div className="space-y-4">
        <p className="text-[13px] text-neutral-600">
          {record.date_label} · {record.check_in_time || "—"} → {record.check_out_time || "no check-out"}
        </p>
        <p className="text-[13px] text-neutral-600">
          For a visit that should never have been recorded — the wrong person picked at the desk, a test scan. It stays on
          record with your reason, but no longer counts toward visits, time in the gym or{" "}
          {record.person_type === "staff" ? "hours paid" : "the member's totals"}. This cannot be undone here.
        </p>

        <TextArea label="Reason (required)" value={reason} onChange={setReason} rows={2} placeholder="e.g. Scanned the wrong member" />

        <ErrorLine message={error} />

        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose} disabled={saving}>
            Cancel
          </SecondaryButton>
          <DangerButton onClick={submit} disabled={saving}>
            {saving ? "Voiding…" : "Void visit"}
          </DangerButton>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Desk settings
// ---------------------------------------------------------------------------

interface AttendanceSettingsResponse {
  settings: { member_scan_out: boolean };
  message?: string;
}

export function DeskSettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [scanOut, setScanOut] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiGet<AttendanceSettingsResponse>(`${ATTENDANCE_API}/settings`)
      .then((res) => {
        if (!live) return;
        setSaved(res.settings.member_scan_out);
        setScanOut(res.settings.member_scan_out);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load the attendance settings."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiJson<AttendanceSettingsResponse>(`${ATTENDANCE_API}/settings`, "PUT", { memberScanOut: scanOut });
      onSaved(res.message || "Attendance settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the attendance settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Front desk settings" size="sm">
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <Toggle label="Members scan out when they leave" checked={scanOut} onChange={setScanOut} />
          <p className="text-[13px] text-neutral-600">
            {scanOut
              ? "A member's second scan checks them out and records how long they stayed."
              : "Members only scan in. Every scan is a new visit, and the one before it is closed without a duration, so visits are counted correctly when nobody scans on the way out."}{" "}
            Staff always scan in and out.
          </p>

          <ErrorLine message={error} />

          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={onClose} disabled={saving}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={save} disabled={saving || saved === null || saved === scanOut}>
              {saving ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
