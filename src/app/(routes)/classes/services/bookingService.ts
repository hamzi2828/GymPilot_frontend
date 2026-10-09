// Booking and timetable calls for the member-facing pages.
//
// Sessions are not stored on the server — a class carries a weekly template
// and the API expands it over a date range — so a session is identified by the
// triple (classId, date, startTime) rather than by an id of its own.

import { getAuthToken } from "@/helper/helper";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const GYMFOLIO_API = `${API_BASE}/api/gymfolio`;

export interface ClassSession {
  class_id: string;
  class_name: string;
  class_slug: string;
  date: string;
  weekday: string;
  start_time: string;
  end_time: string;
  instructor_name: string;
  room: string;
  // A one-off change to this session (Admin → Timetable changes).
  is_cancelled: boolean;
  is_substitute: boolean;
  change_note: string;
  capacity: number;
  duration_minutes: number | null;
  difficulty: string;
  starts_at: string;
  booked_count: number;
  waitlist_count: number;
  spots_left: number;
  is_full: boolean;
  is_closed: boolean;
  can_book: boolean;
  my_booking: { id: string; status: string; waitlist_position: number | null } | null;
}

export interface MyBooking {
  id: string;
  class_id: string;
  class_name: string;
  date: string;
  start_time: string;
  end_time: string;
  instructor_name: string;
  status: "booked" | "waitlisted" | "cancelled" | "attended" | "no_show";
  waitlist_position: number | null;
  membership_status: "active" | "expired" | "none";
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

/** The gym's booking policy, as the timetable reports it. */
export interface BookingRules {
  horizon_days: number;
  cutoff_minutes: number;
  // Cancelling later than this many hours before the start is a late
  // cancellation: the place is freed but a session credit stays used.
  cancel_hours: number;
  require_active_membership: boolean;
  use_credits: boolean;
}

/**
 * The whole timetable. Signed in, each session also reports whether this
 * member already holds a place — which is why the token is sent even though
 * the endpoint is public.
 */
export async function getTimetable(params: { from?: string; to?: string; classId?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.classId) qs.set("classId", params.classId);

  const res = await fetch(`${GYMFOLIO_API}/timetable?${qs}`, { headers: authHeaders() });
  const body = await readOrThrow<{ data: ClassSession[]; range: { from: string; to: string }; rules?: BookingRules }>(
    res,
    "Could not load the timetable"
  );
  return body;
}

/** Sessions for one class only — used on the class detail page. */
export async function getClassSessions(classId: string, params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);

  const res = await fetch(`${GYMFOLIO_API}/gym-classes/${classId}/sessions?${qs}`, {
    headers: authHeaders(),
  });
  const body = await readOrThrow<{ data: ClassSession[] }>(res, "Could not load sessions");
  return body.data || [];
}

export async function bookSession(input: { classId: string; date: string; startTime: string }) {
  const res = await fetch(`${GYMFOLIO_API}/bookings`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return readOrThrow<{ message: string; membership_warning: string | null; data: MyBooking }>(
    res,
    "Could not book this class"
  );
}

export async function cancelBooking(bookingId: string) {
  const res = await fetch(`${GYMFOLIO_API}/bookings/${bookingId}`, {
    method: "DELETE",
    headers: authHeaders({ "Content-Type": "application/json" }),
  });
  return readOrThrow<{ message: string }>(res, "Could not cancel this booking");
}

export async function getMyBookings(scope: "upcoming" | "past" | "all" = "upcoming") {
  const res = await fetch(`${GYMFOLIO_API}/bookings/me?scope=${scope}`, {
    headers: authHeaders(),
  });
  const body = await readOrThrow<{ data: MyBooking[] }>(res, "Could not load your bookings");
  return body.data || [];
}
