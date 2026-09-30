"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import {
  PageHeader,
  Card,
  Modal,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  TextField,
  TextArea,
  Toggle,
  Spinner,
  EmptyState,
  ErrorState,
  UpgradePlanLink,
  Select2,
} from "../_shared/ui";
import { API_BASE, apiGet, apiJson, isPlanLimitError, replaceParams } from "../_shared/api";
import {
  CredentialsChoice,
  PasswordReveal,
  SetPasswordModal,
  MIN_PASSWORD_LENGTH,
  type CredentialMode,
  type PasswordTarget,
  type RevealedPassword,
} from "../users/PasswordDialogs";
import UsernameModal, { type UsernameTarget } from "../users/UsernameModal";
import { currencyOptions } from "@/data/countries";

const CURRENCY_OPTIONS = currencyOptions();
import { usePermissions } from "@/components/admin/PermissionsProvider";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "casual", label: "Casual" },
];

const PAY_CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "biweekly", label: "Every two weeks" },
  { value: "weekly", label: "Weekly" },
];

interface Shift {
  day: string;
  start_time: string;
  end_time: string;
}

interface StaffMember {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  /** Absent for an account without one, e.g. a phone-only member moved onto the staff. */
  email?: string;
  /** Signs in instead of the email: website, desk and phone app. */
  username?: string;
  phone: string;
  staff_code: string;
  role: string;
  role_name: string;
  is_active: boolean;
  job_title: string;
  department: string;
  employment_type: string;
  joined_label: string | null;
  payroll: {
    basis: "salaried" | "hourly";
    salary: number;
    hourly_rate: number;
    currency: string;
    cycle: string;
    contract_hours_per_week: number;
    bank_name: string;
    account_title: string;
    account_number: string;
    notes: string;
  };
  schedule: Shift[];
  schedule_summary: { days: number; label: string; weekly_hours: number };
  emergency_contact: { name: string; phone: string; relationship: string };
  attendance: {
    visits: number;
    minutes: number;
    label: string;
    last_seen_label: string | null;
    still_in: boolean;
  };
  allow_attendance_app: boolean;
  allow_fingerprint_enrollment: boolean;
  attendance_location: string;
}

// From /roles/options: active roles only, readable by any staff account.
// Roles with `is_staff: false` (members) are left out; an older API that
// doesn't send the flag falls back to leaving out the reserved member slug.
interface Role {
  name: string;
  slug: string;
  is_staff?: boolean;
}

const MEMBER_SLUG = "user";

interface StaffResponse {
  month_label: string;
  departments: string[];
  counts: { total: number; active: number; on_shift: number };
  staff: StaffMember[];
}

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  jobTitle: string;
  department: string;
  employmentType: string;
  joinedAt: string;
  basis: "salaried" | "hourly";
  salary: string;
  hourlyRate: string;
  currency: string;
  cycle: string;
  contractHoursPerWeek: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  notes: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  allowAttendanceApp: boolean;
  allowFingerprintEnrollment: boolean;
  attendanceLocation: string;
};

const emptyDraft: Draft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "",
  jobTitle: "",
  department: "",
  employmentType: "full_time",
  joinedAt: "",
  basis: "salaried",
  salary: "",
  hourlyRate: "",
  currency: "",
  cycle: "monthly",
  contractHoursPerWeek: "",
  bankName: "",
  accountTitle: "",
  accountNumber: "",
  notes: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelationship: "",
  allowAttendanceApp: false,
  allowFingerprintEnrollment: false,
  attendanceLocation: "",
};

