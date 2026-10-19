"use client";

// Every face on file for face check-in at the Windows desk, and whose
// check-ins it opens. Faces are registered at the desk with the person's
// consent; this is where one registered to the wrong person -- or one the
// server can no longer read -- is taken off, to be registered again at the
// desk. Members can delete their own from their account page too.
//
// The desk keeps the numbers that describe a face, never a photo, and the
// server keeps them encrypted (the backend's attendance/controller/
// faceController.js). Removing one deletes it outright.

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
  Select2,
  useAsyncAction,
} from "../_shared/ui";
import { ATTENDANCE_API, ApiError, apiGet, apiJson } from "../_shared/api";

type PersonType = "member" | "staff";
type Show = "" | "unreadable" | "departed";

interface Face {
  person_type: PersonType;
  person_id: string;
  name: string;
  code: string;
  // Which record the person is: a User account, a Trainer, or none left.
  record?: "user" | "trainer" | null;
  // active: the desk matches them. inactive: switched off or no longer
  // staff, so the desk skips them. missing: the record is gone.
  status?: "active" | "inactive" | "missing";
  // How many pictures of the face went into what is on file.
  count: number;
  // False when the face key changed after it was registered: the desk can
  // never match it.
  readable?: boolean;
  enrolled_at: string | null;
  consent_at: string | null;
  enrolled_by_name: string;
  device?: string;
}

interface Summary {
  people: number;
  unreadable: number;
  departed: number;
}

interface ListResponse {
  people?: Face[];
  summary?: Summary;
  pagination?: { page: number; limit: number; total: number; pages: number };
}

const PAGE_SIZE = 25;

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function kindOf(face: Face): string {
  if (face.person_type === "member") return "Member";
  return face.record === "trainer" ? "Trainer" : "Staff";
}

