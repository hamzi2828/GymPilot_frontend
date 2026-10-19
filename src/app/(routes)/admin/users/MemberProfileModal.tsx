"use client";

// A member's full record: details, health and emergency contact, documents,
// the signed agreement, tags and the notes staff keep, and their unpaid
// orders with a payment link for each.

import { useCallback, useEffect, useState } from "react";
import { Modal, PrimaryButton, SecondaryButton, DangerButton, TextField, TextArea, SelectField, Badge, Spinner, useConfirm, useAsyncAction, ErrorState, BusyLabel } from "../_shared/ui";
import { API_BASE, GYMFOLIO_API, apiGet, apiJson, apiForm, absoluteUrl } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { PayLinkPanel, payLinkAllowed } from "../_ops/PayLink";

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  /** Empty for a member with no email address. */
  email?: string | null;
  phone: string;
  /** One line, the account's primary address. */
  address?: string;
  dateOfBirth: string | null;
  gender: string;
  avatarUrl: string;
  role: string;
  isActive: boolean;
  memberCode: string;
  tags: string[];
  goals: string;
  source: string;
  assignedTrainerId: string | null;
  staffNotes: string;
  createdAt: string;
  lastLogin: string | null;
  emergencyContact: { name: string; phone: string; relationship: string };
  medical: { conditions: string; medications: string; injuries: string; parq: { completedAt: string | null; answers: { question: string; answer: boolean }[]; flagged: boolean } };
  medicalNotes: string;
  waiver: { required: boolean; version: string; text: string; signed: { signedAt: string; version: string; signature: string; source: string } | null; needs_signature: boolean };
  documents: { id: string; name: string; url: string; mimeType: string; size: number; uploadedAt: string }[];
  // `startsOn`: a paid membership that has not started yet reads `pending`
  // with the day it begins (peopleDirectory.membershipFor).
  membership: { status: string; packageName?: string; endDate?: string | null; daysLeft?: number | null; sessionsLeft?: number | null; startsOn?: string | null } | null;
  lastVisit: string | null;
}

type TabKey = "details" | "health" | "documents" | "notes" | "payments";

// An order as GET /package-orders lists it: only what the Payments tab shows.
interface UnpaidOrder {
  _id: string;
  orderNumber: string;
  status: string;
  userId?: { _id: string } | string | null;
  packageDetails?: { name?: string };
  payment: { amount: number; currency: string; status: string; method: string };
  metadata?: { dueDate?: string | null; lastDay?: string | null };
  createdAt: string;
}

function ownerOf(order: UnpaidOrder) {
  return order.userId && typeof order.userId === "object" ? order.userId._id : order.userId || null;
}

function dateInput(v?: string | null) {
  return v ? String(v).slice(0, 10) : "";
}

