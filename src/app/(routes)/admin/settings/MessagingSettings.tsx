"use client";

// Settings → Messaging: SMS / WhatsApp providers, push notifications, the
// website's WhatsApp button, which channels carry transactional notices, and
// the automated nudges.

import { useState } from "react";
import { Card, PrimaryButton, SecondaryButton, TextField, SelectField, Toggle } from "../_shared/ui";
import { API_BASE, apiJson } from "../_shared/api";

export interface MessagingConfig {
  defaultCountryCode?: string;
  sms?: { provider?: string; accountSid?: string; authToken?: string; authTokenSet?: boolean; from?: string; webhookUrl?: string; webhookToken?: string; webhookTokenSet?: boolean };
  whatsapp?: { provider?: string; accountSid?: string; authToken?: string; authTokenSet?: boolean; from?: string; phoneNumberId?: string; accessToken?: string; accessTokenSet?: boolean; webhookUrl?: string; webhookToken?: string; webhookTokenSet?: boolean };
  push?: { enabled?: boolean; vapidPublicKey?: string; subject?: string };
  transactional?: { sms?: boolean; whatsapp?: boolean; push?: boolean };
  whatsappButton?: { enabled?: boolean; number?: string; message?: string };
  automations?: { absentDays?: number; winBackDays?: number; birthday?: boolean };
}

