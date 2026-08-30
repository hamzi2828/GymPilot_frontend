"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiX, FiSlash, FiRefreshCw } from "react-icons/fi";
import {
  PageHeader,
  Card,
  PrimaryButton,
  SecondaryButton,
  TextField,
  SelectField,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";

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
  const [list, setList] = useState<Booking[]>([]);
  const [classes, setClasses] = useState<GymClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [date, setDate] = useState(todayKey());
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (classId) params.set("classId", classId);
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", "200");

      const r = await apiGet<{ data: Booking[] }>(`${GYMFOLIO_API}/bookings?${params}`);
      setList(r.data || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load bookings");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [date, classId, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiGet<{ data: GymClassOption[] }>(`${GYMFOLIO_API}/gym-classes`)
      .then((r) => setClasses(r.data || []))
      .catch(() => setClasses([]));
  }, []);

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
          <SecondaryButton onClick={load}>
            <FiRefreshCw className="w-3.5 h-3.5" /> Refresh
          </SecondaryButton>
        }
      />

      {err && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {err}
        </div>
      )}

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <TextField label="Date" type="date" value={date} onChange={setDate} />
          <SelectField
            label="Class"
            value={classId}
            onChange={setClassId}
            placeholder="All classes"
            options={classes.map((c) => ({ value: c._id, label: c.name }))}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            placeholder="Any status"
            options={[
              { value: "booked", label: "Booked" },
              { value: "waitlisted", label: "Waitlisted" },
              { value: "attended", label: "Attended" },
              { value: "no_show", label: "No show" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <TextField label="Search" value={search} onChange={setSearch} placeholder="Member, code or class…" />
        </div>
        <p className="mt-3 text-[12px] text-neutral-500">
          Clear the date to see every booking regardless of day.
        </p>
      </Card>

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
              {["booked", "waitlisted"].includes(b.status) && (
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
              {["attended", "no_show"].includes(b.status) && (
                <SecondaryButton onClick={() => mark(b, "booked")} disabled={busyId === b.id}>
                  Undo
                </SecondaryButton>
              )}
            </div>,
          ])}
          empty="No bookings for this filter."
        />
      )}
    </div>
  );
}
