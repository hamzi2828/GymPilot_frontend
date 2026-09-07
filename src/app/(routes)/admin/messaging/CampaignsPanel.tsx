"use client";

// Campaigns: one message to an audience, sent a batch at a time so a big
// list never hits the API's time limit. The panel keeps calling send until
// the server says it is done.

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiSend } from "react-icons/fi";
import { PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, TextArea, SelectField, Badge, Spinner, Table } from "../_shared/ui";
import { apiGet, apiJson } from "../_shared/api";
import { MESSAGING_API, CHANNEL_LABEL, AUDIENCE_LABEL, when, type Campaign, type Channel, type AudienceType, type ChannelsInfo } from "./shared";

type Draft = { title: string; channel: Channel; audienceType: AudienceType; tags: string; days: string; subject: string; body: string; url: string };
const emptyDraft: Draft = { title: "", channel: "email", audienceType: "all_members", tags: "", days: "14", subject: "", body: "", url: "" };

const STATUS_COLOR: Record<Campaign["status"], "neutral" | "amber" | "green" | "rose"> = { draft: "neutral", sending: "amber", sent: "green", failed: "rose" };

export default function CampaignsPanel({ editable, channels }: { editable: boolean; channels: ChannelsInfo | null }) {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<{ total: number; reachable: number; preview: { name: string; address: string }[] } | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: Campaign[] }>(`${MESSAGING_API}/campaigns`);
      setRows(res.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load campaigns");
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
    setAudience(null);
    setError(null);
    setOpen(true);
  };

  const openEdit = async (c: Campaign) => {
    setEditing(c);
    setDraft({ title: c.title, channel: c.channel, audienceType: c.audience.type, tags: (c.audience.tags || []).join(", "), days: String(c.audience.days || 14), subject: c.subject, body: c.body, url: c.url });
    setError(null);
    setAudience(null);
    setOpen(true);
    try {
      const res = await apiGet<{ data: typeof audience }>(`${MESSAGING_API}/campaigns/${c.id}/audience`);
      setAudience(res.data);
    } catch {
      /* the count is a convenience */
    }
  };

  const payload = () => ({
    title: draft.title,
    channel: draft.channel,
    audience: { type: draft.audienceType, tags: draft.tags.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean), days: Number(draft.days) || 14 },
    subject: draft.subject,
    body: draft.body,
    url: draft.url,
  });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editing) await apiJson(`${MESSAGING_API}/campaigns/${editing.id}`, "PUT", payload());
      else await apiJson(`${MESSAGING_API}/campaigns`, "POST", payload());
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the campaign");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Campaign) => {
    if (!confirm(`Delete "${c.title}"?`)) return;
    try {
      await apiJson(`${MESSAGING_API}/campaigns/${c.id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const send = async (c: Campaign) => {
    if (c.status === "draft" && !confirm(`Send "${c.title}" by ${CHANNEL_LABEL[c.channel]} now? This cannot be undone.`)) return;
    setSending(c.id);
    setProgress("Sending…");
    setError(null);
    try {
      // Loop until the server reports every recipient handled.
      for (let i = 0; i < 400; i++) {
        const res = await apiJson<{ done: boolean; remaining: number; data: Campaign }>(`${MESSAGING_API}/campaigns/${c.id}/send`, "POST", { limit: 50 });
        setProgress(`${res.data.stats.sent} sent, ${res.data.stats.failed} failed, ${res.remaining} to go`);
        if (res.done) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sending stopped");
    } finally {
      setSending(null);
      setProgress(null);
      await load();
    }
  };

  const channelOptions = (["email", "sms", "whatsapp", "push"] as Channel[]).map((c) => ({
    value: c,
    label: `${CHANNEL_LABEL[c]}${channels && !channels.available[c] ? " (not set up)" : ""}`,
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">Promotions, notices and newsletters to a chosen audience. Members who opted out of marketing are left out automatically.</p>
        {editable && (
          <PrimaryButton onClick={openCreate}>
            <FiPlus className="mr-1.5 h-4 w-4" /> New campaign
          </PrimaryButton>
        )}
      </div>
      {error && !open && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {progress && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{progress}</p>}

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["Campaign", "Channel", "Audience", "Status", "Result", ""]}
          rows={rows.map((c) => [
            <div key="t">
              <p className="font-medium text-neutral-900">{c.title}</p>
              <p className="text-xs text-neutral-500">{c.subject || c.body.slice(0, 60)}</p>
            </div>,
            <span key="c">{CHANNEL_LABEL[c.channel]}</span>,
            <span key="a" className="text-xs text-neutral-600">
              {AUDIENCE_LABEL[c.audience.type]}
              {c.audience.type === "tags" && c.audience.tags.length ? `: ${c.audience.tags.join(", ")}` : ""}
              {c.audience.type === "expiring_members" ? ` (${c.audience.days} days)` : ""}
            </span>,
            <Badge key="s" color={STATUS_COLOR[c.status]}>
              {c.status}
            </Badge>,
            <span key="r" className="text-xs text-neutral-600">
              {c.status === "draft" ? "—" : `${c.stats.sent} sent · ${c.stats.failed} failed · ${c.stats.skipped} skipped of ${c.stats.targeted}`}
              {c.sent_at && <span className="block text-[11px] text-neutral-400">{when(c.sent_at)}</span>}
            </span>,
            editable ? (
              <div key="x" className="flex gap-2">
                {c.status === "draft" && <SecondaryButton onClick={() => openEdit(c)}>Edit</SecondaryButton>}
                {c.status !== "sent" && (
                  <PrimaryButton onClick={() => send(c)} disabled={sending === c.id}>
                    <FiSend className="mr-1 h-3.5 w-3.5" /> {c.status === "sending" ? "Continue" : c.status === "failed" ? "Retry" : "Send"}
                  </PrimaryButton>
                )}
                {c.status !== "sending" && <DangerButton onClick={() => remove(c)}>Delete</DangerButton>}
              </div>
            ) : (
              <span key="x" />
            ),
          ])}
          empty="No campaigns yet. Create one to write to your members."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.title}` : "New campaign"} size="lg">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Title (internal)" required value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} placeholder="September offer" />
          <SelectField label="Channel" value={draft.channel} allowClear={false} onChange={(v) => setDraft({ ...draft, channel: v as Channel })} options={channelOptions} />
          <SelectField
            label="Audience"
            value={draft.audienceType}
            allowClear={false}
            onChange={(v) => setDraft({ ...draft, audienceType: v as AudienceType })}
            options={(Object.keys(AUDIENCE_LABEL) as AudienceType[]).map((k) => ({ value: k, label: AUDIENCE_LABEL[k] }))}
          />
          {draft.audienceType === "tags" && <TextField label="Tags (comma separated)" value={draft.tags} onChange={(v) => setDraft({ ...draft, tags: v })} placeholder="student, corporate" />}
          {draft.audienceType === "expiring_members" && <TextField label="Ending within (days)" type="number" value={draft.days} onChange={(v) => setDraft({ ...draft, days: v })} />}
          {(draft.channel === "email" || draft.channel === "push") && (
            <div className="md:col-span-2">
              <TextField label={draft.channel === "email" ? "Subject" : "Notification title"} value={draft.subject} onChange={(v) => setDraft({ ...draft, subject: v })} placeholder="Hello {{firstName}}" />
            </div>
          )}
          <div className="md:col-span-2">
            <TextArea label={draft.channel === "email" ? "Message (plain text or simple HTML)" : "Message"} value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })} placeholder="Hi {{firstName}}, …" />
            <p className="mt-1 text-xs text-neutral-500">
              Placeholders: <code>{"{{firstName}}"}</code> <code>{"{{siteName}}"}</code> <code>{"{{portalUrl}}"}</code> <code>{"{{timetableUrl}}"}</code> <code>{"{{renewUrl}}"}</code>
            </p>
          </div>
          {draft.channel === "push" && <TextField label="Opens (URL)" value={draft.url} onChange={(v) => setDraft({ ...draft, url: v })} placeholder="https://yourgym.com/packages" />}
        </div>
        {audience && (
          <p className="mt-4 text-xs text-neutral-600">
            Audience right now: <strong>{audience.reachable}</strong> reachable of {audience.total}
            {audience.preview.length ? ` — e.g. ${audience.preview.slice(0, 3).map((p) => p.name || p.address).join(", ")}` : ""}
          </p>
        )}
        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || !draft.title.trim() || !draft.body.trim()}>
            {saving ? "Saving…" : "Save draft"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