function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export default function MessagingSettings({
  value,
  onChange,
  onSave,
  onReload,
  saving,
  onNotice,
}: {
  value: MessagingConfig;
  onChange: (next: MessagingConfig) => void;
  onSave: () => Promise<void> | void;
  onReload: () => Promise<void> | void;
  saving: boolean;
  onNotice: (tone: "ok" | "warn" | "error", text: string) => void;
}) {
  const m = value || {};
  const sms = m.sms || {};
  const wa = m.whatsapp || {};
  const push = m.push || {};
  const tx = m.transactional || {};
  const btn = m.whatsappButton || {};
  const auto = m.automations || {};
  const [busy, setBusy] = useState(false);

  const patch = (key: keyof MessagingConfig, sub: Record<string, unknown>) => onChange({ ...m, [key]: { ...((m[key] as Record<string, unknown>) || {}), ...sub } });

  const setupPush = async (rotate = false) => {
    setBusy(true);
    try {
      const res = await apiJson<{ message: string }>(`${API_BASE}/settings/push/keys`, "POST", { rotate });
      onNotice("ok", res.message);
      await onReload();
    } catch (e) {
      onNotice("error", e instanceof Error ? e.message : "Could not set up push");
    } finally {
      setBusy(false);
    }
  };

  const providerFields = (kind: "sms" | "whatsapp") => {
    const cfg = kind === "sms" ? sms : wa;
    const provider = cfg.provider || "none";
    return (
      <>
        {provider === "twilio" && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField label="Account SID" value={cfg.accountSid || ""} onChange={(v) => patch(kind, { accountSid: v })} placeholder="AC…" />
            <div>
              <TextField label="Auth token" type="password" value={cfg.authToken || ""} onChange={(v) => patch(kind, { authToken: v })} />
              {cfg.authTokenSet && <p className="mt-1 text-xs text-neutral-500">A token is saved. Type a new one to replace it.</p>}
            </div>
            <TextField label={kind === "whatsapp" ? "From (WhatsApp sender, e.g. +14155238886)" : "From number"} value={cfg.from || ""} onChange={(v) => patch(kind, { from: v })} placeholder="+1…" />
          </div>
        )}
        {provider === "meta" && kind === "whatsapp" && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField label="Phone number ID" value={wa.phoneNumberId || ""} onChange={(v) => patch("whatsapp", { phoneNumberId: v })} />
            <div>
              <TextField label="Permanent access token" type="password" value={wa.accessToken || ""} onChange={(v) => patch("whatsapp", { accessToken: v })} />
              {wa.accessTokenSet && <p className="mt-1 text-xs text-neutral-500">A token is saved. Type a new one to replace it.</p>}
            </div>
            <p className="text-xs text-neutral-500 md:col-span-2">Meta only delivers free-text messages inside a 24-hour window after the member last wrote to you; otherwise use an approved template on their side.</p>
          </div>
        )}
        {provider === "http" && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField label="Gateway URL" value={cfg.webhookUrl || ""} onChange={(v) => patch(kind, { webhookUrl: v })} placeholder="https://gateway.example.com/send" />
            <div>
              <TextField label="Bearer token (optional)" type="password" value={cfg.webhookToken || ""} onChange={(v) => patch(kind, { webhookToken: v })} />
              {cfg.webhookTokenSet && <p className="mt-1 text-xs text-neutral-500">A token is saved. Type a new one to replace it.</p>}
            </div>
            <p className="text-xs text-neutral-500 md:col-span-2">
              We POST JSON <code>{'{ "channel", "to", "body" }'}</code> to this URL and expect a 2xx. Any local SMS gateway with an HTTP API can be bridged this way.
            </p>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card className="p-6">
        <Heading title="Phone numbers" hint="Members who saved a local number (e.g. 0300…) get this country code added when we text them." />
        <TextField label="Default country code" value={m.defaultCountryCode || ""} onChange={(v) => onChange({ ...m, defaultCountryCode: v })} placeholder="+92" />
      </Card>

      <Card className="p-6">
        <Heading title="SMS" hint="Booking confirmations, reminders and campaigns by text message." />
        <SelectField label="Provider" value={sms.provider || "none"} allowClear={false} onChange={(v) => patch("sms", { provider: v })} options={[{ value: "none", label: "Off" }, { value: "twilio", label: "Twilio" }, { value: "http", label: "Custom HTTP gateway" }]} />
        {providerFields("sms")}
        <div className="mt-4">
          <Toggle label="Also send transactional notices (bookings, payments, reminders) by SMS" checked={!!tx.sms} onChange={(v) => patch("transactional", { sms: v })} />
        </div>
      </Card>

      <Card className="p-6">
        <Heading title="WhatsApp" hint="Through Twilio's WhatsApp API, Meta's WhatsApp Cloud API, or your own gateway." />
        <SelectField label="Provider" value={wa.provider || "none"} allowClear={false} onChange={(v) => patch("whatsapp", { provider: v })} options={[{ value: "none", label: "Off" }, { value: "twilio", label: "Twilio" }, { value: "meta", label: "Meta WhatsApp Cloud API" }, { value: "http", label: "Custom HTTP gateway" }]} />
        {providerFields("whatsapp")}
        <div className="mt-4">
          <Toggle label="Also send transactional notices by WhatsApp" checked={!!tx.whatsapp} onChange={(v) => patch("transactional", { whatsapp: v })} />
        </div>
      </Card>

      <Card className="p-6">
        <Heading title="Push notifications" hint="Members allow notifications in their account (Profile → Notifications) and get them on phone and desktop even when the site is closed." />
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${push.enabled && push.vapidPublicKey ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>{push.enabled && push.vapidPublicKey ? "On" : "Off"}</span>
          {!push.vapidPublicKey ? (
            <SecondaryButton onClick={() => setupPush(false)} disabled={busy}>
              {busy ? "Setting up…" : "Turn on push notifications"}
            </SecondaryButton>
          ) : (
            <>
              <Toggle label="Enabled" checked={!!push.enabled} onChange={(v) => patch("push", { enabled: v })} />
              <SecondaryButton onClick={() => confirm("Rotating the keys signs every member out of push notifications; they must allow them again. Continue?") && setupPush(true)} disabled={busy}>
                Rotate keys
              </SecondaryButton>
            </>
          )}
        </div>
        <div className="mt-4">
          <TextField label="Contact address for push services (mailto: or https URL)" value={push.subject || ""} onChange={(v) => patch("push", { subject: v })} placeholder="mailto:hello@yourgym.com" />
        </div>
        <div className="mt-4">
          <Toggle label="Send transactional notices by push" checked={tx.push !== false} onChange={(v) => patch("transactional", { push: v })} />
        </div>
      </Card>

      <Card className="p-6">
        <Heading title="WhatsApp button on the website" hint="A floating chat button visitors can tap to message you." />
        <Toggle label="Show the button" checked={!!btn.enabled} onChange={(v) => patch("whatsappButton", { enabled: v })} />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="WhatsApp number (with country code)" value={btn.number || ""} onChange={(v) => patch("whatsappButton", { number: v })} placeholder="+92 300 1234567" />
          <TextField label="Pre-filled message" value={btn.message || ""} onChange={(v) => patch("whatsappButton", { message: v })} placeholder="Hi! I'd like to know about memberships." />
        </div>
      </Card>

      <Card className="p-6">
        <Heading title="Automations" hint="Sent by the daily job to members who have not opted out of marketing. Edit the wording under Messaging → Wording." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="“We miss you” after this many days without a visit (0 = off)" type="number" value={String(auto.absentDays ?? 0)} onChange={(v) => patch("automations", { absentDays: Number(v) || 0 })} />
          <TextField label="“Come back” this many days after a membership lapses (0 = off)" type="number" value={String(auto.winBackDays ?? 0)} onChange={(v) => patch("automations", { winBackDays: Number(v) || 0 })} />
        </div>
        <div className="mt-4">
          <Toggle label="Birthday greeting" checked={!!auto.birthday} onChange={(v) => patch("automations", { birthday: v })} />
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryButton onClick={() => onSave()} disabled={saving}>
          {saving ? "Saving..." : "Save Messaging Settings"}
        </PrimaryButton>
      </div>
    </div>
  );
}