function registeredLine(face: Face): string {
  const parts = [formatDate(face.enrolled_at), face.enrolled_by_name, face.device].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export default function FacesPage() {
  const { can } = usePermissions();
  // The list needs the attendance tab at view, removing needs it at manage --
  // the same gates the API applies.
  const allowed = can("attendance");
  const editable = can("attendance", "manage");

  const [faces, setFaces] = useState<Face[]>([]);
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
  const [pending, setPending] = useState<Face | null>(null);
  const removeAction = useAsyncAction();
  const removing = removeAction.busy;
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search.trim()) params.set("q", search.trim());
      if (type) params.set("person_type", type);
      if (show) params.set("show", show);
      const res = await apiGet<ListResponse>(`${ATTENDANCE_API}/faces?${params.toString()}`);
      const lastPage = res.pagination?.pages || 1;
      // Removing the last person on the last page leaves that page empty.
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      const list = Array.isArray(res.people) ? res.people : [];
      setFaces(list);
      setSummary(res.summary || null);
      setPages(lastPage);
      setTotal(res.pagination?.total ?? list.length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the faces on file");
    } finally {
      setLoading(false);
    }
  }, [allowed, page, search, type, show]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const ask = (face: Face) => {
    setRemoveError(null);
    setPending(face);
  };

  const close = () => {
    if (removing) return;
    setPending(null);
    setRemoveError(null);
  };

  const confirmRemove = () => removeAction.run(async () => {
    if (!pending) return;
    setRemoveError(null);
    try {
      const res = await apiJson<{ message?: string }>(`${ATTENDANCE_API}/faces/${pending.person_type}/${pending.person_id}`, "DELETE");
      setNotice(res.message || `Face removed for ${pending.name}.`);
      setPending(null);
      await load();
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "Could not remove the face");
      // Already gone -- someone else got there first, or the member deleted
      // it themselves. The list is stale.
      if (e instanceof ApiError && e.status === 404) load();
    }
  });

  if (!allowed) {
    return (
      <div>
        <PageHeader eyebrow="Operations" title="Faces on file" />
        <EmptyState
          title="You do not have access to this page"
          hint="Faces belong to the Attendance section. Ask an administrator to grant it under Roles & Access."
        />
      </div>
    );
  }

  const filtered = !!(search.trim() || type || show);

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Faces on file" />
      <p className="-mt-4 mb-6 max-w-3xl text-sm text-neutral-500">
        Everyone registered for face check-in at the front desk. The desk keeps numbers that describe a face, never a
        photo, and only with the person&rsquo;s consent. Remove a face registered to the wrong person, or one that can
        no longer be read, then register it again at the desk. Members can also delete their own from their account.
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
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            { label: "Faces on file", value: summary.people, tone: "text-neutral-900" },
            { label: "Unreadable", value: summary.unreadable, tone: summary.unreadable ? "text-rose-600" : "text-neutral-900" },
            { label: "Left or deleted", value: summary.departed, tone: summary.departed ? "text-amber-600" : "text-neutral-900" },
          ].map((tile) => (
            <Card key={tile.label} className="px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">{tile.label}</p>
              <p className={`mt-1 text-xl font-semibold ${tile.tone}`}>{tile.value ?? 0}</p>
            </Card>
          ))}
        </div>
      )}

      {summary && summary.unreadable > 0 && show !== "unreadable" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>
            {summary.unreadable === 1 ? "1 face on file can" : `${summary.unreadable} faces on file can`} no longer be
            read, so the desk can never match {summary.unreadable === 1 ? "it" : "them"}. Remove{" "}
            {summary.unreadable === 1 ? "it" : "them"} and register again at the desk.
          </span>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setShow("unreadable");
            }}
            disabled={loading}
            className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="w-48 max-w-full">
          <Select2
            ariaLabel="Who"
            value={type}
            onChange={(next) => {
              setPage(1);
              setType(next as "" | PersonType);
            }}
            options={[
              { value: "", label: "Members and staff" },
              { value: "member", label: "Members" },
              { value: "staff", label: "Staff" },
            ]}
          />
        </div>
        <div className="w-60 max-w-full">
          <Select2
            ariaLabel="Show"
            value={show}
            onChange={(next) => {
              setPage(1);
              setShow(next as Show);
            }}
            options={[
              { value: "", label: "Everyone on file" },
              { value: "unreadable", label: "Unreadable faces" },
              { value: "departed", label: "Left, switched off or deleted" },
            ]}
          />
        </div>
        {!loading && !error && <span className="text-xs text-neutral-500">{total} {total === 1 ? "person" : "people"}</span>}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !faces.length ? (
        filtered ? (
          <EmptyState title="No one matches" hint="Try another name or code, or clear the filters." />
        ) : (
          <EmptyState title="No faces on file" hint="Faces registered for face check-in at the front desk appear here." />
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["Person", "Face", "Registered", "Consent given", ...(editable ? [""] : [])].map((c, i) => (
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
                {faces.map((face) => (
                  <tr
                    key={`${face.person_type}:${face.person_id}`}
                    className="border-b border-neutral-100 align-top last:border-b-0 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-3.5">
                      <p className={`font-medium ${face.status === "missing" ? "text-neutral-500" : "text-neutral-900"}`}>{face.name}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{[face.code, kindOf(face)].filter(Boolean).join(" · ")}</p>
                      {face.status && face.status !== "active" && (
                        <div className="mt-1.5">
                          <Badge color="amber">{face.status === "missing" ? "Record deleted" : "Not matched at the desk"}</Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {face.readable === false ? <Badge color="rose">Unreadable</Badge> : <Badge color="green">On file</Badge>}
                        <span className="text-xs text-neutral-400">
                          {face.count} {face.count === 1 ? "picture" : "pictures"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-neutral-600">{registeredLine(face)}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-neutral-600">{formatDate(face.consent_at) || "—"}</td>
                    {editable && (
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <DangerButton onClick={() => ask(face)}>Remove</DangerButton>
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

      <Modal open={!!pending} onClose={close} title="Remove face" size="sm" busy={removing}>
        {pending && (
          <div>
            <p className="text-sm text-neutral-800">
              Remove the face on file for <strong>{pending.name}</strong>?
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-neutral-500">
              <li>Front desks stop recognising them at their next refresh, within a few minutes.</li>
              <li>They can still check in with a fingerprint, the desk code on their phone, or by staff.</li>
              <li>This cannot be undone: the stored face is deleted, not hidden. Register it again at the desk, with their consent.</li>
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
              <DangerButton onClick={confirmRemove} loading={removing}>
                Remove face
              </DangerButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
