"use client";

// Users → Add member: the one screen the front desk signs somebody up on --
// who they are, the membership they are buying and the money taken -- sent
// as one request (POST /api/admin/members/register) that creates both or
// neither. Then the password to hand over, if there is one, and the receipt.
//
// The checks below are the API's own (memberRegistrationController,
// membershipService.readDeskTerms, userController.createMemberAccount), so
// the desk hears about a mistake before anything is sent. The API checks it
// all again and has the last word: a total shown here is what the sale will
// charge a member who has never joined, and the receipt prints what the
// order actually recorded.

import { useEffect, useState, type ReactNode } from "react";
import { Modal, PrimaryButton, SecondaryButton, SelectField, TextArea, TextField, Toggle, UpgradePlanLink } from "../_shared/ui";
import { API_BASE, GYMFOLIO_API, apiGet, apiJson, isPlanLimitError } from "../_shared/api";
import { EMPTY_RECEIPT_PROFILE, loadReceiptProfile, printReceipt, type ReceiptProfile, type ThermalReceiptProps } from "@/components/receipts";
import { CopyButton, CredentialsChoice, MIN_PASSWORD_LENGTH, type CredentialMode } from "./PasswordDialogs";
import { DESK_METHOD_OPTIONS, dateKey, methodLabel, money, readAmount, shortDate } from "./membershipDesk";

const REGISTER_URL = `${API_BASE}/api/admin/members/register`;
// The receipt letterhead through the membership desk's own route
// (package-orders · view), not the till's.
const RECEIPT_PROFILE_URL = `${API_BASE}/admin/receipt-profile`;

// The API's limits (services/memberFields.js, membershipService.readDeskTerms).
const MAX_ADDRESS = 300;
const MAX_NOTES = 10000;
const MAX_START_AHEAD_DAYS = 365;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PackageOption {
  _id: string;
  name: string;
  price: string | number;
  /** The numeric mirror of `price`, kept in step when the package is saved. */
  priceAmount?: number | null;
  currency?: string;
  period?: string;
  joiningFee?: number;
  isActive?: boolean;
}

interface TrainerOption {
  _id: string;
  name: string;
  isActive?: boolean;
  // Their commission terms: only on the admin list (trainers · view).
  commissionType?: "percent" | "amount" | null;
  commissionValue?: number | null;
  commissionPercent?: number | null;
}

interface RegisteredOrder {
  _id: string;
  orderNumber: string;
  invoice?: { number?: string | null };
  packageDetails: { name: string; price: string; period?: string };
  payment: {
    amount: number;
    subtotal?: number;
    discountAmount?: number;
    discountNote?: string;
    joiningFee?: number;
    trainerFee?: number;
    amountPaid?: number | null;
    balanceDue?: number;
    currency: string;
    method: string;
    paidAt?: string;
  };
  subscription?: { startDate?: string; endDate?: string };
  trainerAssignment?: { trainerName?: string } | null;
}

export interface RegisterResult {
  message: string;
  member: { _id: string; firstName?: string; lastName?: string; email?: string | null; phone?: string | null; memberCode?: string | null; username?: string | null };
  order: RegisteredOrder | null;
  credentials?: CredentialMode;
  emailed?: boolean;
  emailError?: string | null;
  password?: string;
}

const EMPTY_MEMBER = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  gender: "",
  dateOfBirth: "",
  address: "",
  staffNotes: "",
};

type StartMode = "today" | "days" | "date";
type AdmissionMode = "charge" | "waive" | "amount";

const EMPTY_SALE = {
  packageId: "",
  startMode: "today" as StartMode,
  startAfterDays: "",
  startDate: "",
  discountAmount: "",
  discountNote: "",
  admission: "charge" as AdmissionMode,
  admissionAmount: "",
  trainerId: "",
  trainerFee: "",
  commissionType: "percent" as "percent" | "amount",
  commissionValue: "",
  paymentMethod: "cash",
  amountPaid: "",
  notes: "",
};

