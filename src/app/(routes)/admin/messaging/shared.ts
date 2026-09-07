// Types and helpers shared by the Messaging panels.

import { API_BASE } from "../_shared/api";

export const MESSAGING_API = `${API_BASE}/admin/messaging`;

export type Channel = "email" | "sms" | "whatsapp" | "push";
export const CHANNEL_LABEL: Record<Channel, string> = { email: "Email", sms: "SMS", whatsapp: "WhatsApp", push: "Push" };

export interface ChannelsInfo {
  available: Record<Channel, boolean>;
  providers: { sms: string; whatsapp: string };
  transactional: { sms: boolean; whatsapp: boolean; push: boolean };
  push_devices: number;
  automations: { absentDays: number; winBackDays: number; birthday: boolean };
}

export type AudienceType = "all_members" | "active_members" | "expiring_members" | "expired_members" | "newsletter" | "tags" | "leads";
export const AUDIENCE_LABEL: Record<AudienceType, string> = {
  all_members: "All members",
  active_members: "Members with a live membership",
  expiring_members: "Memberships ending soon",
  expired_members: "Lapsed members",
  newsletter: "Newsletter subscribers",
  tags: "Members with a tag",
  leads: "Leads (enquiries not yet joined)",
};

export interface Campaign {
  id: string;
  title: string;
  channel: Channel;
  audience: { type: AudienceType; tags: string[]; days: number };
  subject: string;
  body: string;
  url: string;
  status: "draft" | "sending" | "sent" | "failed";
  stats: { targeted: number; sent: number; failed: number; skipped: number };
  started_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "members" | "public" | "all";
  tone: "info" | "success" | "warning";
  url: string;
  url_label: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

export interface TemplateEvent {
  key: string;
  label: string;
  group: string;
  variables: string[];
  default_subject: string;
  default_body: string;
  default_text: string;
  built_in_email: boolean;
  custom: { subject: string; body: string; text: string; enabled: boolean; updated_at: string } | null;
}

export interface LogRow {
  id: string;
  channel: Channel;
  to: string;
  user_id: string | null;
  subject: string;
  body: string;
  context: string;
  campaign_id: string | null;
  status: "sent" | "failed" | "skipped";
  error: string;
  provider: string;
  created_at: string;
}

export function when(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function dateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}
