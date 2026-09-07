// Personal training calls for the member-facing pages.

import { getAuthToken } from "@/helper/helper";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const PT_API = `${API_BASE}/api/gymfolio/pt`;

export interface PtTrainer {
  id: string;
  name: string;
  slug: string;
  role: string;
  image: string;
  specialties: string[];
  experience: number;
  rate: number;
  has_availability: boolean;
}

export interface PtRules {
  slot_minutes: number;
  allow_member_booking: boolean;
  require_pack: boolean;
  cancel_hours: number;
}

export interface PtSlot {
  date: string;
  start_time: string;
  end_time: string;
  available: boolean;
}

export interface PtSession {
  id: string;
  trainer_id: string;
  trainer_name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  credit_used: boolean;
  price: number;
  currency: string;
  late_cancel: boolean;
  notes: string;
}

export interface PtPack {
  order_id: string;
  name: string;
  total: number;
  used: number;
  left: number;
  ends_at: string | null;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function readOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || fallback);
  return body as T;
}

export async function getPtTrainers() {
  const res = await fetch(`${PT_API}/trainers`);
  return readOrThrow<{ rules: PtRules; data: PtTrainer[] }>(res, "Could not load trainers");
}

export async function getPtAvailability(trainerId: string, from: string, to: string) {
  const qs = new URLSearchParams({ trainerId, from, to });
  const res = await fetch(`${PT_API}/availability?${qs}`, { headers: authHeaders() });
  const body = await readOrThrow<{ data: PtSlot[] }>(res, "Could not load availability");
  return body.data || [];
}

export async function bookPtSession(input: { trainerId: string; date: string; startTime: string; notes?: string }) {
  const res = await fetch(`${PT_API}/sessions`, { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(input) });
  return readOrThrow<{ message: string; data: PtSession }>(res, "Could not book the session");
}

export async function getMyPtSessions(scope: "upcoming" | "past" = "upcoming") {
  const res = await fetch(`${PT_API}/sessions/me?scope=${scope}`, { headers: authHeaders() });
  return readOrThrow<{ data: PtSession[]; pack: PtPack | null; assigned_trainer: { id: string; name: string; slug: string; image: string; role: string } | null }>(res, "Could not load your sessions");
}

export async function cancelPtSession(id: string, reason = "") {
  const res = await fetch(`${PT_API}/sessions/${id}`, { method: "DELETE", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ reason }) });
  return readOrThrow<{ message: string }>(res, "Could not cancel the session");
}