type SaleDraft = typeof EMPTY_SALE;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The package's price as a number, or NaN when it cannot be read. */
function packagePrice(p: PackageOption): number {
  if (typeof p.priceAmount === "number") return p.priceAmount;
  const amount = readAmount(p.price);
  return amount === null ? NaN : amount;
}

// A trainer's own commission, as the trainer screen stores it: a percent or
// a fixed amount, else the older percent field, else nothing to prefill.
function commissionDefaults(t?: TrainerOption): { commissionType: "percent" | "amount"; commissionValue: string } {
  if (t && (t.commissionType === "percent" || t.commissionType === "amount") && t.commissionValue !== null && t.commissionValue !== undefined) {
    return { commissionType: t.commissionType, commissionValue: String(t.commissionValue) };
  }
  if (t && t.commissionPercent !== null && t.commissionPercent !== undefined) {
    return { commissionType: "percent", commissionValue: String(t.commissionPercent) };
  }
  return { commissionType: "percent", commissionValue: "" };
}

/** What the sale comes to, summed as the API sums it for a member joining now. */
function totalsOf(sale: SaleDraft, pkg: PackageOption | undefined) {
  const price = pkg ? packagePrice(pkg) || 0 : 0;
  const discount = Math.min(readAmount(sale.discountAmount) || 0, price);
  const admission = !pkg
    ? 0
    : sale.admission === "waive"
      ? 0
      : sale.admission === "amount"
        ? readAmount(sale.admissionAmount) || 0
        : pkg.joiningFee || 0;
  const trainerFee = sale.trainerId ? readAmount(sale.trainerFee) || 0 : 0;
  const total = round2(price - discount + admission + trainerFee);
  const typed = readAmount(sale.amountPaid);
  // Blank: paid in full.
  const paid = typed === null ? total : typed || 0;
  return { price, discount, admission, trainerFee, total, paid, balance: Math.max(0, round2(total - paid)) };
}

