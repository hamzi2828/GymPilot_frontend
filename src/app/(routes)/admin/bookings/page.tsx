"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiX, FiSlash, FiRefreshCw, FiPlus } from "react-icons/fi";
import {
  PageHeader,
  Card,
  PrimaryButton,
  SecondaryButton,
  Modal,
  TextField,
  SelectField,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { MemberPicker, type MemberOption } from "../_ops/MemberPicker";
import { Pager, pageCount } from "../_ops/lists";

interface Booking {
  id: string;
  class_id: string;
  class_name: string;
  member_name: string;
  member_code: string;
  date: string;
  start_time: string;
  end_time: string;
  instructor_name: string;
  status: "booked" | "waitlisted" | "cancelled" | "attended" | "no_show";
  waitlist_position: number | null;
  membership_status: "active" | "expired" | "none";
  booked_by: "member" | "staff";
  notes: string;
}

interface GymClassOption {
  _id: string;
  name: string;
}

// One session from the timetable, as /timetable expands it.
interface SessionOption {
  class_id: string;
  class_name: string;
  date: string;
  start_time: string;
  end_time: string;
  instructor_name: string;
  capacity: number;
  booked_count: number;
  waitlist_count: number;
  is_full: boolean;
  is_closed: boolean;
  is_cancelled: boolean;
}

// The API's ceiling per page. A day's roster normally fits in one, so the
// counts above the table stay whole-day figures unless it really is bigger.
const PAGE_SIZE = 200;

const STATUS_TONE: Record<Booking["status"], "green" | "amber" | "rose" | "neutral"> = {
  booked: "green",
  attended: "green",
  waitlisted: "amber",
  cancelled: "neutral",
  no_show: "rose",
};

const STATUS_LABEL: Record<Booking["status"], string> = {
  booked: "Booked",
  attended: "Attended",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
  no_show: "No show",
};

// Today in the gym's terms. The API files sessions against a local date key,
// so the filter has to start from the same idea of "today" the server has.
const todayKey = () => new Date().toISOString().slice(0, 10);

export default function BookingsAdminPage() {
  const { can } = usePermissions();
  const editable = can("bookings", "manage");
  const [list, setList] = useState<Booking[]>([]);
  const [classes, setClasses] = useState<GymClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [date, setDate] = useState(todayKey());
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  // Booking a member in from the desk.
  const [bookOpen, setBookOpen] = useState(false);
  const [bookDate, setBookDate] = useState(todayKey());
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState("");
  const [member, setMember] = useState<MemberOption | null>(null);
  const [bookNotes, setBookNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookErr, setBookErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (classId) params.set("classId", classId);
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));

      const r = await apiGet<{ data: Booking[]; pagination?: { total?: number; pages?: number; limit?: number } }>(
        `${GYMFOLIO_API}/bookings?${params}`
      );
      setList(r.data || []);
      setPages(pageCount(r.pagination));
      setTotal(r.pagination?.total ?? (r.data || []).length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load bookings");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [date, classId, status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // A new filter starts again from the first page.
  const filterBy = (set: (v: string) => void) => (v: string) => {
    setPage(1);
    set(v);
  };

  // Every class, not the endpoint's default twenty. Without the Classes tab
  // the public list of running classes stands in.
  useEffect(() => {
    apiGet<{ data: GymClassOption[] }>(`${GYMFOLIO_API}/gym-classes?limit=500`)
      .catch(() => apiGet<{ data: GymClassOption[] }>(`${GYMFOLIO_API}/gym-classes/active`))
      .then((r) => setClasses(r.data || []))
      .catch(() => setClasses([]));
  }, []);

  // The sessions running on the chosen day, with how full each one is.
  useEffect(() => {
    if (!bookOpen || !bookDate) return;
    let cancelled = false;
    setSessionsLoading(true);
    apiGet<{ data: SessionOption[] }>(`${GYMFOLIO_API}/timetable?from=${bookDate}&to=${bookDate}`)
      .then((r) => {
        if (!cancelled) setSessions((r.data || []).filter((s) => s.date === bookDate && !s.is_cancelled && !s.is_closed));
      })
      .catch((e) => {
        if (!cancelled) {
          setSessions([]);
          setBookErr(e instanceof Error ? e.message : "Could not load the timetable");
        }
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookOpen, bookDate]);

  const keyOf = (s: SessionOption) => `${s.class_id}|${s.start_time}`;
  const chosenSession = sessions.find((s) => keyOf(s) === sessionKey) || null;

  const openBook = () => {
    setBookDate(date || todayKey());
    setSessionKey("");
    setMember(null);
    setBookNotes("");
    setBookErr(null);
    setBookOpen(true);
  };

  const bookMember = async () => {
    if (!chosenSession || !member) return;
    setBooking(true);
    setBookErr(null);
    try {
      const res = await apiJson<{ message: string; membership_warning?: string | null }>(`${GYMFOLIO_API}/bookings/staff`, "POST", {
        classId: chosenSession.class_id,
        date: chosenSession.date,
        startTime: chosenSession.start_time,
        userId: member.id,
        notes: bookNotes.trim() || undefined,
      });
      // The server words it for the member ("you are number 2 on the waiting
      // list"); the desk also needs to hear about a lapsed membership.
      setNotice(`${member.name}: ${res.message}${res.membership_warning ? ` Note: ${res.membership_warning}` : ""}`);
      setBookOpen(false);
      await load();
    } catch (e) {
      setBookErr(e instanceof Error ? e.message : "Could not book this class");
    } finally {
      setBooking(false);
    }
  };

  const mark = async (booking: Booking, next: "attended" | "no_show" | "booked") => {
    setBusyId(booking.id);
    try {
      await apiJson(`${GYMFOLIO_API}/bookings/${booking.id}/status`, "PATCH", { status: next });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update the booking");
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (booking: Booking) => {
    setBusyId(booking.id);
    try {
      // The staff variant, which is what allows cancelling somebody else's
      // place and promotes whoever is at the front of the waiting list.
      await apiJson(`${GYMFOLIO_API}/bookings/staff/${booking.id}`, "DELETE");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not cancel the booking");
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    booked: list.filter((b) => b.status === "booked").length,
    attended: list.filter((b) => b.status === "attended").length,
    waitlisted: list.filter((b) => b.status === "waitlisted").length,
    noShow: list.filter((b) => b.status === "no_show").length,
    lapsed: list.filter(
      (b) => b.membership_status !== "active" && ["booked", "waitlisted", "attended"].includes(b.status)
    ).length,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Fitness"
        title="Bookings"
        actions={
          <>
            <SecondaryButton onClick={load}>
              <FiRefreshCw className="w-3.5 h-3.5" /> Refresh
            </SecondaryButton>
            {editable && (
              <PrimaryButton onClick={openBook}>
                <FiPlus className="w-4 h-4 mr-1.5" /> Book a member
              </PrimaryButton>
            )}
          </>
        }
      />

      {err && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {err}
        </div>
      )}

      {notice && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <TextField label="Date" type="date" value={date} onChange={filterBy(setDate)} />
          <SelectField
            label="Class"
            value={classId}
            onChange={filterBy(setClassId)}
            placeholder="All classes"
            options={classes.map((c) => ({ value: c._id, label: c.name }))}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={filterBy(setStatus)}
            placeholder="Any status"
            options={[
              { value: "booked", label: "Booked" },
              { value: "waitlisted", label: "Waitlisted" },
              { value: "attended", label: "Attended" },
              { value: "no_show", label: "No show" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <TextField label="Search" value={search} onChange={filterBy(setSearch)} placeholder="Member, code or class…" />
        </div>
        <p className="mt-3 text-[12px] text-neutral-500">
          Clear the date to see every booking regardless of day.
        </p>
      </Card>

      {!loading && list.length > 0 && pages > 1 && (
        <p className="mb-2 text-[12px] text-neutral-500">Counts below are for this page of {total} bookings.</p>
      )}
      {!loading && list.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Booked", value: counts.booked },
            { label: "Attended", value: counts.attended },
            { label: "Waitlisted", value: counts.waitlisted },
            { label: "No shows", value: counts.noShow },
            { label: "Lapsed members", value: counts.lapsed },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["Member", "Class", "When", "Status", "Membership", "Actions"]}
          rows={list.map((b) => [
            <div key="m">
              <p className="font-medium text-neutral-900">{b.member_name}</p>
              <p className="text-[12px] text-neutral-500">
                {b.member_code || "—"}
                {b.booked_by === "staff" && " · booked at the desk"}
              </p>
            </div>,
            <div key="c">
              <p className="text-neutral-900">{b.class_name}</p>
              {b.instructor_name && (
                <p className="text-[12px] text-neutral-500">{b.instructor_name}</p>
              )}
            </div>,
            <div key="w">
              <p className="text-neutral-900">{b.date}</p>
              <p className="text-[12px] text-neutral-500">
                {b.start_time}
                {b.end_time ? `–${b.end_time}` : ""}
              </p>
            </div>,
            <Badge key="s" color={STATUS_TONE[b.status]}>
              {STATUS_LABEL[b.status]}
              {b.status === "waitlisted" && b.waitlist_position ? ` #${b.waitlist_position}` : ""}
            </Badge>,
            // Shown because a lapsed member holding a place is exactly the
            // thing the desk should act on while they are still standing there.
            b.membership_status === "active" ? (
              <span key="ms" className="text-[12px] text-neutral-500">
                Active
              </span>
            ) : (
              <Badge key="ms" color="rose">
                {b.membership_status === "expired" ? "Expired" : "None"}
              </Badge>
            ),
            <div key="a" className="flex flex-wrap gap-1.5">
              {editable && ["booked", "waitlisted"].includes(b.status) && (
                <>
                  <SecondaryButton onClick={() => mark(b, "attended")} disabled={busyId === b.id}>
                    <FiCheck className="w-3.5 h-3.5" /> Attended
                  </SecondaryButton>
                  <SecondaryButton onClick={() => mark(b, "no_show")} disabled={busyId === b.id}>
                    <FiSlash className="w-3.5 h-3.5" /> No show
                  </SecondaryButton>
                  <SecondaryButton onClick={() => cancel(b)} disabled={busyId === b.id}>
                    <FiX className="w-3.5 h-3.5" /> Cancel
                  </SecondaryButton>
                </>
              )}
              {editable && ["attended", "no_show"].includes(b.status) && (
                <SecondaryButton onClick={() => mark(b, "booked")} disabled={busyId === b.id}>
                  Undo
                </SecondaryButton>
              )}
            </div>,
          ])}
          empty="No bookings for this filter."
        />
      )}

      <Pager page={page} pages={pages} total={total} onChange={setPage} disabled={loading} />

      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title="Book a member into a class" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Date"
              type="date"
              value={bookDate}
              onChange={(v) => {
                setBookDate(v);
                setSessionKey("");
                setBookErr(null);
              }}
            />
            <SelectField
              label="Session"
              value={sessionKey}
              allowClear={false}
              onChange={setSessionKey}
              placeholder={sessionsLoading ? "Loading…" : sessions.length ? "Choose a session" : "No sessions that day"}
              options={sessions.map((s) => ({
                value: keyOf(s),
                label: `${s.start_time}${s.end_time ? `–${s.end_time}` : ""} · ${s.class_name}`,
                hint: [
                  s.instructor_name,
                  s.capacity ? `${s.booked_count}/${s.capacity} booked` : `${s.booked_count} booked`,
                  s.is_full ? `full, ${s.waitlist_count} waiting` : "",
                ]
                  .filter(Boolean)
                  .join(" · "),
              }))}
            />
          </div>
          {!sessionsLoading && !sessions.length && (
            <p className="text-xs text-neutral-500">
              Nothing bookable that day — sessions that have started, been cancelled, or fall beyond the booking window are not listed.
            </p>
          )}
          {chosenSession?.is_full && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This session is full. The member goes on the waiting list at number {chosenSession.waitlist_count + 1} and is moved up automatically if a place comes free.
            </p>
          )}
          <MemberPicker label="Member" type="member" value={member} onChange={setMember} listWhenEmpty />
          <TextField label="Notes (optional)" value={bookNotes} onChange={setBookNotes} />
          {bookErr && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{bookErr}</p>}
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setBookOpen(false)} disabled={booking}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={bookMember} disabled={booking || !chosenSession || !member}>
              {booking ? "Booking…" : chosenSession?.is_full ? "Add to waiting list" : "Book"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
