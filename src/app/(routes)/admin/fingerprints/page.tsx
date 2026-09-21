"use client";

// Every fingerprint on file, and whose check-ins each one opens. The front
// desk can link a finger but never unlink one, so this is where a finger
// linked to the wrong person -- or one the server can no longer read -- is
// taken off, to be registered again at the desk.
//
// Removing a finger leaves the person's consent as it was (see the backend's
// attendance/controller/fingerprintAdminController.js): the usual next step
// is registering the right finger straight away.

import { useCallback, useEffect, useState } from "react";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import {
  PageHeader,
  Card,
  Badge,
  Spinner,
  EmptyState,
  ErrorState,
  Pager,
  Modal,
  SecondaryButton,
  DangerButton,
} from "../_shared/ui";
import { ATTENDANCE_API, ApiError, apiGet, apiJson } from "../_shared/api";

type PersonType = "member" | "staff";
type Show = "" | "unreadable" | "departed";

interface Finger {
  finger_index: number;
  finger_name: string;
  readable: boolean;
  active: boolean;
  enrolled_at: string | null;
  enrolled_by: string;
  device: string;
}

interface Person {
  person_type: PersonType;
  person_id: string;
  name: string;
  code: string;
  // Which record the person is: a User account, a Trainer, or none left.
  record: "user" | "trainer" | null;
  // active: the desk matches them. inactive: switched off or no longer
  // staff, so the desk skips their fingers. missing: the record is gone.
  status: "active" | "inactive" | "missing";
  unreadable: number;
  fingers: Finger[];
}

interface Summary {
  people: number;
  fingers: number;
  unreadable: number;
  departed: number;
}

interface ListResponse {
  people?: Person[];
  summary?: Summary;
  pagination?: { page: number; limit: number; total: number; pages: number };
}

// What the confirmation is about. `finger` null means every finger.
interface Pending {
  person: Person;
  finger: Finger | null;
}

const PAGE_SIZE = 25;

const selectCls = "h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700";

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function kindOf(person: Person): string {
  if (person.person_type === "member") return "Member";
  return person.record === "trainer" ? "Trainer" : "Staff";
}

function registeredLine(finger: Finger): string {
  const parts = [formatDate(finger.enrolled_at), finger.enrolled_by, finger.device].filter(Boolean);
  return parts.length ? `Registered ${parts.join(" · ")}` : "";
}

