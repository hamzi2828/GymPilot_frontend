"use client";

// Announcements: a bar on the website and/or a banner in the member portal.

import { useCallback, useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, TextArea, SelectField, Toggle, Badge, Spinner, Table } from "../_shared/ui";
import { apiGet, apiJson } from "../_shared/api";
import { MESSAGING_API, when, dateInput, type Announcement } from "./shared";

type Draft = { title: string; body: string; audience: Announcement["audience"]; tone: Announcement["tone"]; url: string; urlLabel: string; startsAt: string; endsAt: string; isActive: boolean };
const emptyDraft: Draft = { title: "", body: "", audience: "members", tone: "info", url: "", urlLabel: "", startsAt: "", endsAt: "", isActive: true };

export default function AnnouncementsPanel({ editable }: { editable: boolean }) {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: Announcement[] }>(`${MESSAGING_API}/announcements`);
      setRows(res.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load announcements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setError(null);
    setOpen(true);
  };
  const openEdit = (a: Announcement) => {
    setEditing(a);
    setDraft({ title: a.title, body: a.body, audience: a.audience, tone: a.tone, url: a.url, urlLabel: a.url_label, startsAt: dateInput(a.starts_at), endsAt: dateInput(a.ends_at), isActive: a.is_active });
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const body = { title: draft.title, body: draft.body, audience: draft.audience, tone: draft.tone, url: draft.url, urlLabel: draft.urlLabel, startsAt: draft.startsAt || null, endsAt: draft.endsAt || null, isActive: draft.isActive };
    try {
      if (editing) await apiJson(`${MESSAGING_API}/announcements/${editing.id}`, "PUT", body);
      else await apiJson(`${MESSAGING_API}/announcements`, "POST", body);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the announcement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Announcement) => {
    if (!confirm(`Delete "${a.title}"?`)) return;
    try {
      await apiJson(`${MESSAGING_API}/announcements/${a.id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const live = (a: Announcement) => {
    const now = Date.now();
    if (!a.is_active) return false;
    if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
    if (a.ends_at && new Date(a.ends_at).getTime() < now) return false;
    return true;
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">Shown as a bar on the website, a banner in the member portal, or both — no email needed.</p>
        {editable && (
          <PrimaryButton onClick={openCreate}>
            <FiPlus className="mr-1.5 h-4 w-4" /> New announcement
          </PrimaryButton>
        )}
      </div>
      {error && !open && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["Announcement", "Where", "When", "Status", ""]}
          rows={rows.map((a) => [
            <div key="t">
              <p className="font-medium text-neutral-900">{a.title}</p>
              {a.body && <p className="text-xs text-neutral-500">{a.body.slice(0, 80)}</p>}
            </div>,
            <span key="w" className="text-xs capitalize text-neutral-600">
              {a.audience === "all" ? "Website + portal" : a.audience === "public" ? "Website" : "Member portal"}
            </span>,
            <span key="d" className="text-xs text-neutral-600">
              {a.starts_at || a.ends_at ? `${a.starts_at ? when(a.starts_at) : "now"} → ${a.ends_at ? when(a.ends_at) : "no end"}` : "Always"}
            </span>,
            <Badge key="s" color={live(a) ? "green" : "neutral"}>
              {live(a) ? "Live" : a.is_active ? "Scheduled / ended" : "Off"}
            </Badge>,
            editable ? (
              <div key="x" className="flex gap-2">
                <SecondaryButton onClick={() => openEdit(a)}>Edit</SecondaryButton>
                <DangerButton onClick={() => remove(a)}>Delete</DangerButton>
              </div>
            ) : (
              <span key="x" />
            ),
          ])}
          empty="No announcements. Add one for holiday hours, a closure or a new class."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit announcement" : "New announcement"} size="lg">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextField label="Title" required value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} placeholder="Closed on Monday 14th" />
          </div>
          <div className="md:col-span-2">
            <TextArea label="Details (optional)" value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })} />
          </div>
          <SelectField label="Show on" value={draft.audience} allowClear={false} onChange={(v) => setDraft({ ...draft, audience: v as Draft["audience"] })} options={[{ value: "members", label: "Member portal" }, { value: "public", label: "Website" }, { value: "all", label: "Website and portal" }]} />
          <SelectField label="Style" value={draft.tone} allowClear={false} onChange={(v) => setDraft({ ...draft, tone: v as Draft["tone"] })} options={[{ value: "info", label: "Notice" }, { value: "success", label: "Good news" }, { value: "warning", label: "Warning" }]} />
          <TextField label="Link (optional)" value={draft.url} onChange={(v) => setDraft({ ...draft, url: v })} placeholder="https://…" />
          <TextField label="Link label" value={draft.urlLabel} onChange={(v) => setDraft({ ...draft, urlLabel: v })} placeholder="Read more" />
          <TextField label="From" type="date" value={draft.startsAt} onChange={(v) => setDraft({ ...draft, startsAt: v })} />
          <TextField label="Until" type="date" value={draft.endsAt} onChange={(v) => setDraft({ ...draft, endsAt: v })} />
          <Toggle label="Active" checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} />
        </div>
        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || !draft.title.trim()}>
            {saving ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
