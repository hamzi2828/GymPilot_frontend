"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PageHeader,
  Modal,
  SecondaryButton,
  PrimaryButton,
  DangerButton,
  SelectField,
  TextField,
  TextArea,
  Badge,
  Spinner,
  Table,
  ErrorState,
  UpgradePlanLink,
  Pager,
} from "../_shared/ui";
import { API_BASE, GYMFOLIO_API, apiGet, apiJson, isPlanLimitError, replaceParams } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import UsersImportModal from "./UsersImportModal";
import MemberProfileModal from "./MemberProfileModal";
import UsernameModal, { type UsernameTarget } from "./UsernameModal";
import AddMemberModal, { type RegisterResult } from "./AddMemberModal";
import { DESK_METHOD_OPTIONS, type MembershipSummary } from "./membershipDesk";
import {
  BalanceCell,
  DiscountCell,
  ExpiryCell,
  MEMBERSHIP_FILTER_OPTIONS,
  PackageCell,
  PaidCell,
  matchesMembership,
  type MembershipFilter,
} from "./MembershipColumns";
import {
  CredentialsChoice,
  PasswordReveal,
  SetPasswordModal,
  MIN_PASSWORD_LENGTH,
  type CredentialMode,
  type PasswordTarget,
  type RevealedPassword,
} from "./PasswordDialogs";

interface User {
  _id: string;
  firstName?: string;
  lastName?: string;
  /** Absent for a member who has no email address (they sign in with their username). */
  email?: string | null;
  // A role slug; roles are documents now, so any string a gym has created.
  role?: string;
  createdAt?: string;
  phone?: string | null;
  tags?: string[];
  /** "GP-0012": given when a member's account is created; staff have none. */
  memberCode?: string | null;
  isActive?: boolean;
  /**
   * What they can sign in with instead of an email -- the website, the desk
   * and the phone app. Their name plus three digits unless staff chose one.
   */
  username?: string | null;
  employment?: { isStaff?: boolean } | null;
}

// Rows per page. The list is loaded whole (search, tags and the filters run
// here); the page is what the membership columns are fetched for, in one
// call.
const PAGE_SIZE = 50;

// Members are the plain member role; everyone else -- any staff role, or an
// account marked staff -- is staff.
type View = "members" | "staff" | "all";

function isMember(user: User) {
  return (user.role || "user") === "user" && !user.employment?.isStaff;
}

// Who a row is, in words: a member may have no email, so the name comes first.
function displayName(user: Pick<User, "firstName" | "lastName" | "email" | "username">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.username || "this member";
}

