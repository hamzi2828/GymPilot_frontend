"use client";

// The week's roster: who is on which shift each day, with approved leave
// shown where a shift would have been. Shifts themselves are edited on each
// staff member's record.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, SecondaryButton, Spinner, ErrorState } from "../../_shared/ui";
import { API_BASE, apiGet } from "../../_shared/api";
import { useGymToday } from "@/components/ThemeProvider";

interface Day {
  date: string;
  weekday: string;
  shifts: { staff_id: string; name: string; job_title: string; start_time: string; end_time: string }[];
  off: { staff_id: string; name: string; type: string }[];
}

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const startOfWeek = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(key, -((dow + 6) % 7));
};

export default function RosterPage() {
  const today = useGymToday();
  const [from, setFrom] = useState(startOfWeek(today()));
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: Day[] }>(`${API_BASE}/staff/roster?from=${from}&to=${addDays(from, 6)}`);
      setDays(r.data || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the roster");
    } finally {
      setLoading(false);
    }
  }, [from]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Roster"
        actions={
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setFrom(addDays(from, -7))}>← Previous week</SecondaryButton>
            <SecondaryButton onClick={() => setFrom(startOfWeek(today()))}>This week</SecondaryButton>
            <SecondaryButton onClick={() => setFrom(addDays(from, 7))}>Next week →</SecondaryButton>
          </div>
        }
      />
      <p className="mb-4 text-sm text-neutral-600">
        Week of {from}. Shifts come from each person&apos;s record under <Link href="/admin/staff" className="underline">Staff</Link>; approved <Link href="/admin/staff/leave" className="underline">leave</Link> is shown in its place.
      </p>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {days.map((day) => (
            <Card key={day.date} className={`p-3 ${day.date === today() ? "ring-2 ring-neutral-900" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{day.weekday.slice(0, 3)}</p>
              <p className="text-sm font-semibold text-neutral-900">{day.date.slice(5)}</p>
              <div className="mt-3 space-y-2">
                {day.shifts.length === 0 && day.off.length === 0 && <p className="text-xs text-neutral-400">Nobody rostered</p>}
                {day.shifts.map((s, i) => (
                  <div key={i} className="rounded-lg bg-neutral-50 px-2 py-1.5">
                    <p className="text-xs font-medium text-neutral-900">{s.name}</p>
                    <p className="text-[11px] text-neutral-500">
                      {s.start_time}–{s.end_time}
                      {s.job_title ? ` · ${s.job_title}` : ""}
                    </p>
                  </div>
                ))}
                {day.off.map((o, i) => (
                  <div key={`off-${i}`} className="rounded-lg bg-amber-50 px-2 py-1.5">
                    <p className="text-xs font-medium text-amber-900">{o.name}</p>
                    <p className="text-[11px] text-amber-700">{o.type} leave</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
