"use client";

import { useEffect, useState } from "react";
import {
  PageHeader,
  Modal,
  SecondaryButton,
  PrimaryButton,
  DangerButton,
  SelectField,
  TextField,
  Badge,
  Spinner,
  Table,
  ErrorState,
  UpgradePlanLink,
} from "../_shared/ui";
import { API_BASE, GYMFOLIO_API, apiGet, apiJson, isPlanLimitError } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import UsersImportModal from "./UsersImportModal";
import MemberProfileModal from "./MemberProfileModal";

interface User {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  // A role slug; roles are documents now, so any string a gym has created.
  role?: string;
  createdAt?: string;
  phone?: string | null;
  tags?: string[];
  memberCode?: string | null;
  isActive?: boolean;
  /** What the member types into the phone app. Their name plus three digits. */
  username?: string | null;
}

// The gym reads this out to the member, so it needs to be easy to copy and,
// when two members keep mixing theirs up, easy to replace.
function UsernameCell({
  user,
  canManage,
  onRegenerated,
  onNotice,
}: {
  user: User;
  canManage: boolean;
  onRegenerated: () => void;
  onNotice: (tone: "ok" | "warn", text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user.username) {
    return <span className="text-xs text-neutral-400">not issued yet</span>;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(user.username || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      onNotice("warn", "Your browser would not let the page copy. Select the username and copy it by hand.");
    }
  };

  const regenerate = async () => {
    if (!confirm(`Give ${user.email} a new app username? The one they have now stops working straight away, so you will need to tell them.`)) return;
    setBusy(true);
    try {
      const r = await apiJson<{ data: { username: string } }>(`${API_BASE}/admin/users/${user._id}/username`, "POST");
      onNotice("ok", `New username for ${user.email}: ${r.data.username}`);
      onRegenerated();
    } catch (e) {
      onNotice("warn", e instanceof Error ? e.message : "Could not issue a new username");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-800">{user.username}</code>
      <button
        type="button"
        onClick={copy}
        title="Copy the username"
        className="rounded px-1 py-0.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
      >
        {copied ? "copied" : "copy"}
      </button>
      {canManage && (
        <button
          type="button"
          onClick={regenerate}
          disabled={busy}
          title="Issue a new username"
          className="rounded px-1 py-0.5 text-[11px] font-medium text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-50"
        >
          {busy ? "…" : "new"}
        </button>
      )}
    </div>
  );
}

// Roles come from the Roles & Access collection rather than a hardcoded list,
// so a role invented there is immediately assignable here. Promoting someone
// to a staff role also gives them payroll and a roster -- edit those on the
// Staff tab.
//
// Read from /roles/options (active roles, any staff account) rather than
// /roles, which needs the Roles tab and would leave a receptionist who may
// edit users with an empty picker.
interface RoleOption {
  slug: string;
  name: string;
}

interface PackageOption {
  _id: string;
  name: string;
  price: number;
  currency?: string;
  period?: string;
}

export default function UsersAdminPage() {
  const { can } = usePermissions();
  // Every write on this page is gated on users:manage by the backend; the
  // package assignment is a package-orders write.
  const canManage = can("users", "manage");
  const canAssign = can("package-orders", "manage");

  const [list, setList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [role, setRole] = useState("");
  const [roles, setRoles] = useState<RoleOption[]>([]);

  // Create-user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [profileFor, setProfileFor] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createLimit, setCreateLimit] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const emptyDraft = { firstName: "", lastName: "", email: "", phone: "", role: "user" };
  const [draft, setDraft] = useState(emptyDraft);

  // --- Assign a package to a specific member -----------------------------
  const [assignFor, setAssignFor] = useState<User | null>(null);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const emptyAssign = { packageId: "", paymentMethod: "cash", markPaid: "yes", durationMonths: "" };
  const [assignDraft, setAssignDraft] = useState(emptyAssign);

  const openAssign = async (u: User) => {
    setAssignFor(u);
    setAssignDraft(emptyAssign);
    setAssignErr(null);
    try {
      const p = await apiGet<{ data?: PackageOption[] }>(`${GYMFOLIO_API}/packages`);
      setPackages(p.data || []);
    } catch (e) {
      setAssignErr(e instanceof Error ? e.message : "Could not load packages.");
    }
  };

  const assignPackage = async () => {
    if (!assignFor || !assignDraft.packageId) {
      setAssignErr("Choose a package to assign.");
      return;
    }
    setAssigning(true);
    setAssignErr(null);
    try {
      const res = await apiJson<{ message: string }>(`${GYMFOLIO_API}/package-orders/assign`, "POST", {
        userId: assignFor._id,
        packageId: assignDraft.packageId,
        paymentMethod: assignDraft.paymentMethod,
        markPaid: assignDraft.markPaid === "yes",
        durationMonths: assignDraft.durationMonths ? Number(assignDraft.durationMonths) : undefined,
      });
      setAssignFor(null);
      setNotice({ tone: "ok", text: res.message || "Package assigned." });
    } catch (e) {
      setAssignErr(e instanceof Error ? e.message : "Could not assign the package.");
    } finally {
      setAssigning(false);
    }
  };

  const openCreate = () => {
    setDraft(emptyDraft);
    setCreateErr(null);
    setCreateLimit(false);
    setCreateOpen(true);
  };

  const createUser = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.email.trim()) {
      setCreateErr("First name, last name and email are all required.");
      return;
    }
    setCreating(true);
    setCreateErr(null);
    setCreateLimit(false);
    try {
      // The password is generated server-side and emailed — it is never sent
      // from or shown in the browser.
      const res = await apiJson<{ message: string; emailed?: boolean; emailError?: string; data?: { username?: string } }>(
        `${API_BASE}/admin/users`,
        "POST",
        draft
      );
      setCreateOpen(false);
      const appLogin = res.data?.username ? ` Their phone app username is ${res.data.username}.` : "";
      setNotice(
        res.emailed
          ? { tone: "ok", text: `${draft.email} was created and their password emailed.${appLogin}` }
          : {
              tone: "warn",
              text: `${draft.email} was created, but the password email failed${
                res.emailError ? ` (${res.emailError})` : ""
              }. Check the SMTP settings.${appLogin}`,
            }
      );
      await load();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Could not create the user.");
      setCreateLimit(isPlanLimitError(e));
    } finally {
      setCreating(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: User[]; users?: User[] }>(`${API_BASE}/get/allUsers`);
      setList(r.data || r.users || []);
      setLoadErr(null);
    } catch (e) {
      // Kept apart from an empty list: "No users yet" over a failed request
      // reads as the members having gone.
      setLoadErr(e instanceof Error ? e.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    apiGet<{ data?: RoleOption[] }>(`${API_BASE}/roles/options`)
      .then((r) => setRoles(r.data || []))
      // A failure here is not fatal: the list still renders, only the role
      // picker is empty.
      .catch(() => setRoles([]));
  }, []);

  const roleOptions = roles.map((entry) => ({
    value: entry.slug,
    label: entry.name,
    hint: entry.slug,
  }));
  const roleNames = new Map(roles.map((entry) => [entry.slug, entry.name]));

  // Deactivating signs the account out and keeps it out until reactivated;
  // the backend refuses switching yourself or the last administrator off.
  const setActive = async (u: User, isActive: boolean) => {
    if (!isActive && !confirm(`Deactivate ${u.email}? They are signed out and cannot sign in until reactivated.`)) return;
    try {
      const r = await apiJson<{ message: string }>(`${API_BASE}/update/status/${u._id}`, "PUT", { isActive });
      setNotice({ tone: "ok", text: r.message || (isActive ? "Account reactivated." : "Account deactivated.") });
      await load();
    } catch (e) {
      setNotice({ tone: "warn", text: e instanceof Error ? e.message : "Could not change the status" });
    }
  };

  const saveRole = async () => {
    if (!selected || !role) return;
    try {
      await apiJson(`${API_BASE}/update/role/${selected._id}`, "PUT", { role });
      setSelected(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    try {
      await apiJson(`${API_BASE}/delete/${id}`, "DELETE");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const allTags = Array.from(new Set(list.flatMap((u) => u.tags || []))).sort();
  const q = query.trim().toLowerCase();
  const visible = list.filter((u) => {
    if (tagFilter && !(u.tags || []).includes(tagFilter)) return false;
    if (!q) return true;
    return `${u.firstName || ""} ${u.lastName || ""} ${u.email} ${u.username || ""} ${u.phone || ""} ${u.memberCode || ""}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        eyebrow="Customers"
        title="Users"
        actions={
          canManage ? (
            <>
              <SecondaryButton onClick={() => setImportOpen(true)}>Import CSV</SecondaryButton>
              <PrimaryButton onClick={openCreate}>New User</PrimaryButton>
            </>
          ) : undefined
        }
      />
      <UsersImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />

      {notice && (
        <div
          className={`mb-6 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-72">
          <TextField label="Search" value={query} onChange={setQuery} placeholder="Name, email, username, phone or member code" />
        </div>
        {allTags.length > 0 && (
          <div className="w-48">
            <SelectField label="Tag" value={tagFilter} onChange={setTagFilter} options={allTags.map((t) => ({ value: t, label: t }))} placeholder="All tags" />
          </div>
        )}
        <p className="pb-2 text-xs text-neutral-500">{visible.length} of {list.length}</p>
      </div>

      {loading ? (
        <Spinner />
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : (
        <Table
          columns={["Name", "Email", "App username", "Role", "Status", "Joined", "Actions"]}
          rows={visible.map((u) => [
            <div key="n">
              <p className="font-medium text-neutral-900">{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</p>
              {(u.tags || []).length > 0 && (
                <p className="mt-0.5 flex flex-wrap gap-1">
                  {(u.tags || []).map((t) => (
                    <span key={t} className="rounded-full bg-neutral-100 px-1.5 text-[10px] text-neutral-600">{t}</span>
                  ))}
                </p>
              )}
            </div>,
            u.email,
            <UsernameCell key="u" user={u} canManage={canManage} onRegenerated={load} onNotice={(tone, text) => setNotice({ tone, text })} />,
            <Badge key="r" color={u.role === "admin" ? "blue" : "neutral"}>{roleNames.get(u.role || "user") || u.role || "user"}</Badge>,
            // `isActive` is what the account model stores and what sign-in
            // checks; an account from before the field is active.
            <Badge key="s" color={u.isActive === false ? "rose" : "green"}>{u.isActive === false ? "inactive" : "active"}</Badge>,
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—",
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => setProfileFor(u)}>Profile</SecondaryButton>
              {canAssign && <SecondaryButton onClick={() => openAssign(u)}>Package</SecondaryButton>}
              {canManage && (
                <>
                  <SecondaryButton onClick={() => { setSelected(u); setRole(u.role || "user"); }}>Role</SecondaryButton>
                  <SecondaryButton
                    onClick={async () => {
                      if (!confirm(`Record that ${u.email} has consented to fingerprint storage (signed form)?`)) return;
                      try {
                        const r = await apiJson<{ message: string }>(`${API_BASE}/admin/users/${u._id}/consent`, "PUT", { biometric: true });
                        setNotice({ tone: "ok", text: r.message });
                      } catch (e) {
                        setNotice({ tone: "warn", text: e instanceof Error ? e.message : "Could not record consent" });
                      }
                    }}
                  >
                    Consent
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={async () => {
                      if (!confirm(`Sign ${u.email} out of every device?`)) return;
                      try {
                        const r = await apiJson<{ message: string }>(`${API_BASE}/admin/users/${u._id}/logout-all`, "POST");
                        setNotice({ tone: "ok", text: r.message });
                      } catch (e) {
                        setNotice({ tone: "warn", text: e instanceof Error ? e.message : "Could not sign the user out" });
                      }
                    }}
                  >
                    Sign out
                  </SecondaryButton>
                  {u.isActive === false ? (
                    <SecondaryButton onClick={() => setActive(u, true)}>Activate</SecondaryButton>
                  ) : (
                    <SecondaryButton onClick={() => setActive(u, false)}>Deactivate</SecondaryButton>
                  )}
                  <DangerButton onClick={() => remove(u._id)}>Delete</DangerButton>
                </>
              )}
            </div>,
          ])}
          empty="No users yet."
        />
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create User" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            A secure password is generated automatically and emailed to the user. You will not
            need to share it yourself.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="First Name" value={draft.firstName} onChange={(v) => setDraft({ ...draft, firstName: v })} />
            <TextField label="Last Name" value={draft.lastName} onChange={(v) => setDraft({ ...draft, lastName: v })} />
          </div>
          <TextField label="Email" type="email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} />
          <TextField label="Phone (optional)" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
          <SelectField
            label="Role"
            value={draft.role}
            onChange={(v) => setDraft({ ...draft, role: v })}
            options={roleOptions}
          />

          {createErr && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {createErr}
              {createLimit && <UpgradePlanLink />}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={createUser} disabled={creating}>
              {creating ? "Creating..." : "Create & Email Password"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title="Assign Package"
        size="sm"
      >
        {assignFor && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium text-neutral-900">
                {[assignFor.firstName, assignFor.lastName].filter(Boolean).join(" ") || assignFor.email}
              </p>
              <p className="text-neutral-500">{assignFor.email}</p>
            </div>

            <p className="text-sm text-neutral-500">
              Creates an active membership without going through checkout — for payments
              taken in person or a comped package.
            </p>

            <SelectField
              label="Package"
              value={assignDraft.packageId}
              onChange={(v) => setAssignDraft({ ...assignDraft, packageId: v })}
              options={[
                ...packages.map((p) => ({
                  value: p._id,
                  label: `${p.name} — ${(p.currency || "GBP").toUpperCase()} ${p.price}/${p.period || "month"}`,
                })),
              ]}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Payment Method"
                value={assignDraft.paymentMethod}
                onChange={(v) => setAssignDraft({ ...assignDraft, paymentMethod: v })}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "bank_transfer", label: "Bank Transfer" },
                  { value: "card", label: "Card" },
                  { value: "stripe", label: "Stripe" },
                ]}
              />
              <SelectField
                label="Mark as Paid"
                value={assignDraft.markPaid}
                onChange={(v) => setAssignDraft({ ...assignDraft, markPaid: v })}
                options={[
                  { value: "yes", label: "Yes — activate now" },
                  { value: "no", label: "No — leave pending" },
                ]}
              />
            </div>

            <TextField
              label="Duration in months (optional)"
              type="number"
              value={assignDraft.durationMonths}
              onChange={(v) => setAssignDraft({ ...assignDraft, durationMonths: v })}
              placeholder="Defaults to the package period"
            />

            {assignErr && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{assignErr}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setAssignFor(null)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={assignPackage} disabled={assigning}>
                {assigning ? "Assigning..." : "Assign Package"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      <MemberProfileModal userId={profileFor ? profileFor._id : null} onClose={() => setProfileFor(null)} onSaved={load} />

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Update Role" size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="text-neutral-900 font-medium">{[selected.firstName, selected.lastName].filter(Boolean).join(" ") || selected.email}</p>
              <p className="text-neutral-500">{selected.email}</p>
            </div>
            <SelectField
              label="Role"
              value={role}
              onChange={setRole}
              options={roleOptions}
            />
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setSelected(null)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={saveRole}>Save</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
