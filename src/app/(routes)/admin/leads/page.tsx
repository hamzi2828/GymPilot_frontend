"use client";

// Leads: enquiries worked through a short pipeline until they join (or
// don't). Website enquiries land here automatically; walk-ins and calls are
// added by hand.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiPlus } from "react-icons/fi";
import { PageHeader, Card, PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, TextArea, SelectField, Badge, Spinner, ErrorState, Pager } from "../_shared/ui";
import { API_BASE, apiGet, apiJson, replaceParams } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";

const LEADS_API = `${API_BASE}/admin/leads`;
// Leads per page of the board, in the API's order (by follow-up date, then
// newest). Search runs on the server, so it reaches every page.
const PAGE_SIZE = 200;

type Status = "new" | "contacted" | "trial" | "won" | "lost";
const STATUSES: { key: Status; label: string; hint: string }[] = [
  { key: "new", label: "New", hint: "Not yet spoken to" },
  { key: "contacted", label: "Contacted", hint: "In conversation" },
  { key: "trial", label: "Trial", hint: "Booked or had a trial" },
  { key: "won", label: "Joined", hint: "Became a member" },
  { key: "lost", label: "Lost", hint: "Did not join" },
];
const SOURCES = [
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "social", label: "Social media" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
];

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: Status;
  interest: string;
  assigned_to: string | null;
  assigned_name: string;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  notes: { id: string; text: string; by_name: string; at: string }[];
  tags: string[];
  lost_reason: string;
  converted_user_id: string | null;
  created_at: string;
}

// The shape GET /staff returns (staffController shapeStaff): `id` and a
// ready-joined `name`, not the raw user document.
interface StaffOption {
  id: string;
  name: string;
  email: string;
}

type Draft = { firstName: string; lastName: string; email: string; phone: string; source: string; interest: string; nextFollowUpAt: string; assignedTo: string; tags: string };
const emptyDraft: Draft = { firstName: "", lastName: "", email: "", phone: "", source: "walk_in", interest: "", nextFollowUpAt: "", assignedTo: "", tags: "" };

function dateInput(v?: string | null) {
  return v ? String(v).slice(0, 10) : "";
}
function overdue(v?: string | null) {
  return !!v && new Date(v).getTime() < Date.now() - 12 * 3600 * 1000;
}