function money(amount: number, currency: string) {
  if (!amount) return "—";
  return `${currency} ${amount.toLocaleString()}`;
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

// One editable week. A roster is what the attendance verdicts are judged
// against, so it is edited here beside the pay it justifies rather than on a
// separate screen.
function RosterEditor({ shifts, onChange }: { shifts: Shift[]; onChange: (next: Shift[]) => void }) {
  const byDay = new Map(shifts.map((shift) => [shift.day, shift]));

  const toggle = (day: string) => {
    if (byDay.has(day)) {
      onChange(shifts.filter((shift) => shift.day !== day));
    } else {
      // Copies the last shift that was set, because a week is usually the same
      // hours repeated and retyping 09:00–17:00 seven times is nobody's idea
      // of a roster editor.
      const template = shifts[shifts.length - 1];
      onChange(
        [
          ...shifts,
          {
            day,
            start_time: template?.start_time || "09:00",
            end_time: template?.end_time || "17:00",
          },
        ].sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day))
      );
    }
  };

  const setTime = (day: string, field: "start_time" | "end_time", value: string) => {
    onChange(shifts.map((shift) => (shift.day === day ? { ...shift, [field]: value } : shift)));
  };

  return (
    <div className="rounded-xl border border-neutral-200">
      {WEEKDAYS.map((day) => {
        const shift = byDay.get(day);
        return (
          <div
            key={day}
            className="flex items-center gap-3 border-b border-neutral-100 px-4 py-2 last:border-b-0"
          >
            <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={!!shift}
                onChange={() => toggle(day)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className={`text-[13px] ${shift ? "font-medium text-neutral-800" : "text-neutral-400"}`}>
                {day}
              </span>
            </label>

            {shift ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={shift.start_time}
                  onChange={(e) => setTime(day, "start_time", e.target.value)}
                  className="h-8 rounded-lg border border-neutral-200 px-2 text-[13px]"
                />
                <span className="text-neutral-400">→</span>
                <input
                  type="time"
                  value={shift.end_time}
                  onChange={(e) => setTime(day, "end_time", e.target.value)}
                  className="h-8 rounded-lg border border-neutral-200 px-2 text-[13px]"
                />
              </div>
            ) : (
              <span className="text-[12px] text-neutral-400">Off</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StaffAdminPageInner() {
  const { can } = usePermissions();
  const editable = can("staff", "manage");
  // The address carries the search (?q=) and can name someone to open (?id=,
  // from the header search). Both are read again whenever the address
  // changes, so a second link followed from this page lands too.
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlId = searchParams.get("id");

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [counts, setCounts] = useState<StaffResponse["counts"] | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [monthLabel, setMonthLabel] = useState("");

  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [search, setSearch] = useState(urlQuery);
  const [q, setQ] = useState(urlQuery.trim());

  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formLimit, setFormLimit] = useState(false);
  // How a new staff member gets their first password, and "Set password"
  // on a row. A generated password is shown once, then gone.
  const [credentials, setCredentials] = useState<CredentialMode>("email");
  const [chosenPassword, setChosenPassword] = useState("");
  const [passwordFor, setPasswordFor] = useState<PasswordTarget | null>(null);
  const [reveal, setReveal] = useState<RevealedPassword | null>(null);
  const [usernameFor, setUsernameFor] = useState<UsernameTarget | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSearch(urlQuery);
  }, [urlQuery]);

  // The gym's currency (Settings → General); payroll starts on it.
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  useEffect(() => {
    apiGet<{ data?: { currency?: string } }>(`${API_BASE}/settings`)
      .then((r) => {
        if (r.data?.currency) setDefaultCurrency(r.data.currency);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (departmentFilter !== "all") params.set("department", departmentFilter);
      if (q) params.set("q", q);

      const res = await apiGet<StaffResponse>(`${API_BASE}/staff?${params.toString()}`);
      setStaff(res.staff || []);
      setCounts(res.counts);
      setDepartments(res.departments || []);
      setMonthLabel(res.month_label || "");
      setLoadErr(null);
      setErr(null);
    } catch (e) {
      // Shown in place of the table, not as "No staff yet".
      setLoadErr(e instanceof Error ? e.message : "Could not load staff");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, departmentFilter, q]);

  useEffect(() => {
    load();
  }, [load]);

  // Roles are needed for the picker; a failure here is not fatal to the list.
  // /roles/options rather than /roles: registering staff needs the Staff tab,
  // not the Roles tab as well.
  useEffect(() => {
    apiGet<{ data?: Role[] }>(`${API_BASE}/roles/options`)
      .then((res) =>
        setRoles(
          (res.data || []).filter((role) =>
            role.is_staff === undefined ? role.slug !== MEMBER_SLUG : role.is_staff
          )
        )
      )
      .catch(() => setRoles([]));
  }, []);

  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: role.slug, label: role.name, hint: role.slug })),
    [roles]
  );

  const openCreate = () => {
    setEditing(null);
    // Deliberately no default role. Pre-selecting the first one would quietly
    // suggest whatever sorts first -- which is Administrator.
    setDraft({ ...emptyDraft });
    setShifts([]);
    setCredentials("email");
    setChosenPassword("");
    setFormErr(null);
    setFormLimit(false);
    setOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setDraft({
      firstName: member.first_name,
      lastName: member.last_name,
      // The draft's fields are always strings: save() trims them.
      email: member.email || "",
      phone: member.phone,
      role: member.role,
      jobTitle: member.job_title,
      department: member.department,
      employmentType: member.employment_type,
      joinedAt: "",
      basis: member.payroll.basis,
      salary: member.payroll.salary ? String(member.payroll.salary) : "",
      hourlyRate: member.payroll.hourly_rate ? String(member.payroll.hourly_rate) : "",
      currency: member.payroll.currency,
      cycle: member.payroll.cycle,
      contractHoursPerWeek: member.payroll.contract_hours_per_week
        ? String(member.payroll.contract_hours_per_week)
        : "",
      bankName: member.payroll.bank_name,
      accountTitle: member.payroll.account_title,
      accountNumber: member.payroll.account_number,
      notes: member.payroll.notes,
      emergencyName: member.emergency_contact?.name || "",
      emergencyPhone: member.emergency_contact?.phone || "",
      emergencyRelationship: member.emergency_contact?.relationship || "",
      allowAttendanceApp: member.allow_attendance_app,
      allowFingerprintEnrollment: member.allow_fingerprint_enrollment,
      attendanceLocation: member.attendance_location,
    });
    setShifts(member.schedule || []);
    setFormErr(null);
    setFormLimit(false);
    setOpen(true);
  };

  // Opened once the list holds them, then dropped from the address: closing
  // the form is final, and the same link followed again opens it again.
  // Only this form shows a member of staff in full, so without the Staff
  // manage permission the link just lands on the list.
  useEffect(() => {
    if (!urlId || loading) return;
    const member = staff.find((m) => m.id === urlId);
    if (!member) return;
    if (editable) openEdit(member);
    replaceParams({ id: null });
  }, [urlId, loading, staff, editable]);

  const payload = () => ({
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    role: draft.role,
    allowAttendanceApp: draft.allowAttendanceApp,
    allowFingerprintEnrollment: draft.allowFingerprintEnrollment,
    attendanceLocation: draft.attendanceLocation.trim(),
    employment: {
      jobTitle: draft.jobTitle.trim(),
      department: draft.department.trim(),
      employmentType: draft.employmentType,
      joinedAt: draft.joinedAt || undefined,
      payroll: {
        basis: draft.basis,
        salary: Number(draft.salary) || 0,
        hourlyRate: Number(draft.hourlyRate) || 0,
        currency: draft.currency.trim() || defaultCurrency,
        cycle: draft.cycle,
        contractHoursPerWeek: Number(draft.contractHoursPerWeek) || 0,
        bankName: draft.bankName.trim(),
        accountTitle: draft.accountTitle.trim(),
        accountNumber: draft.accountNumber.trim(),
        notes: draft.notes.trim(),
      },
      schedule: shifts.map((shift) => ({
        day: shift.day,
        startTime: shift.start_time,
        endTime: shift.end_time,
      })),
      emergencyContact: {
        name: draft.emergencyName.trim(),
        phone: draft.emergencyPhone.trim(),
        relationship: draft.emergencyRelationship.trim(),
      },
    },
  });

  const save = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setFormErr("First and last name are both required.");
      return;
    }
    if (!editing && !draft.email.trim()) {
      setFormErr("An email is required — it is how they sign in.");
      return;
    }
    if (!draft.role) {
      setFormErr("Choose a role.");
      return;
    }
    if (!editing && credentials === "set" && chosenPassword.length < MIN_PASSWORD_LENGTH) {
      setFormErr(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    setFormErr(null);
    setFormLimit(false);
    try {
      if (editing) {
        await apiJson(`${API_BASE}/staff/${editing.id}`, "PUT", payload());
        setNotice(`${draft.firstName} updated.`);
      } else {
        const res = await apiJson<{ message: string; emailed?: boolean; emailError?: string; credentials?: CredentialMode; password?: string }>(
          `${API_BASE}/staff`,
          "POST",
          { ...payload(), credentials, ...(credentials === "set" ? { password: chosenPassword } : {}) }
        );
        setChosenPassword("");
        setNotice(res.message);
        if (res.password) {
          const who = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();
          setReveal({
            who,
            password: res.password,
            note: res.credentials === "email"
              ? `The email to ${draft.email.trim()} could not be sent${res.emailError ? ` (${res.emailError})` : ""}, so hand this to ${who} yourself.`
              : undefined,
          });
        }
      }
      setOpen(false);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Could not save this staff member");
      setFormLimit(isPlanLimitError(e));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (member: StaffMember, isActive: boolean) => {
    try {
      const res = await apiJson<{ message: string }>(`${API_BASE}/staff/${member.id}/status`, "PATCH", {
        isActive,
      });
      setNotice(res.message);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not change that status");
    }
  };

  const removeStaff = async (member: StaffMember) => {
    if (
      !confirm(
        `Remove ${member.name} from staff? Their account and attendance history are kept — they simply become an ordinary member.`
      )
    )
      return;
    try {
      const res = await apiJson<{ message: string }>(`${API_BASE}/staff/${member.id}`, "DELETE");
      setNotice(res.message);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not remove this staff member");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Staff"
        actions={editable ? <PrimaryButton onClick={openCreate}>Register Staff</PrimaryButton> : undefined}
      />

      <p className="-mt-4 mb-6 max-w-2xl text-[13px] text-neutral-500">
        Everyone who works here: their role and what it unlocks, what they are paid, and the hours
        they are rostered for. Those hours are what the attendance screen judges a late arrival
        against.
      </p>

      {notice && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {err && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">{err}</div>
      )}

      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/staff/roster" className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50">Roster</Link>
        <Link href="/admin/staff/leave" className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50">Leave</Link>
        <Link href="/admin/staff/payslips" className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50">Payslips</Link>
      </div>

      {counts && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Staff" value={counts.total} hint="on the books" />
          <Stat label="Active" value={counts.active} hint="able to sign in" />
          <Stat label="On shift now" value={counts.on_shift} hint="checked in, not out" />
          <Stat label="Roles" value={roles.length} hint="staff roles defined" />
        </div>
      )}

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Role
            </span>
            <Select2
              ariaLabel="Role"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "all", label: "All roles" },
                ...roles.map((role) => ({ value: role.slug, label: role.name })),
              ]}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Status
            </span>
            <Select2
              ariaLabel="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Any status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Deactivated" },
              ]}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Department
            </span>
            <Select2
              ariaLabel="Department"
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={[
                { value: "all", label: "All departments" },
                ...departments.map((department) => ({ value: department, label: department })),
              ]}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Search
            </span>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  replaceParams({ q: e.target.value });
                }}
                placeholder="Name, email or code…"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
              />
            </div>
          </label>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : !staff.length ? (
        <EmptyState
          title="No staff yet"
          hint={editable ? "Register your first staff member to give them a role, a roster and a pay rate." : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["Person", "Role", "Employment", "Pay", "Roster", `Hours ${monthLabel}`, ""].map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                    <td className="px-5 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">{member.name}</span>
                        {member.attendance.still_in && (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On shift
                          </span>
                        )}
                        {!member.is_active && (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                            Deactivated
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-400">
                        {[member.staff_code || "no code", member.username, member.email].filter(Boolean).join(" · ")}
                      </div>
                    </td>

                    <td className="px-5 py-3 align-middle">
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-600/15">
                        {member.role_name}
                      </span>
                      {member.job_title && (
                        <div className="mt-0.5 text-[11px] text-neutral-400">{member.job_title}</div>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-3 align-middle text-neutral-700">
                      {EMPLOYMENT_TYPES.find((type) => type.value === member.employment_type)?.label ||
                        member.employment_type}
                      <div className="text-[11px] text-neutral-400">
                        {member.department || "—"}
                        {member.joined_label ? ` · since ${member.joined_label}` : ""}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-3 align-middle text-neutral-700">
                      {member.payroll.basis === "hourly"
                        ? `${money(member.payroll.hourly_rate, member.payroll.currency)} / hour`
                        : money(member.payroll.salary, member.payroll.currency)}
                      <div className="text-[11px] text-neutral-400">
                        {member.payroll.basis === "hourly" ? "hourly" : member.payroll.cycle}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-3 align-middle text-neutral-700">
                      {member.schedule_summary.days ? (
                        member.schedule_summary.label
                      ) : (
                        <span className="text-amber-600">No roster set</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-3 align-middle text-neutral-700">
                      {member.attendance.label}
                      <div className="text-[11px] text-neutral-400">
                        {member.attendance.last_seen_label || "never clocked in"}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-3 text-right align-middle">
                      {editable && (
                        <div className="flex items-center justify-end gap-2">
                          <SecondaryButton onClick={() => openEdit(member)}>Edit</SecondaryButton>
                          <SecondaryButton
                            onClick={() =>
                              setPasswordFor({ endpoint: `${API_BASE}/staff/${member.id}/password`, who: member.name, username: member.username })
                            }
                          >
                            Set password
                          </SecondaryButton>
                          <SecondaryButton
                            onClick={() =>
                              setUsernameFor({ endpoint: `${API_BASE}/staff/${member.id}/username`, who: member.name, current: member.username })
                            }
                          >
                            Username
                          </SecondaryButton>
                          {member.is_active ? (
                            <DangerButton onClick={() => setStatus(member, false)}>Deactivate</DangerButton>
                          ) : (
                            <>
                              <SecondaryButton onClick={() => setStatus(member, true)}>Reactivate</SecondaryButton>
                              <DangerButton onClick={() => removeStaff(member)}>Remove</DangerButton>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Register staff"}
        size="xl"
      >
        <div className="space-y-6">
          {/* Identity */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="First name"
                value={draft.firstName}
                onChange={(v) => setDraft({ ...draft, firstName: v })}
                required
              />
              <TextField
                label="Last name"
                value={draft.lastName}
                onChange={(v) => setDraft({ ...draft, lastName: v })}
                required
              />
              {editing ? (
                <div>
                  <span className="text-xs font-semibold text-neutral-700">Email</span>
                  <p className="mt-1 flex h-9 items-center rounded-lg bg-neutral-50 px-3 text-sm text-neutral-500">
                    {editing.email || "No email on file"}
                  </p>
                </div>
              ) : (
                <TextField
                  label="Email"
                  type="email"
                  value={draft.email}
                  onChange={(v) => setDraft({ ...draft, email: v })}
                  placeholder="They sign in with this"
                  required
                />
              )}
              <TextField label="Phone" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
            </div>
            {!editing && (
              <div className="mt-4">
                <CredentialsChoice mode={credentials} onMode={setCredentials} password={chosenPassword} onPassword={setChosenPassword} />
              </div>
            )}
          </section>

          {/* Role and employment */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Role &amp; employment
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="text-xs font-semibold text-neutral-700">Role *</span>
                <div className="mt-1">
                  <Select2
                    ariaLabel="Role"
                    value={draft.role}
                    onChange={(v) => setDraft({ ...draft, role: v })}
                    options={roleOptions}
                    placeholder="Choose a role"
                  />
                </div>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Decides which admin tabs they can open. Manage them under Roles &amp; Access.
                </p>
              </div>

              <TextField
                label="Job title"
                value={draft.jobTitle}
                onChange={(v) => setDraft({ ...draft, jobTitle: v })}
                placeholder="Front Desk Supervisor"
              />
              <TextField
                label="Department"
                value={draft.department}
                onChange={(v) => setDraft({ ...draft, department: v })}
                placeholder="Operations"
              />

              <div>
                <span className="text-xs font-semibold text-neutral-700">Employment type</span>
                <div className="mt-1">
                  <Select2
                    ariaLabel="Employment type"
                    value={draft.employmentType}
                    onChange={(v) => setDraft({ ...draft, employmentType: v })}
                    options={EMPLOYMENT_TYPES}
                  />
                </div>
              </div>

              <TextField
                label="Joined on"
                type="date"
                value={draft.joinedAt}
                onChange={(v) => setDraft({ ...draft, joinedAt: v })}
              />
            </div>
          </section>

          {/* Payroll */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Payroll</p>

            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, basis: "salaried" })}
                className={`h-9 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  draft.basis === "salaried"
                    ? "border-neutral-400 bg-neutral-100 text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-600"
                }`}
              >
                Salaried
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, basis: "hourly" })}
                className={`h-9 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  draft.basis === "hourly"
                    ? "border-neutral-400 bg-neutral-100 text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-600"
                }`}
              >
                Hourly
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {draft.basis === "salaried" ? (
                <TextField
                  label="Salary per cycle"
                  type="number"
                  value={draft.salary}
                  onChange={(v) => setDraft({ ...draft, salary: v })}
                />
              ) : (
                <TextField
                  label="Rate per hour"
                  type="number"
                  value={draft.hourlyRate}
                  onChange={(v) => setDraft({ ...draft, hourlyRate: v })}
                />
              )}

              <div>
                <span className="text-xs font-semibold text-neutral-700">Currency</span>
                <div className="mt-1">
                  <Select2 ariaLabel="Currency" value={draft.currency || defaultCurrency} onChange={(v) => setDraft({ ...draft, currency: v })} options={CURRENCY_OPTIONS} />
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-neutral-700">Pay cycle</span>
                <div className="mt-1">
                  <Select2
                    ariaLabel="Pay cycle"
                    value={draft.cycle}
                    onChange={(v) => setDraft({ ...draft, cycle: v })}
                    options={PAY_CYCLES}
                  />
                </div>
              </div>

              <TextField
                label="Contract hours per week"
                type="number"
                value={draft.contractHoursPerWeek}
                onChange={(v) => setDraft({ ...draft, contractHoursPerWeek: v })}
              />
              <TextField
                label="Bank"
                value={draft.bankName}
                onChange={(v) => setDraft({ ...draft, bankName: v })}
              />
              <TextField
                label="Account title"
                value={draft.accountTitle}
                onChange={(v) => setDraft({ ...draft, accountTitle: v })}
              />
              <TextField
                label="Account number"
                value={draft.accountNumber}
                onChange={(v) => setDraft({ ...draft, accountNumber: v })}
              />
            </div>

            <div className="mt-4">
              <TextArea
                label="Payroll notes"
                value={draft.notes}
                onChange={(v) => setDraft({ ...draft, notes: v })}
                rows={2}
              />
            </div>
          </section>

          {/* Roster */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Roster — when they clock in and out
              </p>
              {shifts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShifts([])}
                  className="text-[12px] font-medium text-neutral-500 hover:text-neutral-800"
                >
                  Clear week
                </button>
              )}
            </div>
            <RosterEditor shifts={shifts} onChange={setShifts} />
            <p className="mt-2 text-[12px] text-neutral-400">
              Attendance compares each punch against these hours. Leave a day off and any punch that
              day is recorded as &quot;not rostered&quot; rather than late.
            </p>
          </section>

          {/* Front desk access */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Front-desk attendance app
            </p>
            <div className="space-y-2 rounded-xl border border-neutral-200 px-4 py-3">
              <Toggle
                label="Can sign in to the attendance app"
                checked={draft.allowAttendanceApp}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    allowAttendanceApp: v,
                    // Enrolment is meaningless without app access, and leaving
                    // it set would quietly re-grant it later.
                    allowFingerprintEnrollment: v ? draft.allowFingerprintEnrollment : false,
                  })
                }
              />
              <Toggle
                label="Can enrol fingerprints"
                checked={draft.allowFingerprintEnrollment}
                onChange={(v) => setDraft({ ...draft, allowFingerprintEnrollment: v })}
              />
              {!draft.allowAttendanceApp && draft.allowFingerprintEnrollment && (
                <p className="text-[12px] text-amber-700">Enrolment needs app access as well.</p>
              )}
              <div className="pt-1">
                <TextField
                  label="Desk location"
                  value={draft.attendanceLocation}
                  onChange={(v) => setDraft({ ...draft, attendanceLocation: v })}
                  placeholder="Main branch"
                />
              </div>
            </div>
          </section>

          {/* Emergency contact */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Emergency contact
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField
                label="Name"
                value={draft.emergencyName}
                onChange={(v) => setDraft({ ...draft, emergencyName: v })}
              />
              <TextField
                label="Phone"
                value={draft.emergencyPhone}
                onChange={(v) => setDraft({ ...draft, emergencyPhone: v })}
              />
              <TextField
                label="Relationship"
                value={draft.emergencyRelationship}
                onChange={(v) => setDraft({ ...draft, emergencyRelationship: v })}
              />
            </div>
          </section>

          {formErr && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {formErr}
              {formLimit && <UpgradePlanLink />}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Register staff member"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <SetPasswordModal target={passwordFor} onClose={() => setPasswordFor(null)} onDone={setNotice} />
      <PasswordReveal reveal={reveal} onClose={() => setReveal(null)} />
      <UsernameModal
        target={usernameFor}
        onClose={() => setUsernameFor(null)}
        onDone={(text) => {
          setNotice(text);
          load();
        }}
      />
    </div>
  );
}

export default function StaffAdminPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <StaffAdminPageInner />
    </Suspense>
  );
}