function daysAhead(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  const today = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

/** The first thing the API would refuse, in the desk's words; null when it is all usable. */
function problemOf({
  member,
  credentials,
  password,
  selling,
  sale,
  pkg,
}: {
  member: typeof EMPTY_MEMBER;
  credentials: CredentialMode;
  password: string;
  selling: boolean;
  sale: SaleDraft;
  pkg?: PackageOption;
}): string | null {
  if (!member.firstName.trim() || !member.lastName.trim()) return "First name and last name are both required.";
  const email = member.email.trim();
  if (!email && !member.phone.trim()) return "Give a phone number (or an email address).";
  if (email && !EMAIL_RX.test(email)) return "That email address does not look right.";
  if (member.dateOfBirth && member.dateOfBirth > dateKey()) return "Date of birth cannot be in the future.";
  if (member.address.trim().length > MAX_ADDRESS) return `The address can be at most ${MAX_ADDRESS} characters.`;
  if (member.staffNotes.trim().length > MAX_NOTES) return "The staff notes are too long.";
  if (credentials === "set" && password.length < MIN_PASSWORD_LENGTH) return `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (credentials === "email" && !email) return "There is no email address to send the password to: choose another way to hand it over.";

  if (!selling) return null;
  if (!pkg) return "Choose the package.";
  if (Number.isNaN(packagePrice(pkg))) return `The price of "${pkg.name}" cannot be read. Fix it on the Packages screen first.`;
  if (sale.startMode === "days") {
    const days = Number(sale.startAfterDays);
    if (sale.startAfterDays.trim() === "" || !Number.isInteger(days) || days < 0 || days > MAX_START_AHEAD_DAYS) {
      return `"Starts in" must be a whole number of days from 0 to ${MAX_START_AHEAD_DAYS}.`;
    }
  }
  if (sale.startMode === "date") {
    if (!sale.startDate) return "Choose the start date.";
    if (daysAhead(sale.startDate) > MAX_START_AHEAD_DAYS) return `A membership can start at most ${MAX_START_AHEAD_DAYS} days ahead.`;
  }
  if (Number.isNaN(readAmount(sale.discountAmount))) return "The discount must be an amount of 0 or more.";
  if (sale.admission === "amount") {
    const fee = readAmount(sale.admissionAmount);
    if (fee === null || Number.isNaN(fee)) return "Type the admission fee to charge (0 or more).";
  }
  if (sale.trainerId) {
    if (Number.isNaN(readAmount(sale.trainerFee))) return "The trainer fee must be an amount of 0 or more.";
    const commission = readAmount(sale.commissionValue);
    if (Number.isNaN(commission)) return "The trainer's commission must be an amount of 0 or more.";
    if (sale.commissionType === "percent" && (commission || 0) > 100) return "A percentage commission cannot be over 100.";
  }
  if (!DESK_METHOD_OPTIONS.some((o) => o.value === sale.paymentMethod)) return "Choose how they paid.";
  const paid = readAmount(sale.amountPaid);
  if (Number.isNaN(paid)) return "The amount paid must be an amount of 0 or more.";
  const { total } = totalsOf(sale, pkg);
  if (paid !== null && paid > total) return `The amount paid cannot be more than the ${money(total, pkg.currency)} charged.`;
  return null;
}

/** The thermal receipt for what the order recorded. */
function receiptFor(result: RegisterResult, profile: ReceiptProfile): ThermalReceiptProps | null {
  const o = result.order;
  if (!o) return null;
  const p = o.payment;
  const joiningFee = p.joiningFee || 0;
  const trainerFee = p.trainerFee || 0;
  // The package's price as sold: the subtotal less the fees charged beside it.
  const listPrice = round2((p.subtotal ?? (p.amount + (p.discountAmount || 0))) - joiningFee - trainerFee);
  const period = o.subscription?.startDate
    ? `${shortDate(o.subscription.startDate)} – ${shortDate(o.subscription.endDate)}`
    : o.packageDetails.period || undefined;
  const lines = [{ name: o.packageDetails.name, quantity: 1, unitPrice: listPrice, total: listPrice, detail: period }];
  if (joiningFee > 0) lines.push({ name: "Admission fee", quantity: 1, unitPrice: joiningFee, total: joiningFee, detail: undefined });
  if (trainerFee > 0) {
    lines.push({ name: "Personal trainer", quantity: 1, unitPrice: trainerFee, total: trainerFee, detail: o.trainerAssignment?.trainerName || undefined });
  }
  const m = result.member;
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  return {
    ...profile,
    title: "Membership receipt",
    number: o.invoice?.number || o.orderNumber,
    date: p.paidAt || new Date(),
    currency: (p.currency || "").toUpperCase(),
    customer: [name, m.memberCode ? `Member ID ${m.memberCode}` : ""].filter(Boolean).join(" · ") || undefined,
    lines,
    subtotal: round2(listPrice + joiningFee + trainerFee),
    discount: p.discountAmount || undefined,
    taxInclusive: true,
    total: p.amount,
    paid: p.amountPaid ?? p.amount,
    balanceDue: p.balanceDue ?? 0,
    method: methodLabel(p.method),
    notes: p.discountNote ? `Discount: ${p.discountNote}` : undefined,
  };
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-neutral-500">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SumRow({ label, value, strong = false, tone }: { label: string; value: string; strong?: boolean; tone?: "due" | "ok" }) {
  const color = tone === "due" ? "text-rose-700" : tone === "ok" ? "text-emerald-700" : "text-neutral-900";
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}>
      <span className="text-neutral-600">{label}</span>
      <span className={`tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export default function AddMemberModal({
  open,
  onClose,
  onRegistered,
  canSell,
}: {
  open: boolean;
  onClose: () => void;
  /** Called once the member exists, with what the API answered. */
  onRegistered: (result: RegisterResult) => void;
  /** package-orders · manage: without it the member is registered alone. */
  canSell: boolean;
}) {
  const [member, setMember] = useState(EMPTY_MEMBER);
  const [credentials, setCredentials] = useState<CredentialMode>("show");
  const [password, setPassword] = useState("");
  const [selling, setSelling] = useState(canSell);
  const [sale, setSale] = useState<SaleDraft>(EMPTY_SALE);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [profile, setProfile] = useState<ReceiptProfile>(EMPTY_RECEIPT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const [done, setDone] = useState<RegisterResult | null>(null);
  const [printing, setPrinting] = useState(false);

  // A fresh form each time it opens, and the pickers read again (a package
  // or trainer added a minute ago should be there).
  useEffect(() => {
    // Closed: the password shown after saving goes with it.
    if (!open) {
      setDone(null);
      return;
    }
    setMember(EMPTY_MEMBER);
    setCredentials("show");
    setPassword("");
    setSelling(canSell);
    setSale(EMPTY_SALE);
    setError(null);
    setLimitHit(false);
    setDone(null);
    if (!canSell) return;
    // The full list with this account's Packages tab, else what is on sale.
    apiGet<{ data?: PackageOption[] }>(`${GYMFOLIO_API}/packages`)
      .catch(() => apiGet<{ data?: PackageOption[] }>(`${GYMFOLIO_API}/packages/active`))
      .then((r) => setPackages((r.data || []).filter((p) => p.isActive !== false)))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the packages."));
    // The admin list carries each trainer's commission terms (trainers ·
    // view); without that tab the public list still names them.
    apiGet<{ data?: TrainerOption[] }>(`${GYMFOLIO_API}/trainers?limit=200`)
      .catch(() => apiGet<{ data?: TrainerOption[] }>(`${GYMFOLIO_API}/trainers/active`))
      .then((r) => setTrainers((r.data || []).filter((t) => t.isActive !== false)))
      .catch(() => setTrainers([]));
    // Without the letterhead a receipt still prints, just plainer.
    loadReceiptProfile(RECEIPT_PROFILE_URL)
      .then(setProfile)
      .catch(() => setProfile(EMPTY_RECEIPT_PROFILE));
  }, [open, canSell]);

  const pkg = packages.find((p) => p._id === sale.packageId);
  const currency = pkg?.currency || "";
  const totals = totalsOf(sale, pkg);
  const hasEmail = !!member.email.trim();
  const today = new Date();

  const setSaleField = (changes: Partial<SaleDraft>) => setSale((prev) => ({ ...prev, ...changes }));

  const chooseTrainer = (trainerId: string) => {
    const t = trainers.find((entry) => entry._id === trainerId);
    setSaleField({ trainerId, ...(trainerId ? commissionDefaults(t) : { commissionType: "percent", commissionValue: "", trainerFee: "" }) });
  };

  const submit = async () => {
    const problem = problemOf({ member, credentials, password, selling, sale, pkg });
    if (problem) {
      setError(problem);
      setLimitHit(false);
      return;
    }
    setSaving(true);
    setError(null);
    setLimitHit(false);
    const withTrainer = !!sale.trainerId;
    try {
      // Amounts go as typed: the API reads "5,000" as readily as 5000.
      const res = await apiJson<RegisterResult>(REGISTER_URL, "POST", {
        ...member,
        credentials,
        ...(credentials === "set" ? { password } : {}),
        membership: selling
          ? {
              packageId: sale.packageId,
              paymentMethod: sale.paymentMethod,
              startAfterDays: sale.startMode === "today" ? 0 : sale.startMode === "days" ? Number(sale.startAfterDays) : undefined,
              startDate: sale.startMode === "date" ? sale.startDate : undefined,
              discountAmount: sale.discountAmount || undefined,
              discountNote: sale.discountNote.trim() || undefined,
              waiveJoiningFee: sale.admission === "waive" || undefined,
              joiningFeeOverride: sale.admission === "amount" ? sale.admissionAmount : undefined,
              trainerId: sale.trainerId || undefined,
              trainerFee: withTrainer ? sale.trainerFee || undefined : undefined,
              trainerCommissionType: withTrainer ? sale.commissionType : undefined,
              trainerCommissionValue: withTrainer ? sale.commissionValue || undefined : undefined,
              amountPaid: sale.amountPaid.trim() === "" ? undefined : sale.amountPaid,
              notes: sale.notes.trim() || undefined,
            }
          : undefined,
      });
      setPassword("");
      setDone(res);
      onRegistered(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not register the member.");
      setLimitHit(isPlanLimitError(e));
    } finally {
      setSaving(false);
    }
  };

  const print = async () => {
    if (!done) return;
    const receipt = receiptFor(done, profile);
    if (!receipt) return;
    setPrinting(true);
    try {
      await printReceipt(receipt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not print the receipt.");
    } finally {
      setPrinting(false);
    }
  };

  const who = [member.firstName.trim(), member.lastName.trim()].filter(Boolean).join(" ");

  return (
    <Modal open={open} onClose={onClose} title={done ? "Member registered" : "Add member"} size="xl">
      {done ? (
        <Registered result={done} onPrint={print} printing={printing} error={error} onClose={onClose} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Registration date: <span className="font-semibold text-neutral-900">{shortDate(today)}</span> (today — set when the member is saved)
          </p>

          <Section title="Member">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextField label="First name" required value={member.firstName} onChange={(v) => setMember({ ...member, firstName: v })} />
              <TextField label="Last name" required value={member.lastName} onChange={(v) => setMember({ ...member, lastName: v })} />
              <TextField label={hasEmail ? "Phone (optional)" : "Phone"} required={!hasEmail} value={member.phone} onChange={(v) => setMember({ ...member, phone: v })} />
              <TextField
                label="Email (optional)"
                type="email"
                value={member.email}
                onChange={(v) => {
                  setMember({ ...member, email: v });
                  // Nowhere to email a password without an address.
                  if (!v.trim() && credentials === "email") setCredentials("show");
                }}
                placeholder="Leave empty if they have none"
              />
              <SelectField
                label="Gender (optional)"
                value={member.gender}
                onChange={(v) => setMember({ ...member, gender: v })}
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
                placeholder="Not given"
              />
              <TextField label="Date of birth (optional)" type="date" value={member.dateOfBirth} onChange={(v) => setMember({ ...member, dateOfBirth: v })} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <TextField label="Address (optional)" value={member.address} onChange={(v) => setMember({ ...member, address: v })} placeholder="House, street, town" />
              <TextArea label="Staff notes (optional, never shown to the member)" value={member.staffNotes} onChange={(v) => setMember({ ...member, staffNotes: v })} rows={1} />
            </div>
            <div className="mt-4">
              <CredentialsChoice mode={credentials} onMode={setCredentials} password={password} onPassword={setPassword} hasEmail={hasEmail} />
            </div>
          </Section>

          {canSell ? (
            <Section title="Membership" aside={<Toggle label="Sell a membership now" checked={selling} onChange={setSelling} />}>
              {selling ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <SelectField
                      label="Package"
                      value={sale.packageId}
                      onChange={(v) => setSaleField({ packageId: v })}
                      options={packages.map((p) => ({
                        value: p._id,
                        label: `${p.name} — ${money(packagePrice(p) || 0, p.currency)}${p.period ? ` / ${p.period}` : ""}`,
                        hint: (p.joiningFee || 0) > 0 ? `+ ${money(p.joiningFee, p.currency)} admission on a first membership` : undefined,
                      }))}
                      placeholder={packages.length ? "Choose a package" : "No packages on sale"}
                    />
                    <SelectField
                      label="Starts"
                      value={sale.startMode}
                      allowClear={false}
                      onChange={(v) => setSaleField({ startMode: (v as StartMode) || "today" })}
                      options={[
                        { value: "today", label: `Today (${shortDate(today)})` },
                        { value: "days", label: "After a number of days" },
                        { value: "date", label: "On a date" },
                      ]}
                    />
                    {sale.startMode === "days" ? (
                      <TextField label="Starts in (days from today)" type="number" value={sale.startAfterDays} onChange={(v) => setSaleField({ startAfterDays: v })} placeholder="e.g. 3" />
                    ) : sale.startMode === "date" ? (
                      <TextField label="Start date" type="date" value={sale.startDate} onChange={(v) => setSaleField({ startDate: v })} />
                    ) : (
                      <div />
                    )}
                    <TextField label="Discount (off the package price)" type="number" value={sale.discountAmount} onChange={(v) => setSaleField({ discountAmount: v })} placeholder="0" />
                    <TextField label="Discount note" value={sale.discountNote} onChange={(v) => setSaleField({ discountNote: v })} placeholder="Student, family, promotion…" />
                    <div />
                    <SelectField
                      label="Admission fee"
                      value={sale.admission}
                      allowClear={false}
                      onChange={(v) => setSaleField({ admission: (v as AdmissionMode) || "charge" })}
                      options={[
                        { value: "charge", label: pkg ? `Charge ${money(pkg.joiningFee || 0, currency)}` : "Charge the package's fee" },
                        { value: "waive", label: "Waive it" },
                        { value: "amount", label: "Charge a different amount" },
                      ]}
                    />
                    {sale.admission === "amount" && (
                      <TextField label="Admission fee to charge" type="number" value={sale.admissionAmount} onChange={(v) => setSaleField({ admissionAmount: v })} />
                    )}
                  </div>

                  <div className="rounded-lg bg-neutral-50 p-3">
                    <p className="text-xs font-semibold text-neutral-700">Personal trainer (optional)</p>
                    <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <SelectField
                        label="Trainer"
                        value={sale.trainerId}
                        onChange={chooseTrainer}
                        options={trainers.map((t) => ({ value: t._id, label: t.name }))}
                        placeholder="No trainer"
                      />
                      {sale.trainerId && (
                        <>
                          <TextField label="Trainer fee (charged to the member)" type="number" value={sale.trainerFee} onChange={(v) => setSaleField({ trainerFee: v })} placeholder="0" />
                          <SelectField
                            label="Trainer's commission"
                            value={sale.commissionType}
                            allowClear={false}
                            onChange={(v) => setSaleField({ commissionType: v === "amount" ? "amount" : "percent" })}
                            options={[
                              { value: "percent", label: "Percent of the trainer fee" },
                              { value: "amount", label: "Fixed amount" },
                            ]}
                          />
                          <TextField
                            label={sale.commissionType === "percent" ? "Commission (%)" : "Commission (amount)"}
                            type="number"
                            value={sale.commissionValue}
                            onChange={(v) => setSaleField({ commissionValue: v })}
                          />
                        </>
                      )}
                    </div>
                    {sale.trainerId && (
                      <p className="mt-2 text-xs text-neutral-500">The commission starts from the trainer&apos;s own terms. They become the member&apos;s assigned trainer.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">Only the member is registered. Sell them a membership later from their row (Package) or Package Orders.</p>
              )}
            </Section>
          ) : (
            <p className="rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-500">
              Your role can add members but not sell memberships, so only the member is registered.
            </p>
          )}

          {canSell && selling && (
            <Section title="Payment">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <SelectField
                    label="Paid by"
                    value={sale.paymentMethod}
                    allowClear={false}
                    onChange={(v) => setSaleField({ paymentMethod: v || "cash" })}
                    options={DESK_METHOD_OPTIONS}
                  />
                  <TextField
                    label="Amount paid now"
                    type="number"
                    value={sale.amountPaid}
                    onChange={(v) => setSaleField({ amountPaid: v })}
                    placeholder={pkg ? `${totals.total} (blank = paid in full)` : "Blank = paid in full"}
                  />
                  <TextField label="Notes on the sale (optional)" value={sale.notes} onChange={(v) => setSaleField({ notes: v })} />
                </div>
                <div className="space-y-1.5 rounded-lg bg-neutral-50 p-4 text-sm">
                  <SumRow label="Package" value={money(totals.price, currency)} />
                  {totals.discount > 0 && <SumRow label="Discount" value={`− ${money(totals.discount, currency)}`} />}
                  <SumRow label="Admission fee" value={money(totals.admission, currency)} />
                  {sale.trainerId && <SumRow label="Trainer fee" value={money(totals.trainerFee, currency)} />}
                  <div className="my-2 border-t border-neutral-200" />
                  <SumRow label="Total" value={money(totals.total, currency)} strong />
                  <SumRow label="Paid now" value={money(totals.paid, currency)} />
                  <SumRow label="Balance due" value={money(totals.balance, currency)} strong tone={totals.balance > 0 ? "due" : "ok"} />
                  <p className="pt-2 text-xs text-neutral-500">
                    The admission fee is charged on a first membership only. A balance left owing is collected later; the membership starts either way.
                  </p>
                </div>
              </div>
            </Section>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
              {limitHit && <UpgradePlanLink />}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton onClick={submit} disabled={saving}>
              {saving ? "Saving…" : canSell && selling ? `Register ${who || "member"} & take payment` : `Register ${who || "member"}`}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** After saving: the member's ID, the password to hand over (this once), the receipt. */
function Registered({
  result,
  onPrint,
  printing,
  error,
  onClose,
}: {
  result: RegisterResult;
  onPrint: () => void;
  printing: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const m = result.member;
  const o = result.order;
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || "The member";
  const currency = o?.payment.currency || "";
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <p className="font-semibold">{name} is registered.</p>
        <p className="mt-0.5">
          {m.memberCode ? `Member ID ${m.memberCode}. ` : ""}
          {m.username ? `Username ${m.username}. ` : ""}
          {result.emailed ? `Their password was emailed to ${m.email}.` : ""}
        </p>
      </div>

      {result.credentials === "email" && !result.emailed && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The password email could not be sent{result.emailError ? ` (${result.emailError})` : ""}.
          {result.password ? " Hand them the password below instead." : " Set a password for them from their row."}
        </p>
      )}

      {result.password && (
        <div className="rounded-lg border border-amber-200 p-4">
          <p className="text-xs font-semibold text-neutral-700">Password — shown once</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 select-all break-all rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-base font-semibold tracking-wide text-neutral-900">
              {result.password}
            </code>
            <CopyButton text={result.password} />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            It is not stored anywhere readable and will not be shown again. They sign in with {m.username ? `the username ${m.username}` : "their username"}
            {m.email ? " or their email" : ""} and can change it from their account page.
          </p>
        </div>
      )}

      {o && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-neutral-50 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-neutral-500">Membership</p>
            <p className="font-medium text-neutral-900">{o.packageDetails.name}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Runs</p>
            <p className="text-neutral-900">
              {shortDate(o.subscription?.startDate)} – {shortDate(o.subscription?.endDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Paid by</p>
            <p className="text-neutral-900">{methodLabel(o.payment.method)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Total</p>
            <p className="font-medium text-neutral-900">{money(o.payment.amount, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Paid</p>
            <p className="text-neutral-900">{money(o.payment.amountPaid ?? o.payment.amount, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Balance due</p>
            <p className={`font-semibold ${(o.payment.balanceDue || 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {money(o.payment.balanceDue || 0, currency)}
            </p>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        {o && (
          <SecondaryButton onClick={onPrint} disabled={printing}>
            {printing ? "Printing…" : "Print receipt"}
          </SecondaryButton>
        )}
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </div>
    </div>
  );
}