// A day the API sent: a bare YYYY-MM-DD is that calendar day (read as UTC it
// would show the day before west of Greenwich); anything else is an instant.
function dayLabel(value: string) {
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = bare ? new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function MemberProfileModal({ userId, onClose, onSaved }: { userId: string | null; onClose: () => void; onSaved?: () => void }) {
  const [tab, setTab] = useState<TabKey>("details");
  const { can } = usePermissions();
  const seesOrders = can("package-orders", "view");
  const managesOrders = can("package-orders", "manage");
  // Payments tab: the member's orders not yet paid, and the one whose link is open.
  const [unpaid, setUnpaid] = useState<UnpaidOrder[] | null>(null);
  const [unpaidErr, setUnpaidErr] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const { ask, dialog: confirmDialog } = useConfirm();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  // The profile's Save and a document's Upload: one at a time, and the
  // dialog stays open until it has settled.
  const saveAction = useAsyncAction();
  const saving = saveAction.busy;
  const photoAction = useAsyncAction();
  const removing = useAsyncAction();
  const waiverAction = useAsyncAction();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    apiGet<{ data: { id: string; name: string }[] }>(`${API_BASE}/api/gymfolio/pt/trainers`)
      .then((r) => setTrainers(r.data || []))
      .catch(() => setTrainers([]));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await apiGet<{ data: Profile }>(`${API_BASE}/admin/users/${userId}/profile`);
      setProfile(res.data);
      setLoadErr(null);
    } catch (e) {
      // With a profile already on screen (a reload after a save) it stays,
      // under a line saying so; with none, the error takes its place.
      const text = e instanceof Error ? e.message : "Could not load the member";
      setLoadErr(text);
      setNotice({ tone: "error", text });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setTab("details");
    setNotice(null);
    setProfile(null);
    setUnpaid(null);
    setLinkFor(null);
    load();
  }, [load]);

  // Every order of theirs the list gives, kept to the unpaid ones. Checked
  // against the member here as well, whatever the list was asked.
  const loadUnpaid = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await apiGet<{ data?: UnpaidOrder[] }>(`${GYMFOLIO_API}/package-orders?userId=${encodeURIComponent(userId)}&limit=100&sort=-createdAt`);
      setUnpaid((r.data || []).filter((o) => ownerOf(o) === userId && payLinkAllowed(o)));
      setUnpaidErr(null);
    } catch (e) {
      setUnpaidErr(e instanceof Error ? e.message : "Could not load their orders");
    }
  }, [userId]);

  useEffect(() => {
    if (tab === "payments" && unpaid === null) loadUnpaid();
  }, [tab, unpaid, loadUnpaid]);

  if (!userId) return null;

  const set = (patch: Partial<Profile>) => setProfile((p) => (p ? { ...p, ...patch } : p));

  const save = () => saveAction.run("profile", async () => {
    if (!profile) return;
    setNotice(null);
    try {
      const res = await apiJson<{ message?: string; data?: { email?: string | null } }>(`${API_BASE}/admin/users/${profile.id}/profile`, "PUT", {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        // Empty removes it; the API refuses one already on another account.
        email: (profile.email || "").trim(),
        address: profile.address ?? "",
        dateOfBirth: profile.dateOfBirth || null,
        gender: profile.gender,
        tags: profile.tags,
        goals: profile.goals,
        source: profile.source,
        assignedTrainerId: profile.assignedTrainerId,
        staffNotes: profile.staffNotes,
        emergencyContact: profile.emergencyContact,
        medical: { conditions: profile.medical.conditions, medications: profile.medical.medications, injuries: profile.medical.injuries },
        medicalNotes: profile.medicalNotes,
      });
      // The API says what it saved (an email change included), so that is what is shown.
      setNotice({ tone: "ok", text: res.message || "Profile saved." });
      // As stored: lowercased and trimmed, or gone.
      if (res.data && "email" in res.data) set({ email: res.data.email || null });
      onSaved?.();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not save" });
    }
  });

  const uploadPhoto = (file: File | null) => photoAction.run(async () => {
    if (!file || !profile) return;
    const form = new FormData();
    form.append("photo", file);
    try {
      await apiForm(`${API_BASE}/admin/users/${profile.id}/photo`, "POST", form);
      await load();
      onSaved?.();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not upload the photo" });
    }
  });

  const addDocument = () => saveAction.run("document", async () => {
    if (!docFile || !profile) return;
    const form = new FormData();
    form.append("file", docFile);
    form.append("name", docName || docFile.name);
    try {
      await apiForm(`${API_BASE}/admin/users/${profile.id}/documents`, "POST", form);
      setDocFile(null);
      setDocName("");
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not add the document" });
    }
  });

  const removeDocument = async (doc: { id: string; name: string }) => {
    if (!profile) return;
    const answer = await ask({ title: `Remove ${doc.name || "this document"}?`, body: "The file is deleted from their profile. This cannot be undone.", confirmLabel: "Remove document" });
    if (answer === null) return;
    await removing.run(doc.id, async () => {
      try {
        await apiJson(`${API_BASE}/admin/users/${profile.id}/documents/${doc.id}`, "DELETE");
        await load();
      } catch (e) {
        setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not remove" });
      }
    });
  };

  const recordWaiver = async () => {
    if (!profile || !confirm(`Record that ${profile.firstName} signed the membership agreement on paper?`)) return;
    await waiverAction.run(async () => {
      try {
        const res = await apiJson<{ message: string }>(`${API_BASE}/admin/users/${profile.id}/waiver`, "POST", {});
        setNotice({ tone: "ok", text: res.message });
        await load();
      } catch (e) {
        setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not record" });
      }
    });
  };

  const name = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || "Member" : "Member";

  return (
    <Modal open={!!userId} onClose={onClose} title={name} size="xl" busy={saving}>
      {confirmDialog}
      {loading ? (
        <Spinner />
      ) : !profile ? (
        <ErrorState message={loadErr || "Could not load the member"} onRetry={load} />
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-lg font-bold text-neutral-500">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={absoluteUrl(profile.avatarUrl)} alt="" className="h-full w-full object-cover" />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-neutral-900">
                {profile.email || <span className="font-normal text-neutral-500">No email address{profile.phone ? ` · ${profile.phone}` : ""}</span>}
              </p>
              <p className="text-xs text-neutral-500">
                {profile.memberCode ? `${profile.memberCode} · ` : ""}joined {new Date(profile.createdAt).toLocaleDateString()}
                {profile.lastVisit ? ` · last visit ${new Date(profile.lastVisit).toLocaleDateString()}` : " · no visits yet"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {profile.membership && (
                  <Badge color={profile.membership.startsOn ? "blue" : profile.membership.status === "active" ? "green" : profile.membership.status === "expired" ? "amber" : "neutral"}>
                    {profile.membership.packageName ? `${profile.membership.packageName} · ` : ""}
                    {profile.membership.startsOn ? `Starts on ${dayLabel(profile.membership.startsOn)}` : profile.membership.status}
                  </Badge>
                )}
                {profile.waiver.required && <Badge color={profile.waiver.needs_signature ? "rose" : "green"}>{profile.waiver.needs_signature ? "Agreement unsigned" : "Agreement signed"}</Badge>}
                {profile.medical.parq.flagged && <Badge color="rose">PAR-Q flagged</Badge>}
              </div>
            </div>
            <label
              aria-busy={photoAction.busy || undefined}
              className={`relative rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 ${photoAction.busy ? "cursor-wait" : "cursor-pointer"}`}
            >
              <BusyLabel busy={photoAction.busy}>Change photo</BusyLabel>
              <input type="file" accept="image/*" className="hidden" disabled={photoAction.busy} onChange={(e) => uploadPhoto(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div className="mt-5 border-b border-neutral-200">
            <div className="-mb-px flex gap-1 overflow-x-auto">
              {([["details", "Details"], ["health", "Health"], ["documents", "Documents"], ["notes", "Notes & agreement"], ...(seesOrders ? [["payments", "Payments"]] : [])] as [TabKey, string][]).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setTab(key)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === key ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {notice && <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}

          {tab === "details" && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField label="First name" value={profile.firstName} onChange={(v) => set({ firstName: v })} />
              <TextField label="Last name" value={profile.lastName} onChange={(v) => set({ lastName: v })} />
              <TextField label="Phone" value={profile.phone} onChange={(v) => set({ phone: v })} />
              <TextField label="Email" type="email" value={profile.email || ""} onChange={(v) => set({ email: v })} placeholder="Leave empty if they have none" />
              <TextField label="Date of birth" type="date" value={dateInput(profile.dateOfBirth)} onChange={(v) => set({ dateOfBirth: v })} />
              <SelectField label="Gender" value={profile.gender} onChange={(v) => set({ gender: v })} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]} />
              <TextField label="How they found us" value={profile.source} onChange={(v) => set({ source: v })} placeholder="Instagram, referral, walk-in…" />
              <div className="md:col-span-2">
                <TextField label="Address" value={profile.address ?? ""} onChange={(v) => set({ address: v })} placeholder="House, street, town" />
              </div>
              <SelectField label="Personal trainer" value={profile.assignedTrainerId || ""} onChange={(v) => set({ assignedTrainerId: v || null })} options={trainers.map((t) => ({ value: t.id, label: t.name }))} placeholder="None assigned" />
              <div className="md:col-span-2">
                <TextField label="Tags (comma separated)" value={profile.tags.join(", ")} onChange={(v) => set({ tags: v.split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean) })} placeholder="student, corporate, vip" />
              </div>
              <div className="md:col-span-2">
                <TextArea label="Goals" value={profile.goals} onChange={(v) => set({ goals: v })} placeholder="Lose 5 kg by summer, first pull-up…" />
              </div>
            </div>
          )}

          {tab === "health" && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <TextField label="Emergency contact" value={profile.emergencyContact.name} onChange={(v) => set({ emergencyContact: { ...profile.emergencyContact, name: v } })} />
                <TextField label="Their phone" value={profile.emergencyContact.phone} onChange={(v) => set({ emergencyContact: { ...profile.emergencyContact, phone: v } })} />
                <TextField label="Relationship" value={profile.emergencyContact.relationship} onChange={(v) => set({ emergencyContact: { ...profile.emergencyContact, relationship: v } })} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <TextArea label="Conditions" value={profile.medical.conditions} onChange={(v) => set({ medical: { ...profile.medical, conditions: v } })} />
                <TextArea label="Medications" value={profile.medical.medications} onChange={(v) => set({ medical: { ...profile.medical, medications: v } })} />
                <TextArea label="Injuries" value={profile.medical.injuries} onChange={(v) => set({ medical: { ...profile.medical, injuries: v } })} />
              </div>
              <TextArea label="Staff medical notes (never shown to the member)" value={profile.medicalNotes} onChange={(v) => set({ medicalNotes: v })} />
              <div className="rounded-lg bg-neutral-50 p-4 text-sm">
                <p className="font-semibold text-neutral-900">PAR-Q</p>
                {profile.medical.parq.completedAt ? (
                  <>
                    <p className="text-xs text-neutral-500">Completed {new Date(profile.medical.parq.completedAt).toLocaleDateString()} — {profile.medical.parq.flagged ? "answered yes to at least one question; medical clearance advised." : "no concerns raised."}</p>
                    <ul className="mt-2 space-y-1 text-xs text-neutral-700">
                      {profile.medical.parq.answers.map((a, i) => (
                        <li key={i}>
                          <span className={a.answer ? "font-semibold text-rose-600" : "text-emerald-700"}>{a.answer ? "YES" : "no"}</span> — {a.question}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-neutral-500">Not completed yet. Members fill it in from their profile.</p>
                )}
              </div>
            </div>
          )}

          {tab === "documents" && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <TextField label="Name" value={docName} onChange={setDocName} placeholder="Signed agreement, ID scan…" />
                <label className="block">
                  <span className="text-xs font-medium text-neutral-600">File (image or PDF, 10 MB)</span>
                  <input type="file" accept="image/*,application/pdf" className="mt-1 block w-full text-sm" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                </label>
                <PrimaryButton onClick={addDocument} loading={saveAction.isBusy("document")} disabled={!docFile || saving}>
                  Upload
                </PrimaryButton>
              </div>
              {profile.documents.length ? (
                <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                  {profile.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <a href={absoluteUrl(d.url)} target="_blank" rel="noreferrer" className="font-medium text-neutral-900 underline">
                          {d.name}
                        </a>
                        <p className="text-xs text-neutral-500">
                          {(d.size / 1024).toFixed(0)} KB · {new Date(d.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <DangerButton onClick={() => removeDocument(d)} loading={removing.isBusy(d.id)}>Remove</DangerButton>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">No documents yet.</p>
              )}
            </div>
          )}

          {tab === "notes" && (
            <div className="mt-4 space-y-4">
              <TextArea label="Staff notes (never shown to the member)" value={profile.staffNotes} onChange={(v) => set({ staffNotes: v })} placeholder="Prefers morning sessions, injured knee in March…" />
              <div className="rounded-lg bg-neutral-50 p-4 text-sm">
                <p className="font-semibold text-neutral-900">Membership agreement</p>
                {profile.waiver.signed ? (
                  <p className="text-xs text-neutral-600">
                    Signed by {profile.waiver.signed.signature} on {new Date(profile.waiver.signed.signedAt).toLocaleDateString()} (version {profile.waiver.signed.version}, {profile.waiver.signed.source === "desk" ? "on paper" : "online"}).
                    {profile.waiver.needs_signature && <span className="ml-1 font-semibold text-rose-600">The agreement has since changed (now version {profile.waiver.version}).</span>}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-600">{profile.waiver.text ? "Not signed yet." : "No agreement is set up (Settings → General → Membership rules)."}</p>
                )}
                {profile.waiver.text && (
                  <div className="mt-2">
                    <SecondaryButton onClick={recordWaiver} loading={waiverAction.busy}>Record signed on paper</SecondaryButton>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "payments" && (
            <div className="mt-4 space-y-3">
              {unpaid === null && !unpaidErr ? (
                <Spinner />
              ) : unpaidErr && !unpaid ? (
                <ErrorState message={unpaidErr} onRetry={loadUnpaid} />
              ) : !unpaid || unpaid.length === 0 ? (
                <p className="text-sm text-neutral-500">Nothing unpaid. Orders waiting for payment show here, each with a payment link to send.</p>
              ) : (
                unpaid.map((o) => (
                  <div key={o._id} className="rounded-lg border border-neutral-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold text-neutral-900">
                          {o.packageDetails?.name || "Membership"} · {(o.payment.currency || "").toUpperCase()} {Number(o.payment.amount || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {o.orderNumber} · {o.payment.status === "failed" ? "payment failed" : "awaiting payment"}
                          {o.metadata?.dueDate ? ` · due ${dayLabel(o.metadata.dueDate)}` : ""}
                          {o.metadata?.lastDay ? ` · last day ${dayLabel(o.metadata.lastDay)}` : ""}
                        </p>
                      </div>
                      {managesOrders && (
                        <SecondaryButton onClick={() => setLinkFor(linkFor === o._id ? null : o._id)}>{linkFor === o._id ? "Hide link" : "Payment link"}</SecondaryButton>
                      )}
                    </div>
                    {managesOrders && linkFor === o._id && (
                      <div className="mt-3">
                        <PayLinkPanel orderId={o._id} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <SecondaryButton onClick={onClose} disabled={saving}>
              Close
            </SecondaryButton>
            {tab !== "documents" && tab !== "payments" && (
              <PrimaryButton onClick={save} loading={saveAction.isBusy("profile")} disabled={saving}>
                Save
              </PrimaryButton>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
