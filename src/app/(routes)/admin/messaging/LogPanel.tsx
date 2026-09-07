"use client";

// What went out, and a way to write to one member by hand.

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiSend } from "react-icons/fi";
import { PrimaryButton, SecondaryButton, Modal, TextField, TextArea, SelectField, Badge, Spinner, Table } from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";
import { MESSAGING_API, CHANNEL_LABEL, when, type LogRow, type Channel, type ChannelsInfo } from "./shared";

interface MemberOption {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string | null;
}

export default function LogPanel({ editable, channels }: { editable: boolean; channels: ChannelsInfo | null }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<{ userId: string; channel: Channel; subject: string; body: string }>({ userId: "", channel: "email", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (channel) params.set("channel", channel);
      if (status) params.set("status", status);
      const res = await apiGet<{ data: LogRow[] }>(`${MESSAGING_API}/log?${params.toString()}`);
      setRows(res.data || []);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load the log" });
    } finally {
      setLoading(false);
    }
  }, [channel, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openSend = async () => {
    setOpen(true);
    setNotice(null);
    if (!members.length) {
      try {
        const res = await apiGet<{ data?: MemberOption[]; users?: MemberOption[] }>(`${API_BASE}/get/allUsers`);
        setMembers((res.data || res.users || []) as MemberOption[]);
      } catch {
        /* the picker just stays empty */
      }
    }
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members.slice(0, 20);
    return members.filter((m) => `${m.firstName || ""} ${m.lastName || ""} ${m.email} ${m.phone || ""}`.toLowerCase().includes(q)).slice(0, 20);
  }, [members, query]);

  const send = async () => {
    setSending(true);
    setNotice(null);
    try {
      const res = await apiJson<{ message: string }>(`${MESSAGING_API}/send`, "POST", draft);
      setNotice({ tone: "ok", text: res.message });
      setOpen(false);
      setDraft({ userId: "", channel: "email", subject: "", body: "" });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not send" });
    } finally {
      setSending(false);
    }
  };

  const chosen = members.find((m) => m._id === draft.userId);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="w-40">
            <SelectField label="Channel" value={channel} onChange={setChannel} options={(["email", "sms", "whatsapp", "push"] as Channel[]).map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))} placeholder="All" />
          </div>
          <div className="w-40">
            <SelectField label="Status" value={status} onChange={setStatus} options={[{ value: "sent", label: "Sent" }, { value: "failed", label: "Failed" }, { value: "skipped", label: "Skipped" }]} placeholder="All" />
          </div>
        </div>
        {editable && (
          <PrimaryButton onClick={openSend}>
            <FiSend className="mr-1.5 h-4 w-4" /> Send a message
          </PrimaryButton>
        )}
      </div>
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["When", "Channel", "To", "About", "Status"]}
          rows={rows.map((r) => [
            <span key="w" className="text-xs text-neutral-600">{when(r.created_at)}</span>,
            <span key="c">{CHANNEL_LABEL[r.channel]}</span>,
            <span key="t" className="text-xs text-neutral-700">{r.to || "—"}</span>,
            <div key="a" className="max-w-md">
              <p className="text-xs text-neutral-700">{r.context}{r.subject ? ` · ${r.subject}` : ""}</p>
              <p className="truncate text-[11px] text-neutral-400">{r.body}</p>
            </div>,
            <div key="s">
              <Badge color={r.status === "sent" ? "green" : r.status === "failed" ? "rose" : "amber"}>{r.status}</Badge>
              {r.error && <p className="mt-1 max-w-xs text-[11px] text-rose-600">{r.error}</p>}
            </div>,
          ])}
          empty="Nothing sent yet on these channels. Transactional emails are not listed here; SMS, WhatsApp, push and campaigns are."
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Send a message" size="lg">
        <div className="space-y-4">
          <TextField label="Find a member" value={query} onChange={setQuery} placeholder="Name, email or phone" />
          <div className="max-h-40 overflow-y-auto rounded-lg border border-neutral-200">
            {matches.map((m) => (
              <button key={m._id} type="button" onClick={() => setDraft({ ...draft, userId: m._id })} className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50 ${draft.userId === m._id ? "bg-neutral-100" : ""}`}>
                <span>{[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email}</span>
                <span className="text-xs text-neutral-500">{m.email}{m.phone ? ` · ${m.phone}` : ""}</span>
              </button>
            ))}
            {!matches.length && <p className="px-3 py-2 text-xs text-neutral-500">No matches.</p>}
          </div>
          <SelectField
            label="Channel"
            value={draft.channel}
            allowClear={false}
            onChange={(v) => setDraft({ ...draft, channel: v as Channel })}
            options={(["email", "sms", "whatsapp", "push"] as Channel[]).map((c) => ({ value: c, label: `${CHANNEL_LABEL[c]}${channels && !channels.available[c] ? " (not set up)" : ""}` }))}
          />
          {(draft.channel === "email" || draft.channel === "push") && <TextField label={draft.channel === "email" ? "Subject" : "Title"} value={draft.subject} onChange={(v) => setDraft({ ...draft, subject: v })} />}
          <TextArea label="Message" value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })} placeholder="Hi {{firstName}}, …" />
          {chosen && <p className="text-xs text-neutral-500">To: {[chosen.firstName, chosen.lastName].filter(Boolean).join(" ")} ({draft.channel === "email" ? chosen.email : draft.channel === "push" ? "their devices" : chosen.phone || "no phone number"})</p>}
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={send} disabled={sending || !draft.userId || !draft.body.trim()}>
              {sending ? "Sending…" : "Send"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
