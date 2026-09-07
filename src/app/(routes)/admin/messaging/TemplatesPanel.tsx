"use client";

// Wording: the gym's own text for each message the system sends.

import { useCallback, useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, TextArea, Toggle, Badge, Spinner, Card } from "../_shared/ui";
import { apiGet, apiJson } from "../_shared/api";
import { MESSAGING_API, type TemplateEvent } from "./shared";

type Draft = { subject: string; body: string; text: string; enabled: boolean };

export default function TemplatesPanel({ editable }: { editable: boolean }) {
  const [events, setEvents] = useState<TemplateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TemplateEvent | null>(null);
  const [draft, setDraft] = useState<Draft>({ subject: "", body: "", text: "", enabled: true });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: TemplateEvent[] }>(`${MESSAGING_API}/templates`);
      setEvents(res.data || []);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load the wording" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (ev: TemplateEvent) => {
    setEditing(ev);
    setDraft({
      subject: ev.custom?.subject || ev.default_subject,
      body: ev.custom?.body || ev.default_body,
      text: ev.custom?.text || ev.default_text,
      enabled: ev.custom ? ev.custom.enabled : true,
    });
    setNotice(null);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiJson(`${MESSAGING_API}/templates/${editing.key}`, "PUT", draft);
      setEditing(null);
      setNotice({ tone: "ok", text: "Wording saved." });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  };

  const reset = async (ev: TemplateEvent) => {
    if (!confirm(`Go back to the built-in wording for "${ev.label}"?`)) return;
    try {
      await apiJson(`${MESSAGING_API}/templates/${ev.key}`, "DELETE");
      setEditing(null);
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not reset" });
    }
  };

  const test = async (ev: TemplateEvent) => {
    try {
      const res = await apiJson<{ message: string }>(`${MESSAGING_API}/templates/${ev.key}/test`, "POST", {});
      setNotice({ tone: "ok", text: res.message });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not send a sample" });
    }
  };

  const groups = Array.from(new Set(events.map((e) => e.group)));

  return (
    <div>
      <p className="mb-4 text-sm text-neutral-600">
        Every message the system sends, with the placeholders you can use. Customise the email and the short text (SMS, WhatsApp, push); reset to go back to the built-in wording.
      </p>
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group} className="p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">{group}</h3>
              <div className="divide-y divide-neutral-100">
                {events
                  .filter((e) => e.group === group)
                  .map((ev) => (
                    <div key={ev.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900">
                          {ev.label}{" "}
                          {ev.custom ? <Badge color={ev.custom.enabled ? "blue" : "neutral"}>{ev.custom.enabled ? "Customised" : "Custom (off)"}</Badge> : <Badge color="neutral">Built-in</Badge>}
                        </p>
                        <p className="truncate text-xs text-neutral-500">{ev.custom?.text || ev.default_text}</p>
                      </div>
                      {editable && (
                        <div className="flex gap-2">
                          <SecondaryButton onClick={() => openEdit(ev)}>Edit</SecondaryButton>
                          {ev.custom && <SecondaryButton onClick={() => test(ev)}>Email me a sample</SecondaryButton>}
                          {ev.custom && <DangerButton onClick={() => reset(ev)}>Reset</DangerButton>}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? editing.label : ""} size="lg">
        {editing && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">
              Placeholders: {editing.variables.map((v) => <code key={v} className="mr-1 rounded bg-neutral-100 px-1">{`{{${v}}}`}</code>)}
            </p>
            {editing.built_in_email && !editing.custom && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">This email has a designed built-in layout. Fill in a subject and body below to replace it with your own wording.</p>
            )}
            <TextField label="Email subject" value={draft.subject} onChange={(v) => setDraft({ ...draft, subject: v })} />
            <TextArea label="Email body (plain text with blank lines between paragraphs, or simple HTML)" value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })} />
            <TextArea label="Short text (SMS / WhatsApp / push)" value={draft.text} onChange={(v) => setDraft({ ...draft, text: v })} />
            <Toggle label="Use my wording" checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save wording"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