// The gym reads this out to the member, so it needs to be easy to copy and,
// when two members keep mixing theirs up, easy to replace.
function UsernameCell({
  user,
  canManage,
  onRegenerated,
  onNotice,
  onEdit,
}: {
  user: User;
  canManage: boolean;
  onRegenerated: () => void;
  onNotice: (tone: "ok" | "warn", text: string) => void;
  /** Opens the dialog to type a username of the gym's choosing. */
  onEdit: () => void;
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
    if (!confirm(`Give ${displayName(user)} a new username? The one they have now stops working straight away, so you will need to tell them.`)) return;
    setBusy(true);
    try {
      const r = await apiJson<{ data: { username: string } }>(`${API_BASE}/admin/users/${user._id}/username`, "POST");
      onNotice("ok", `New username for ${displayName(user)}: ${r.data.username}`);
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
        <>
          <button
            type="button"
            onClick={onEdit}
            title="Choose their username"
            className="rounded px-1 py-0.5 text-[11px] font-medium text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
          >
            edit
          </button>
          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            title="Issue a new generated username"
            className="rounded px-1 py-0.5 text-[11px] font-medium text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-50"
          >
            {busy ? "…" : "new"}
          </button>
        </>
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

function UsersAdminPageInner() {
  const { can } = usePermissions();
  // Every write on this page is gated on users:manage by the backend; the
  // package assignment is a package-orders write.
  const canManage = can("users", "manage");
  const canAssign = can("package-orders", "manage");
  // The membership columns read the orders (package-orders · view).
  const canSeeMemberships = can("package-orders", "view");

  const [list, setList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [role, setRole] = useState("");
  const [roles, setRoles] = useState<RoleOption[]>([]);

  // Create-user dialog (any role), and the desk's one-screen Add member.
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  // The address carries the search (?q=) and can name a member to open
  // (?id=, from the header search). Both are read again whenever the
  // address changes, so a second link followed from this page lands too.
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlId = searchParams.get("id");
  const [query, setQuery] = useState(urlQuery);
  const [tagFilter, setTagFilter] = useState("");
  const [view, setView] = useState<View>("members");
  // "" = active and inactive alike. Filtered here, not with the API's
  // ?status=: that matches isActive: true exactly, and an account from
  // before the field existed is active too.
  const [activeFilter, setActiveFilter] = useState<"" | "active" | "inactive">("");
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>("");
  const [page, setPage] = useState(1);
  // Each member's membership (null: none), for the rows fetched so far;
  // absent until their page has been asked about. Cleared whenever the list
  // is reloaded, as a sale may have changed it.
  const [summaries, setSummaries] = useState<Record<string, MembershipSummary | null>>({});
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [summaryRetry, setSummaryRetry] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createLimit, setCreateLimit] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  // The details the desk takes down at the counter; the rest of the profile
  // (health, emergency contact, documents) is filled in afterwards.
  const emptyDraft = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "user",
    gender: "",
    dateOfBirth: "",
    address: "",
    staffNotes: "",
  };
  const [draft, setDraft] = useState(emptyDraft);
  // How the new account's first password reaches them, and the one typed
  // when the admin chooses it. Never kept past the request.
  const [credentials, setCredentials] = useState<CredentialMode>("email");
  const [chosenPassword, setChosenPassword] = useState("");
  // "Set password" on a row, and a generated password to show once.
  const [passwordFor, setPasswordFor] = useState<PasswordTarget | null>(null);
  const [reveal, setReveal] = useState<RevealedPassword | null>(null);
  const [usernameFor, setUsernameFor] = useState<UsernameTarget | null>(null);

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
      setSummaries({});
    } catch (e) {
      setAssignErr(e instanceof Error ? e.message : "Could not assign the package.");
    } finally {
      setAssigning(false);
    }
  };

  const openCreate = () => {
    setDraft(emptyDraft);
    setCredentials("email");
    setChosenPassword("");
    setCreateErr(null);
    setCreateLimit(false);
    setCreateOpen(true);
  };

  const createUser = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setCreateErr("First name and last name are both required.");
      return;
    }
    // No email is fine -- they sign in with their username -- but then the
    // gym needs a phone number to reach them.
    if (!draft.email.trim() && !draft.phone.trim()) {
      setCreateErr("Give an email address or a phone number.");
      return;
    }
    if (credentials === "set" && chosenPassword.length < MIN_PASSWORD_LENGTH) {
      setCreateErr(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setCreating(true);
    setCreateErr(null);
    setCreateLimit(false);
    try {
      // Emailed by default. A generated password comes back only when the
      // admin asked to see it or the email could not be sent, and is shown
      // once (PasswordReveal); a typed one is never sent back.
      const res = await apiJson<{
        message: string;
        emailed?: boolean;
        emailError?: string;
        credentials?: CredentialMode;
        password?: string;
        data?: { username?: string; memberCode?: string | null };
      }>(`${API_BASE}/admin/users`, "POST", {
        ...draft,
        credentials,
        ...(credentials === "set" ? { password: chosenPassword } : {}),
      });
      setCreateOpen(false);
      setChosenPassword("");
      const who = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim() || draft.email;
      const label = draft.email.trim() || who;
      const appLogin =
        (res.data?.memberCode ? ` Member ID ${res.data.memberCode}.` : "") +
        (res.data?.username ? ` Their username is ${res.data.username}.` : "");
      if (res.password) {
        setReveal({
          who,
          password: res.password,
          username: res.data?.username,
          note: res.credentials === "email"
            ? `The email to ${draft.email} could not be sent${res.emailError ? ` (${res.emailError})` : ""}, so hand this to ${who} yourself.`
            : undefined,
        });
      }
      setNotice(
        res.emailed
          ? { tone: "ok", text: `${label} was created and their password emailed.${appLogin}` }
          : res.credentials === "email"
            ? {
                tone: "warn",
                text: `${label} was created, but the password email failed${
                  res.emailError ? ` (${res.emailError})` : ""
                }. Check the SMTP settings.${appLogin}`,
              }
            : { tone: "ok", text: `${who} was created.${appLogin}` }
      );
      await load();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Could not create the user.");
      setCreateLimit(isPlanLimitError(e));
    } finally {
      setCreating(false);
    }
  };

  // Add member saved: the list gains the row, and the page says so once the
  // dialog (password, receipt) is closed.
  const registered = (res: RegisterResult) => {
    const m = res.member;
    const who = [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || "The member";
    const sold = res.order ? ` ${res.order.packageDetails.name} sold.` : "";
    setNotice({ tone: "ok", text: `${who} registered${m.memberCode ? ` (Member ID ${m.memberCode})` : ""}.${sold}` });
    load();
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: User[]; users?: User[] }>(`${API_BASE}/get/allUsers`);
      setList(r.data || r.users || []);
      setSummaries({});
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
    setQuery(urlQuery);
  }, [urlQuery]);

  // Opened once, then dropped from the address: closing the profile is final,
  // and the same link followed again opens it again.
  useEffect(() => {
    if (!urlId) return;
    setProfileId(urlId);
    replaceParams({ id: null });
  }, [urlId]);

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
    if (!isActive && !confirm(`Deactivate ${displayName(u)}? They are signed out and cannot sign in until reactivated.`)) return;
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
    if (view === "members" && !isMember(u)) return false;
    if (view === "staff" && isMember(u)) return false;
    if (activeFilter === "active" && u.isActive === false) return false;
    if (activeFilter === "inactive" && u.isActive !== false) return false;
    if (!q) return true;
    return `${u.firstName || ""} ${u.lastName || ""} ${u.email || ""} ${u.username || ""} ${u.phone || ""} ${u.memberCode || ""}`.toLowerCase().includes(q);
  });
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // The membership columns belong to the members view.
  const showMemberships = canSeeMemberships && view === "members";
  // The membership filter works on the page shown: the memberships are only
  // fetched a page at a time.
  const shownRows = showMemberships && membershipFilter ? pageRows.filter((u) => matchesMembership(membershipFilter, summaries[u._id])) : pageRows;

  // One summary call per page: the page's members not asked about yet.
  const pageKey = showMemberships ? pageRows.map((u) => u._id).join(",") : "";
  useEffect(() => {
    if (!pageKey) return;
    const missing = pageKey.split(",").filter((id) => !(id in summaries));
    if (!missing.length) return;
    let cancelled = false;
    apiJson<{ data?: { userId: string; membership: MembershipSummary | null }[] }>(`${GYMFOLIO_API}/package-orders/summary`, "POST", { userIds: missing })
      .then((r) => {
        if (cancelled) return;
        setSummaries((prev) => {
          const next = { ...prev };
          // Every id asked about is settled, answered or not, so a page is
          // never asked about twice.
          for (const id of missing) next[id] = null;
          for (const row of r.data || []) next[row.userId] = row.membership;
          return next;
        });
        setSummaryErr(null);
      })
      .catch((e) => {
        if (!cancelled) setSummaryErr(e instanceof Error ? e.message : "Could not load the memberships.");
      });
    return () => {
      cancelled = true;
    };
  }, [pageKey, summaries, summaryRetry]);

  return (
    <div>
      <PageHeader
        eyebrow="Customers"
        title="Users"
        actions={
          canManage ? (
            <>
              <SecondaryButton onClick={() => setImportOpen(true)}>Import CSV</SecondaryButton>
              <SecondaryButton onClick={openCreate}>New User</SecondaryButton>
              <PrimaryButton onClick={() => setAddOpen(true)}>Add member</PrimaryButton>
            </>
          ) : undefined
        }
      />
      <UsersImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />
      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} onRegistered={registered} canSell={canAssign} />

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
          <TextField
            label="Search"
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
              replaceParams({ q: v });
            }}
            placeholder="Name, email, username, phone or member code"
          />
        </div>
        <div className="w-40">
          <SelectField
            label="Show"
            value={view}
            allowClear={false}
            onChange={(v) => {
              setView(v === "staff" || v === "all" ? v : "members");
              setPage(1);
            }}
            options={[
              { value: "members", label: "Members" },
              { value: "staff", label: "Staff" },
              { value: "all", label: "Everyone" },
            ]}
          />
        </div>
        <div className="w-36">
          <SelectField
            label="Status"
            value={activeFilter}
            onChange={(v) => {
              setActiveFilter(v === "active" || v === "inactive" ? v : "");
              setPage(1);
            }}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            placeholder="All"
          />
        </div>
        {showMemberships && (
          <div className="w-52">
            <SelectField
              label="Membership (this page)"
              value={membershipFilter}
              onChange={(v) => setMembershipFilter(v as MembershipFilter)}
              options={MEMBERSHIP_FILTER_OPTIONS}
              placeholder="Any"
            />
          </div>
        )}
        {allTags.length > 0 && (
          <div className="w-48">
            <SelectField
              label="Tag"
              value={tagFilter}
              onChange={(v) => {
                setTagFilter(v);
                setPage(1);
              }}
              options={allTags.map((t) => ({ value: t, label: t }))}
              placeholder="All tags"
            />
          </div>
        )}
        <p className="pb-2 text-xs text-neutral-500">
          {visible.length} of {list.length}
          {showMemberships && membershipFilter ? ` · ${shownRows.length} of ${pageRows.length} on this page match` : ""}
        </p>
      </div>

      {showMemberships && summaryErr && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          <span>Memberships could not be loaded: {summaryErr}</span>
          <SecondaryButton onClick={() => setSummaryRetry((n) => n + 1)}>Try again</SecondaryButton>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : (
        <Table
          // Members see what they hold instead of a role (every one of them
          // is a member).
          columns={
            showMemberships
              ? ["Name", "Member ID", "Email", "Phone", "Username", "Package", "Next expiry", "Paid", "Discount", "Balance due", "Status", "Joined", "Actions"]
              : ["Name", "Member ID", "Email", "Phone", "Username", "Role", "Status", "Joined", "Actions"]
          }
          rows={shownRows.map((u) => [
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
            u.memberCode ? (
              <span key="c" className="whitespace-nowrap font-mono text-xs text-neutral-800">{u.memberCode}</span>
            ) : (
              <span key="c" className="text-xs text-neutral-400">—</span>
            ),
            u.email || <span key="e" className="text-xs text-neutral-400">no email</span>,
            u.phone ? <span key="p" className="whitespace-nowrap">{u.phone}</span> : <span key="p" className="text-xs text-neutral-400">—</span>,
            <UsernameCell
              key="u"
              user={u}
              canManage={canManage}
              onRegenerated={load}
              onNotice={(tone, text) => setNotice({ tone, text })}
              onEdit={() => setUsernameFor({ endpoint: `${API_BASE}/admin/users/${u._id}/username`, who: displayName(u), current: u.username })}
            />,
            ...(showMemberships
              ? [
                  <PackageCell key="pk" m={summaries[u._id]} />,
                  <ExpiryCell key="ex" m={summaries[u._id]} />,
                  <PaidCell key="pd" m={summaries[u._id]} />,
                  <DiscountCell key="dc" m={summaries[u._id]} />,
                  <BalanceCell key="bd" m={summaries[u._id]} />,
                ]
              : [<Badge key="r" color={u.role === "admin" ? "blue" : "neutral"}>{roleNames.get(u.role || "user") || u.role || "user"}</Badge>]),
            // `isActive` is what the account model stores and what sign-in
            // checks; an account from before the field is active.
            <Badge key="s" color={u.isActive === false ? "rose" : "green"}>{u.isActive === false ? "inactive" : "active"}</Badge>,
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—",
            <div key="a" className="flex gap-2">
              <SecondaryButton onClick={() => setProfileId(u._id)}>Profile</SecondaryButton>
              {canAssign && <SecondaryButton onClick={() => openAssign(u)}>Package</SecondaryButton>}
              {canManage && (
                <>
                  <SecondaryButton onClick={() => { setSelected(u); setRole(u.role || "user"); }}>Role</SecondaryButton>
                  <SecondaryButton
                    onClick={() =>
                      setPasswordFor({
                        endpoint: `${API_BASE}/admin/users/${u._id}/password`,
                        who: displayName(u),
                        username: u.username,
                      })
                    }
                  >
                    Set password
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={async () => {
                      if (!confirm(`Record that ${displayName(u)} has consented to fingerprint storage (signed form)?`)) return;
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
                      if (!confirm(`Sign ${displayName(u)} out of every device?`)) return;
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
          empty={
            !list.length
              ? "No users yet."
              : pageRows.length
                ? "No one on this page matches that membership filter."
                : "Nobody matches these filters."
          }
        />
      )}
      {!loading && !loadErr && <Pager page={currentPage} pages={pages} total={visible.length} onChange={setPage} />}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create User" size="md">
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            Choose how they get their first password below: emailed, shown to you once to hand
            over, or typed by you.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="First Name" value={draft.firstName} onChange={(v) => setDraft({ ...draft, firstName: v })} />
            <TextField label="Last Name" value={draft.lastName} onChange={(v) => setDraft({ ...draft, lastName: v })} />
          </div>
          <TextField
            label="Email (optional)"
            type="email"
            value={draft.email}
            onChange={(v) => {
              setDraft({ ...draft, email: v });
              // Nowhere to email a password without an address.
              if (!v.trim() && credentials === "email") setCredentials("show");
            }}
            placeholder="Leave empty if they have none"
          />
          <TextField
            label={draft.email.trim() ? "Phone (optional)" : "Phone"}
            value={draft.phone}
            onChange={(v) => setDraft({ ...draft, phone: v })}
            required={!draft.email.trim()}
          />
          {!draft.email.trim() && (
            <p className="-mt-2 text-xs text-neutral-500">
              Without an email they sign in with their username, and you give them their password.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Gender (optional)"
              value={draft.gender}
              onChange={(v) => setDraft({ ...draft, gender: v })}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "other", label: "Other" },
              ]}
              placeholder="Not given"
            />
            <TextField
              label="Date of birth (optional)"
              type="date"
              value={draft.dateOfBirth}
              onChange={(v) => setDraft({ ...draft, dateOfBirth: v })}
            />
          </div>
          <TextField
            label="Address (optional)"
            value={draft.address}
            onChange={(v) => setDraft({ ...draft, address: v })}
            placeholder="House, street, town"
          />
          <TextArea
            label="Staff notes (optional, never shown to the member)"
            value={draft.staffNotes}
            onChange={(v) => setDraft({ ...draft, staffNotes: v })}
            rows={2}
          />
          <SelectField
            label="Role"
            value={draft.role}
            onChange={(v) => setDraft({ ...draft, role: v })}
            options={roleOptions}
          />
          <CredentialsChoice
            mode={credentials}
            onMode={setCredentials}
            password={chosenPassword}
            onPassword={setChosenPassword}
            hasEmail={!!draft.email.trim()}
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
              {creating ? "Creating..." : credentials === "email" ? "Create & Email Password" : "Create User"}
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
                {displayName(assignFor)}
              </p>
              <p className="text-neutral-500">{assignFor.email || assignFor.phone || ""}</p>
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
                options={DESK_METHOD_OPTIONS}
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

      <MemberProfileModal userId={profileId} onClose={() => setProfileId(null)} onSaved={load} />

      <SetPasswordModal target={passwordFor} onClose={() => setPasswordFor(null)} onDone={(text) => setNotice({ tone: "ok", text })} />
      <PasswordReveal reveal={reveal} onClose={() => setReveal(null)} />
      <UsernameModal
        target={usernameFor}
        onClose={() => setUsernameFor(null)}
        onDone={(text) => {
          setNotice({ tone: "ok", text });
          load();
        }}
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Update Role" size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="text-neutral-900 font-medium">{displayName(selected)}</p>
              <p className="text-neutral-500">{selected.email || selected.phone || ""}</p>
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

export default function UsersAdminPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <UsersAdminPageInner />
    </Suspense>
  );
}