function LeadsAdminPageInner() {
  const { can } = usePermissions();
  const editable = can("leads", "manage");
  // The address carries the search, the stage and "due for follow-up"
  // (?due=1, where the bell's "Lead follow-ups due" links), and can name a
  // lead to open (?id=, from the header search). Read again whenever the
  // address changes, so a second link followed from this page lands too.
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const askedStatus = searchParams.get("status");
  const urlStatus = STATUSES.find((s) => s.key === askedStatus)?.key ?? "";
  const urlDue = ["1", "true"].includes(searchParams.get("due") ?? "");
  const urlId = searchParams.get("id");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState(urlSearch);
  // The search as sent to the server: settles a moment after typing stops.
  const [query, setQuery] = useState(urlSearch.trim());
  // One stage of the pipeline only, or "" for the whole board.
  const [stage, setStage] = useState<string>(urlStatus);
  // Only the leads whose follow-up is due today or overdue, by the gym's
  // date (the server decides, the same way the bell counts them).
  const [due, setDue] = useState(urlDue);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
      if (query) params.set("search", query);
      if (stage) params.set("status", stage);
      if (due) params.set("due", "1");
      const res = await apiGet<{ data: Lead[]; pagination?: { total?: number; pages?: number } }>(`${LEADS_API}?${params}`);
      const rows = res.data || [];
      const pageCount = Math.max(1, res.pagination?.pages ?? 1);
      // The last page emptied (its last lead deleted, or fewer matches):
      // show the new last page instead of a blank board.
      if (page > pageCount) {
        setPage(pageCount);
        return;
      }
      setLeads(rows);
      setPages(pageCount);
      setTotal(res.pagination?.total ?? rows.length);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load leads");
    } finally {
      setLoading(false);
    }
  }, [page, query, stage, due]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Needs the Staff tab; without it the picker only offers whoever a lead
    // is already assigned to (see staffOptions below).
    apiGet<{ staff?: StaffOption[] }>(`${API_BASE}/staff?status=active`)
      .then((r) => setStaff(r.staff || []))
      .catch(() => setStaff([]));
  }, []);

  // A new search goes to the server once typing pauses, from page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    setStage(urlStatus);
    setPage(1);
  }, [urlStatus]);

  useEffect(() => {
    setDue(urlDue);
    setPage(1);
  }, [urlDue]);

  // Narrows the page on screen while the server search catches up. The same
  // rule as the server's: every word has to appear somewhere.
  const filtered = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return leads;
    return leads.filter((l) => {
      const text = `${l.name} ${l.email} ${l.phone} ${l.interest} ${l.tags.join(" ")}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [leads, search]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setNote("");
    setLostReason("");
    setSaveErr(null);
    setOpen(true);
  };
  const openEdit = (l: Lead) => {
    setEditing(l);
    setDraft({ firstName: l.first_name, lastName: l.last_name, email: l.email, phone: l.phone, source: l.source, interest: l.interest, nextFollowUpAt: dateInput(l.next_follow_up_at), assignedTo: l.assigned_to || "", tags: l.tags.join(", ") });
    setNote("");
    setLostReason(l.lost_reason || "");
    setSaveErr(null);
    setOpen(true);
  };

  // Fetched on its own, as it need not be on the page of the board shown,
  // and then dropped from the address: closing the form is final, and the
  // same link followed again opens it again. Without the manage permission
  // there is no form, so the board is searched down to the lead instead.
  useEffect(() => {
    if (!urlId) return;
    replaceParams({ id: null });
    apiGet<{ data?: Lead }>(`${LEADS_API}/${encodeURIComponent(urlId)}`)
      .then((r) => {
        const lead = r.data;
        if (!lead) return;
        if (editable) {
          openEdit(lead);
          return;
        }
        const term = lead.email || lead.phone || lead.name;
        if (!term) return;
        setSearch(term);
        replaceParams({ search: term });
      })
      .catch((e) => setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not open that lead" }));
  }, [urlId, editable]);

  const payload = () => ({
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email,
    phone: draft.phone,
    source: draft.source,
    interest: draft.interest,
    nextFollowUpAt: draft.nextFollowUpAt || null,
    assignedTo: draft.assignedTo || null,
    tags: draft.tags.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean),
    lostReason,
  });

  const save = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      if (editing) {
        await apiJson(`${LEADS_API}/${editing.id}`, "PUT", payload());
        if (note.trim()) await apiJson(`${LEADS_API}/${editing.id}/notes`, "POST", { text: note });
      } else {
        await apiJson(LEADS_API, "POST", payload());
      }
      setOpen(false);
      await load();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (l: Lead, status: Status) => {
    let reason = "";
    if (status === "lost") {
      // Cancel on the prompt leaves the lead where it was.
      const answer = prompt("Why did they not join? (optional)");
      if (answer === null) return;
      reason = answer;
    }
    try {
      await apiJson(`${LEADS_API}/${l.id}/status`, "PATCH", { status, lostReason: reason });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not update" });
    }
  };

  const convert = async (l: Lead) => {
    if (!l.email) {
      setNotice({ tone: "error", text: "Add an email address first — the member account needs one." });
      return;
    }
    if (!confirm(`Create a member account for ${l.name} (${l.email}) and email them a password?`)) return;
    try {
      const res = await apiJson<{ message: string }>(`${LEADS_API}/${l.id}/convert`, "POST", {});
      setNotice({ tone: "ok", text: res.message });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not convert" });
    }
  };

  const remove = async (l: Lead) => {
    if (!confirm(`Delete ${l.name}?`)) return;
    try {
      await apiJson(`${LEADS_API}/${l.id}`, "DELETE");
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not delete" });
    }
  };

  const staffOptions = staff.map((s) => ({ value: s.id, label: s.name || s.email, hint: s.email }));
  // Keeps the current assignee visible (and the save from clearing it) when
  // they are not in the list -- deactivated, or the list could not be read.
  if (editing?.assigned_to && !staffOptions.some((o) => o.value === editing.assigned_to)) {
    staffOptions.push({ value: editing.assigned_to, label: editing.assigned_name || "Current assignee", hint: "" });
  }

  // One stage asked for shows only its column. A won or lost lead is never
  // due, so "due for follow-up" leaves those two columns out.
  const columns = stage ? STATUSES.filter((col) => col.key === stage) : due ? STATUSES.filter((col) => col.key !== "won" && col.key !== "lost") : STATUSES;

  return (
    <div>
      <PageHeader
        eyebrow="Customers"
        title="Leads"
        actions={
          editable ? (
            <PrimaryButton onClick={openCreate}>
              <FiPlus className="mr-1.5 h-4 w-4" /> New lead
            </PrimaryButton>
          ) : undefined
        }
      />
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <TextField
            label="Search"
            value={search}
            onChange={(v) => {
              setSearch(v);
              replaceParams({ search: v });
            }}
            placeholder="Name, email, phone, interest…"
          />
        </div>
        <div className="w-48">
          <SelectField
            label="Stage"
            value={stage}
            onChange={(v) => {
              setStage(v);
              setPage(1);
              replaceParams({ status: v });
            }}
            placeholder="All stages"
            options={STATUSES.map((s) => ({ value: s.key, label: s.label }))}
          />
        </div>
        <button
          type="button"
          aria-pressed={due}
          onClick={() => {
            setDue(!due);
            setPage(1);
            replaceParams({ due: due ? null : "1" });
          }}
          className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${due ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"}`}
        >
          Due for follow-up
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {columns.map((col) => {
              const items = filtered.filter((l) => l.status === col.key);
              return (
                <div key={col.key} className="min-w-0">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{col.label}</p>
                    <span className="text-xs text-neutral-400">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 && <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-400">{col.hint}</p>}
                    {items.map((l) => (
                      <Card key={l.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-neutral-900">{l.name}</p>
                            <p className="truncate text-xs text-neutral-500">{l.email || l.phone || "—"}</p>
                          </div>
                          <Badge color="neutral">{SOURCES.find((s) => s.value === l.source)?.label || l.source}</Badge>
                        </div>
                        {l.interest && <p className="mt-2 text-xs text-neutral-600">Interested in: {l.interest}</p>}
                        {l.next_follow_up_at && l.status !== "won" && l.status !== "lost" && (
                          <p className={`mt-1 text-xs ${overdue(l.next_follow_up_at) ? "font-semibold text-rose-600" : "text-neutral-500"}`}>
                            Follow up {new Date(l.next_follow_up_at).toLocaleDateString()}{overdue(l.next_follow_up_at) ? " — overdue" : ""}
                          </p>
                        )}
                        {l.assigned_name && <p className="mt-1 text-[11px] text-neutral-400">Assigned to {l.assigned_name}</p>}
                        {l.notes.length > 0 && <p className="mt-2 truncate text-[11px] text-neutral-500">“{l.notes[l.notes.length - 1].text}”</p>}
                        {editable && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <select value={l.status} onChange={(e) => setStatus(l, e.target.value as Status)} className="h-7 rounded-md border border-neutral-200 bg-white px-1.5 text-xs">
                              {STATUSES.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                            <SecondaryButton onClick={() => openEdit(l)}>Open</SecondaryButton>
                            {!l.converted_user_id && l.status !== "lost" && <SecondaryButton onClick={() => convert(l)}>Make member</SecondaryButton>}
                            <DangerButton onClick={() => remove(l)}>×</DangerButton>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <Pager page={page} pages={pages} total={total} onChange={setPage} />
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? editing.name : "New lead"} size="lg" busy={saving} error={saveErr}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="First name" required value={draft.firstName} onChange={(v) => setDraft({ ...draft, firstName: v })} />
          <TextField label="Last name" value={draft.lastName} onChange={(v) => setDraft({ ...draft, lastName: v })} />
          <TextField label="Email" type="email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} />
          <TextField label="Phone" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
          <SelectField label="Source" value={draft.source} allowClear={false} onChange={(v) => setDraft({ ...draft, source: v })} options={SOURCES} />
          <TextField label="Interested in" value={draft.interest} onChange={(v) => setDraft({ ...draft, interest: v })} placeholder="Monthly membership, PT, classes…" />
          <TextField label="Next follow-up" type="date" value={draft.nextFollowUpAt} onChange={(v) => setDraft({ ...draft, nextFollowUpAt: v })} />
          <SelectField label="Assigned to" value={draft.assignedTo} onChange={(v) => setDraft({ ...draft, assignedTo: v })} options={staffOptions} placeholder="Unassigned" />
          <TextField label="Tags (comma separated)" value={draft.tags} onChange={(v) => setDraft({ ...draft, tags: v })} />
          {editing?.status === "lost" && <TextField label="Lost reason" value={lostReason} onChange={setLostReason} />}
          {editing && (
            <div className="md:col-span-2">
              <TextArea label="Add a note" value={note} onChange={setNote} placeholder="Called, left a voicemail…" />
              {editing.notes.length > 0 && (
                <div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-lg bg-neutral-50 p-3">
                  {[...editing.notes].reverse().map((n) => (
                    <p key={n.id} className="text-xs text-neutral-700">
                      <span className="text-neutral-400">{new Date(n.at).toLocaleString()}{n.by_name ? ` · ${n.by_name}` : ""} — </span>
                      {n.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || !draft.firstName.trim()}>
            {saving ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}

export default function LeadsAdminPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <LeadsAdminPageInner />
    </Suspense>
  );
}
