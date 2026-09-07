"use client";

// Messaging: campaigns, announcements, the gym's wording for every message,
// the send log, and the state of each channel. Providers themselves are set
// up under Settings → Messaging.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, SecondaryButton, Badge } from "../_shared/ui";
import { apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { MESSAGING_API, CHANNEL_LABEL, type Channel, type ChannelsInfo } from "./shared";
import CampaignsPanel from "./CampaignsPanel";
import AnnouncementsPanel from "./AnnouncementsPanel";
import TemplatesPanel from "./TemplatesPanel";
import LogPanel from "./LogPanel";

type TabKey = "campaigns" | "announcements" | "wording" | "log" | "setup";
const TABS: { key: TabKey; label: string }[] = [
  { key: "campaigns", label: "Campaigns" },
  { key: "announcements", label: "Announcements" },
  { key: "wording", label: "Wording" },
  { key: "log", label: "Sent log" },
  { key: "setup", label: "Channels & automations" },
];

export default function MessagingAdminPage() {
  const { can } = usePermissions();
  const editable = can("messaging", "manage");
  const [tab, setTab] = useState<TabKey>("campaigns");
  const [channels, setChannels] = useState<ChannelsInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    try {
      const res = await apiGet<{ data: ChannelsInfo }>(`${MESSAGING_API}/channels`);
      setChannels(res.data);
    } catch {
      setChannels(null);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const runAutomations = async (dryRun: boolean) => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await apiJson<{ data: { absent: { enabled: boolean; sent: number }; winBack: { enabled: boolean; sent: number }; birthday: { enabled: boolean; sent: number } } }>(`${MESSAGING_API}/automations/run`, "POST", { dryRun });
      const d = res.data;
      const part = (label: string, r: { enabled: boolean; sent: number }) => `${label}: ${r.enabled ? `${r.sent} ${dryRun ? "would be sent" : "sent"}` : "off"}`;
      setRunResult([part("We miss you", d.absent), part("Win back", d.winBack), part("Birthdays", d.birthday)].join(" · "));
    } catch (e) {
      setRunResult(e instanceof Error ? e.message : "Could not run");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Customers" title="Messaging" />

      <div className="mb-6 border-b border-neutral-200">
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === t.key ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "campaigns" && <CampaignsPanel editable={editable} channels={channels} />}
      {tab === "announcements" && <AnnouncementsPanel editable={editable} />}
      {tab === "wording" && <TemplatesPanel editable={editable} />}
      {tab === "log" && <LogPanel editable={editable} channels={channels} />}

      {tab === "setup" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Channels</h2>
            <p className="mt-1 text-xs text-neutral-500">Where members can be reached. Providers are configured under Settings → Messaging.</p>
            <div className="mt-4 divide-y divide-neutral-100">
              {(["email", "sms", "whatsapp", "push"] as Channel[]).map((c) => {
                const on = channels ? channels.available[c] : false;
                const detail =
                  c === "sms" ? `provider: ${channels?.providers.sms || "none"}` : c === "whatsapp" ? `provider: ${channels?.providers.whatsapp || "none"}` : c === "push" ? `${channels?.push_devices ?? 0} device(s) subscribed` : "SMTP";
                return (
                  <div key={c} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{CHANNEL_LABEL[c]}</p>
                      <p className="text-xs text-neutral-500">
                        {detail}
                        {c !== "email" && channels && (
                          <> · transactional notices: {(c === "sms" && channels.transactional.sms) || (c === "whatsapp" && channels.transactional.whatsapp) || (c === "push" && channels.transactional.push) ? "on" : "off"}</>
                        )}
                      </p>
                    </div>
                    <Badge color={on ? "green" : "neutral"}>{on ? "Ready" : "Not set up"}</Badge>
                  </div>
                );
              })}
            </div>
            {can("settings", "manage") && (
              <div className="mt-4">
                <Link href="/admin/settings?tab=messaging" className="text-sm font-semibold text-neutral-900 underline">
                  Configure providers →
                </Link>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Automations</h2>
            <p className="mt-1 text-xs text-neutral-500">Run every day by the scheduled job. Wording under the Wording tab; switches under Settings → Messaging.</p>
            <div className="mt-4 divide-y divide-neutral-100 text-sm">
              <div className="flex items-center justify-between py-3">
                <span>We miss you — no visit for a while</span>
                <Badge color={channels?.automations.absentDays ? "green" : "neutral"}>{channels?.automations.absentDays ? `after ${channels.automations.absentDays} days` : "off"}</Badge>
              </div>
              <div className="flex items-center justify-between py-3">
                <span>Win back — membership lapsed</span>
                <Badge color={channels?.automations.winBackDays ? "green" : "neutral"}>{channels?.automations.winBackDays ? `after ${channels.automations.winBackDays} days` : "off"}</Badge>
              </div>
              <div className="flex items-center justify-between py-3">
                <span>Birthday greeting</span>
                <Badge color={channels?.automations.birthday ? "green" : "neutral"}>{channels?.automations.birthday ? "on" : "off"}</Badge>
              </div>
            </div>
            {editable && (
              <div className="mt-4 flex flex-wrap gap-2">
                <SecondaryButton onClick={() => runAutomations(true)} disabled={running}>
                  Preview today&apos;s run
                </SecondaryButton>
                <SecondaryButton onClick={() => runAutomations(false)} disabled={running}>
                  Run now
                </SecondaryButton>
              </div>
            )}
            {runResult && <p className="mt-3 text-xs text-neutral-600">{runResult}</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