export default function FingerprintsPage() {
  const { can } = usePermissions();
  // Not in the layout's route map, so the page checks its own tab: the list
  // needs attendance at view, removing needs it at manage -- the same gates
  // the API applies.
  const allowed = can("attendance");
  const editable = can("attendance", "manage");

  const [people, setPeople] = useState<Person[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | PersonType>("");
  const [show, setShow] = useState<Show>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search.trim()) params.set("q", search.trim());
      if (type) params.set("person_type", type);
      if (show) params.set("show", show);
      const res = await apiGet<ListResponse>(`${ATTENDANCE_API}/fingerprints?${params.toString()}`);
      const lastPage = res.pagination?.pages || 1;
      // Removing the last person on the last page leaves that page empty.
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setPeople(res.people || []);
      setSummary(res.summary || null);
      setPages(lastPage);
      setTotal(res.pagination?.total || 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the fingerprints on file");
    } finally {
      setLoading(false);
    }
  }, [allowed, page, search, type, show]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const ask = (person: Person, finger: Finger | null) => {
    setRemoveError(null);
    setPending({ person, finger });
  };

  const close = () => {
    if (removing) return;
    setPending(null);
    setRemoveError(null);
  };

  const confirmRemove = async () => {
    if (!pending) return;
    const { person, finger } = pending;
    setRemoving(true);
    setRemoveError(null);
    // The finger goes in the path rather than the query: the audit trail
    // keeps the path, and should say which finger went.
    const url =
      `${ATTENDANCE_API}/fingerprints/${person.person_type}/${person.person_id}` +
      (finger ? `/${finger.finger_index}` : "");
    try {
      const res = await apiJson<{ message?: string }>(url, "DELETE");
      setPending(null);
      setNotice(res.message || "Fingerprint removed.");
      await load();
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "Could not remove the fingerprint");
      // Already gone -- someone else got there first. The list is stale.
      if (e instanceof ApiError && e.status === 404) load();
    } finally {
      setRemoving(false);
    }
  };

  if (!allowed) {
    return (
      <div>
        <PageHeader eyebrow="Operations" title="Fingerprints" />
        <EmptyState
          title="You do not have access to this page"
          hint="Fingerprints belong to the Attendance section. Ask an administrator to grant it under Roles & Access."
        />
      </div>
    );
  }

  const filtered = !!(search.trim() || type || show);
  const pendingName = pending ? pending.person.name : "";
  const pendingCount = pending ? (pending.finger ? 1 : pending.person.fingers.length) : 0;

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Fingerprints" />
      <p className="-mt-4 mb-6 max-w-3xl text-sm text-neutral-500">
        Every finger registered at the front desk, and whose check-ins it opens. Remove a finger that was
        linked to the wrong person, or one that can no longer be read, then register it again at the desk.
        Consent records are left as they are.
      </p>

      {notice && (
        <div
          role="status"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="shrink-0 text-emerald-700">
            ✕
          </button>
        </div>
      )}

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "People", value: summary.people, tone: "text-neutral-900" },
            { label: "Fingers on file", value: summary.fingers, tone: "text-neutral-900" },
            { label: "Unreadable", value: summary.unreadable, tone: summary.unreadable ? "text-rose-600" : "text-neutral-900" },
            { label: "Left or deleted", value: summary.departed, tone: summary.departed ? "text-amber-600" : "text-neutral-900" },
          ].map((tile) => (
            <Card key={tile.label} className="px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">{tile.label}</p>
              <p className={`mt-1 text-xl font-semibold ${tile.tone}`}>{tile.value}</p>
            </Card>
          ))}
        </div>
      )}

      {summary && summary.unreadable > 0 && show !== "unreadable" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>
            {summary.unreadable === 1 ? "1 finger on file can" : `${summary.unreadable} fingers on file can`} no longer
            be read — the fingerprint key changed after they were registered, so the desk can never match them.
            Remove them and register those fingers again.
          </span>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setShow("unreadable");
            }}
            className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            Show them
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search by name, code, email or phone…"
          aria-label="Search"
          className="h-9 w-72 max-w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-neutral-400 focus:outline-none"
        />
        <select
          value={type}
          onChange={(e) => {
            setPage(1);
            setType(e.target.value as "" | PersonType);
          }}
          aria-label="Who"
          className={selectCls}
        >
          <option value="">Members and staff</option>
          <option value="member">Members</option>
          <option value="staff">Staff</option>
        </select>
        <select
          value={show}
          onChange={(e) => {
            setPage(1);
            setShow(e.target.value as Show);
          }}
          aria-label="Show"
          className={selectCls}
        >
          <option value="">Everyone on file</option>
          <option value="unreadable">Unreadable fingers</option>
          <option value="departed">Left, switched off or deleted</option>
        </select>
        {!loading && !error && <span className="text-xs text-neutral-500">{total} {total === 1 ? "person" : "people"}</span>}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !people.length ? (
        filtered ? (
          <EmptyState title="No one matches" hint="Try another name or code, or clear the filters." />
        ) : (
          <EmptyState title="No fingerprints on file" hint="Fingers registered at the front desk appear here." />
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["Person", "Fingers on file", ...(editable ? [""] : [])].map((c, i) => (
                    <th
                      key={c || `col-${i}`}
                      className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr
                    key={`${person.person_type}:${person.person_id}`}
                    className="border-b border-neutral-100 align-top last:border-b-0 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-3.5">
                      <p className={`font-medium ${person.status === "missing" ? "text-neutral-500" : "text-neutral-900"}`}>
                        {person.name}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {[person.code, kindOf(person)].filter(Boolean).join(" · ")}
                      </p>
                      {person.status !== "active" && (
                        <div className="mt-1.5">
                          <Badge color="amber">
                            {person.status === "missing" ? "Record deleted" : "Not matched at the desk"}
                          </Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <ul className="space-y-2">
                        {person.fingers.map((finger) => (
                          <li key={finger.finger_index} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-neutral-800">{finger.finger_name}</span>
                            {finger.readable ? (
                              <Badge color="green">Readable</Badge>
                            ) : (
                              <Badge color="rose">Unreadable</Badge>
                            )}
                            {!finger.active && <Badge>Inactive</Badge>}
                            <span className="text-xs text-neutral-400">{registeredLine(finger)}</span>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => ask(person, finger)}
                                className="text-xs font-semibold text-rose-600 underline-offset-2 hover:underline"
                              >
                                Remove finger
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                    {editable && (
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        {person.fingers.length > 1 && (
                          <DangerButton onClick={() => ask(person, null)}>Remove all</DangerButton>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && !error && <Pager page={page} pages={pages} total={total} onChange={setPage} />}

      <Modal
        open={!!pending}
        onClose={close}
        title={pending && !pending.finger ? "Remove all fingerprints" : "Remove fingerprint"}
        size="sm"
      >
        {pending && (
          <div>
            <p className="text-sm text-neutral-800">
              {pending.finger ? (
                <>
                  Remove <strong>{pendingName}</strong>&rsquo;s {pending.finger.finger_name.toLowerCase()}?
                </>
              ) : (
                <>
                  Remove all {pendingCount} fingerprints on file for <strong>{pendingName}</strong>?
                </>
              )}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-neutral-500">
              <li>
                Front desks stop recognising {pendingCount === 1 ? "it" : "them"} at their next refresh, within a few
                minutes.
              </li>
              <li>Consent records are left as they are, so the right finger can be registered at the desk straight away.</li>
              <li>This cannot be undone: the stored template is deleted, not hidden.</li>
            </ul>
            {removeError && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                {removeError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton onClick={close} disabled={removing}>
                Cancel
              </SecondaryButton>
              <DangerButton onClick={confirmRemove} disabled={removing}>
                {removing ? "Removing…" : pending.finger ? "Remove finger" : "Remove all"}
              </DangerButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
