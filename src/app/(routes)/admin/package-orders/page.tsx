"use client";

// Memberships sold: every order, what paid for it, and everything staff can
// do to it afterwards -- confirm a bank transfer, freeze, cancel, renew,
// switch package, tick off a session, print the invoice.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  Card,
  EmptyState,
  useConfirm,
  ErrorState,
  useLatestRequest,
  useRequestId,
} from "../_shared/ui";
import { ApiError, GYMFOLIO_API, apiBlob, apiGet, apiJson, absoluteUrl, replaceParams } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { MemberPicker, type MemberOption } from "../_ops/MemberPicker";
import { Pager, pageCount } from "../_ops/lists";

const PAGE_SIZE = 50;

interface PackageOption {
  _id: string;
  name: string;
  price: string | number;
  currency?: string;
  period?: string;
  kind?: string;
  joiningFee?: number;
  billing?: { mode: string; interval: string; intervalCount: number };
}

interface TrainerOption {
  _id: string;
  name: string;
}

interface PackageOrder {
  _id: string;
  orderNumber: string;
  userId?: { _id: string; firstName?: string; lastName?: string; email: string; memberCode?: string } | string | null;
  packageDetails: { name: string; price: string; currency: string; period: string; kind?: string; sessions?: number; billing?: { mode: string } };
  customerInfo: { fullName: string; email: string; phone: string };
  payment: {
    amount: number;
    // The admission and trainer's fees inside `amount`; the rest is the membership.
    joiningFee?: number;
    trainerFee?: number;
    // Paid in parts: what has come in (null on older orders: all of it),
    // what is still owed, and each payment received.
    amountPaid?: number | null;
    balanceDue?: number;
    installments?: { amount: number; method?: string; at: string; note?: string }[];
    subtotal?: number;
    discountAmount?: number;
    discountNote?: string;
    couponCode?: string;
    currency: string;
    status: string;
    method: string;
    paidAt?: string;
    stripeSubscriptionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeSessionId?: string | null;
    lastPaymentError?: string;
    proof?: { url?: string; note?: string; reference?: string; uploadedAt?: string; rejectionReason?: string };
  };
  subscription?: {
    isActive: boolean;
    startDate?: string;
    endDate?: string;
    cancelAtPeriodEnd?: boolean;
    autoRenew?: boolean;
    stripeStatus?: string;
    renewals?: { at: string; amount: number; currency: string }[];
  };
  freeze?: { isFrozen: boolean; resumeAt?: string | null; totalFrozenDays?: number; reason?: string };
  cancellation?: { cancelledAt?: string | null; reason?: string; source?: string };
  refund?: { amount?: number | null; reason?: string; at?: string | null; stripeRefundId?: string | null };
  // Changes staff made to the dates or the discount after the sale.
  termsHistory?: { at: string; note?: string; from: Terms; to: Terms }[];
  sessions?: { total: number; used: number };
  invoice?: { number?: string | null };
  status: string;
  createdAt: string;
  notes?: string;
}

const statusColors: Record<string, "neutral" | "green" | "amber" | "rose" | "blue"> = {
  pending: "amber",
  processing: "blue",
  paid: "green",
  active: "green",
  frozen: "blue",
  past_due: "amber",
  expired: "neutral",
  failed: "rose",
  cancelled: "rose",
  suspended: "rose",
  refunded: "neutral",
};

// The backend's services/paymentMethods.js, label for label.
const METHOD_LABELS: Record<string, string> = {
  stripe: "Card (Stripe)",
  card: "Card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  wallet: "Other mobile wallet",
};
// What the desk records by hand: every method but Stripe, which is only ever
// paid through online checkout (the API refuses it here with a 422).
const DESK_METHOD_OPTIONS = Object.entries(METHOD_LABELS)
  .filter(([value]) => value !== "stripe")
  .map(([value, label]) => ({ value, label }));
// Stripe subscription statuses that never charge again on their own (the
// backend's reminderJobs reads them the same way).
const NOT_RENEWING_STRIPE_STATUSES = ["canceled", "incomplete", "incomplete_expired", "unpaid", "paused"];
const ORDER_STATUSES = ["pending", "active", "frozen", "past_due", "expired", "cancelled"];
const PAYMENT_STATUSES = ["pending", "processing", "paid", "failed", "refunded"];

// hasDues: "1" lists only orders with money still owed on them.
type Filters = { search: string; status: string; paymentStatus: string; paymentMethod: string; hasDues: string };
type PanelAction = "" | "status" | "freeze" | "cancel" | "renew" | "change" | "reject" | "refund" | "payment" | "terms";
type Terms = { startDate?: string | null; endDate?: string | null; discountAmount?: number; discountNote?: string; amount?: number; balanceDue?: number };
// Refusals that mean the order is no longer as this page shows it: a
// colleague confirmed the transfer first or is doing so now, or it has since
// been refunded or rejected.
const ORDER_MOVED_ON = ["ALREADY_PAID", "ORDER_CLOSED", "REVIEW_IN_PROGRESS"];

// The list's filters as the address gives them (the bell links to
// ?status=past_due, for one). A value the filters do not offer is ignored.
function filtersFrom(params: { get(key: string): string | null }): Filters {
  const offered = (value: string | null, options: string[]) => (value && options.includes(value) ? value : "");
  return {
    search: params.get("search") ?? "",
    status: offered(params.get("status"), ORDER_STATUSES),
    paymentStatus: offered(params.get("paymentStatus"), PAYMENT_STATUSES),
    paymentMethod: offered(params.get("paymentMethod"), Object.keys(METHOD_LABELS)),
    hasDues: params.get("hasDues") === "1" ? "1" : "",
  };
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

// A date as a date input holds it (YYYY-MM-DD, this browser's calendar).
function dateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function money(amount: number | undefined, currency: string) {
  return `${(currency || "").toUpperCase()} ${Number(amount || 0).toLocaleString()}`;
}

// The fees inside an order's amount ("GBP 25 admission · GBP 30 trainer"),
// or "" when it carries none.
function feeParts(o: PackageOrder) {
  const p = o.payment || ({} as PackageOrder["payment"]);
  return [
    (p.joiningFee || 0) > 0 ? `${money(p.joiningFee, p.currency)} admission` : "",
    (p.trainerFee || 0) > 0 ? `${money(p.trainerFee, p.currency)} trainer` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function memberName(o: PackageOrder) {
  const u = o.userId && typeof o.userId === "object" ? o.userId : null;
  return (u && [u.firstName, u.lastName].filter(Boolean).join(" ")) || o.customerInfo?.fullName || o.customerInfo?.email;
}

function PackageOrdersAdminPageInner() {
  const { can } = usePermissions();
  const { ask, dialog: confirmDialog } = useConfirm();
  // Sent with a sale, a renewal and a part payment, so one pressed twice
  // after a lost reply is recorded once.
  const requestId = useRequestId();
  const manage = can("package-orders", "manage");
  // The filters live in the address as well, and it can name an order to
  // open (?id=, from the header search). Read again whenever the address
  // changes, so a second link followed from this page lands too.
  const searchParams = useSearchParams();
  const url = filtersFrom(searchParams);
  const urlId = searchParams.get("id");

  const [list, setList] = useState<PackageOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(url);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState<PackageOrder | null>(null);
  const [action, setAction] = useState<PanelAction>("");
  const [draft, setDraft] = useState<Record<string, string>>({});

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMember, setAssignMember] = useState<MemberOption | null>(null);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const emptyAssign = {
    packageId: "",
    paymentMethod: "cash",
    markPaid: "yes",
    durationMonths: "",
    notes: "",
    couponCode: "",
    amount: "",
    // When the term starts: "" = when the current membership ends (or now),
    // "date" = on startDate, "days" = startAfterDays from today.
    startMode: "",
    startDate: "",
    startAfterDays: "",
    discountAmount: "",
    discountNote: "",
    // Blank: paid in full. Less than the total: granted now, the rest due.
    amountPaid: "",
    waiveJoiningFee: "no",
    trainerId: "",
    trainerFee: "",
    trainerCommissionType: "percent",
    trainerCommissionValue: "",
  };
  const [assignDraft, setAssignDraft] = useState(emptyAssign);

  // Paged: a fixed limit of 200 used to cut the list off without saying so
  // beyond a small "showing N of M".
  const begin = useLatestRequest();
  const load = useCallback(async () => {
    const isLatest = begin();
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.status) params.set("status", filters.status);
      if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
      if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
      if (filters.hasDues) params.set("hasDues", "1");
      const r = await apiGet<{ data: PackageOrder[]; pagination?: { total?: number; pages?: number; limit?: number } }>(`${GYMFOLIO_API}/package-orders?${params.toString()}`);
      if (!isLatest()) return;
      setList(r.data || []);
      setTotal(r.pagination?.total ?? (r.data || []).length);
      setPages(pageCount(r.pagination));
      setLoadErr(null);
    } catch (e) {
      if (!isLatest()) return;
      setList([]);
      setTotal(0);
      setLoadErr(e instanceof Error ? e.message : "Could not load orders");
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [filters, page, begin]);

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  // A new filter starts again from the first page.
  const filterBy = (change: Partial<Filters>) => {
    setPage(1);
    setFilters({ ...filters, ...change });
    replaceParams(change);
  };

  // A link followed while already here brings a whole new set of filters.
  // (Changes made on the page come back through here too, already applied.)
  useEffect(() => {
    const next = { search: url.search, status: url.status, paymentStatus: url.paymentStatus, paymentMethod: url.paymentMethod, hasDues: url.hasDues };
    setFilters((prev) =>
      prev.search === next.search && prev.status === next.status && prev.paymentStatus === next.paymentStatus && prev.paymentMethod === next.paymentMethod && prev.hasDues === next.hasDues
        ? prev
        : next
    );
    setPage(1);
  }, [url.search, url.status, url.paymentStatus, url.paymentMethod, url.hasDues]);

  // Members come from the picker's own search. Packages: the full list when
  // this account has the Packages tab, else the ones on sale right now.
  const loadPickers = async () => {
    try {
      const p = await apiGet<{ data?: PackageOption[] }>(`${GYMFOLIO_API}/packages`).catch(() =>
        apiGet<{ data?: PackageOption[] }>(`${GYMFOLIO_API}/packages/active`)
      );
      setPackages(p.data || []);
      // The trainers who can be sold with a membership: the active ones.
      const t = await apiGet<{ data?: TrainerOption[] }>(`${GYMFOLIO_API}/trainers/active`).catch(() => ({ data: [] as TrainerOption[] }));
      setTrainers(t.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load packages.");
    }
  };

  const openAssign = async () => {
    requestId.reset();
    setAssignDraft(emptyAssign);
    setAssignMember(null);
    setError(null);
    setAssignOpen(true);
    await loadPickers();
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = (await fn()) as { message?: string } | null | undefined;
      // null: they backed out of a question asked on the way. Nothing was done.
      if (res === null) return;
      requestId.reset();
      setNotice((res && res.message) || label);
      setAction("");
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      // The reason stays on screen, over the order and the list read again,
      // so what is offered next is what can still be done.
      if (e instanceof ApiError && ORDER_MOVED_ON.includes(e.code || "")) await refreshAfterRefusal();
    } finally {
      setBusy(false);
    }
  };

  const refreshAfterRefusal = async () => {
    const open = selected;
    if (open) {
      const fresh = await apiGet<{ data?: PackageOrder }>(`${GYMFOLIO_API}/package-orders/${open._id}`).catch(() => null);
      if (fresh?.data) {
        setSelected(fresh.data);
        setAction("status");
      }
    }
    await load();
  };

  const assignPackage = () =>
    run("Package assigned.", async () => {
      if (!assignMember || !assignDraft.packageId) throw new Error("Choose both a member and a package.");
      const d = assignDraft;
      const withTrainer = !!d.trainerId;
      // Amounts go as typed: the API reads "5,000" as readily as 5000, and
      // says which field it could not read.
      const body = {
        userId: assignMember.id,
        packageId: d.packageId,
        paymentMethod: d.paymentMethod,
        markPaid: d.markPaid === "yes",
        durationMonths: d.durationMonths ? Number(d.durationMonths) : undefined,
        notes: d.notes || undefined,
        couponCode: d.couponCode || undefined,
        amountOverride: d.amount || undefined,
        startDate: d.startMode === "date" ? d.startDate || undefined : undefined,
        startAfterDays: d.startMode === "days" && d.startAfterDays !== "" ? Number(d.startAfterDays) : undefined,
        discountAmount: d.discountAmount || undefined,
        discountNote: d.discountNote || undefined,
        waiveJoiningFee: d.waiveJoiningFee === "yes" || undefined,
        amountPaid: d.markPaid === "yes" && d.amountPaid !== "" ? d.amountPaid : undefined,
        trainerId: d.trainerId || undefined,
        trainerFee: withTrainer ? d.trainerFee || undefined : undefined,
        trainerCommissionType: withTrainer ? d.trainerCommissionType : undefined,
        trainerCommissionValue: withTrainer ? d.trainerCommissionValue || undefined : undefined,
      };
      const res = await apiJson<{ message: string }>(`${GYMFOLIO_API}/package-orders/assign`, "POST", { ...body, requestId: requestId.for("assign", body) });
      setAssignOpen(false);
      return res;
    });

  // The manage panel on one order, its forms reset.
  const openOrder = (o: PackageOrder, a: PanelAction) => {
    setSelected(o);
    setAction(a);
    setDraft({
      status: o.status,
      days: "7",
      reason: "",
      immediate: "no",
      paymentMethod: "cash",
      markPaid: "yes",
      months: "",
      packageId: "",
      amount: "",
      amountOverride: "",
      startDate: "",
      discountAmount: "",
      discountNote: "",
      amountPaid: "",
      payAmount: "",
      payMethod: "cash",
      payNote: "",
      termsStart: "",
      termsEnd: "",
      termsDiscount: "",
      termsDiscountNote: "",
      termsNote: "",
    });
  };

  const openAction = async (o: PackageOrder, a: typeof action) => {
    requestId.reset();
    openOrder(o, a);
    if (a === "change" && !packages.length) await loadPickers();
  };

  // Fetched on its own, as it need not be on the page of the list shown, and
  // then dropped from the address: closing the panel is final, and the same
  // link followed again opens it again.
  useEffect(() => {
    if (!urlId) return;
    replaceParams({ id: null });
    apiGet<{ data?: PackageOrder }>(`${GYMFOLIO_API}/package-orders/${encodeURIComponent(urlId)}`)
      .then((r) => {
        if (r.data) openOrder(r.data, "status");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not open that order"));
  }, [urlId]);

  const post = (o: PackageOrder, path: string, body?: unknown) => apiJson<{ message: string }>(`${GYMFOLIO_API}/package-orders/${o._id}/${path}`, "POST", body);
  // The same, for money taken at the desk: carries this attempt's id.
  const postOnce = (o: PackageOrder, path: string, body: Record<string, unknown>) => post(o, path, { ...body, requestId: requestId.for(`${path} ${o._id}`, body) });

  // Card payments go back through Stripe; cash, bank and desk-terminal ones
  // are only recorded -- the money moves by hand. Either way the membership
  // ends now, which is why this asks first.
  const viaStripe = (o: PackageOrder) => o.payment.method === "stripe" || !!o.payment.stripePaymentIntentId || !!o.payment.stripeSessionId;
  const refund = async (o: PackageOrder) => {
    const amount = draft.amount.trim();
    const shown = amount ? money(Number(amount), o.payment.currency) : `the full ${money(o.payment.amountPaid ?? o.payment.amount, o.payment.currency)}`;
    const how = viaStripe(o) ? "It is sent back to the member's card through Stripe." : "Give the money back by hand; this only records it.";
    const answer = await ask({
      title: `Refund ${shown} on ${o.orderNumber}?`,
      body: `${how} The membership is cancelled straight away. This cannot be undone.`,
      confirmLabel: "Refund",
    });
    if (answer === null) return;
    run("Refunded.", () => post(o, "refund", { amount: amount || undefined, reason: draft.reason }));
  };

  // Unused days worth more than the new package costs cannot all come off its
  // price, and the member would lose the rest. The API refuses that (409
  // CREDIT_EXCEEDS_PRICE, with the figures) until the desk has agreed to it:
  // this asks, and sends the change again with `forfeitCredit`. Backing out
  // opens the refund form with the credit filled in, the other way through.
  const changePackage = (o: PackageOrder) =>
    run("Package changed.", async () => {
      const body = { packageId: draft.packageId, paymentMethod: draft.paymentMethod };
      try {
        return await post(o, "change-package", body);
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== "CREDIT_EXCEEDS_PRICE" || !e.details) throw e;
        const sum = (n: unknown) => money(Number(n) || 0, String(e.details?.currency || o.payment.currency));
        const credit = sum(e.details.credit);
        const lost = sum(e.details.creditUnused);
        const chosen = packages.find((p) => p._id === draft.packageId)?.name || "the new package";
        const answer = await ask({
          title: `Give up ${lost} of this member's credit?`,
          body: (
            <>
              <ul className="space-y-1">
                <li>
                  Unused days already paid for: <strong className="text-neutral-900">{credit}</strong>
                </li>
                <li>
                  {chosen} costs: <strong className="text-neutral-900">{sum(e.details.price)}</strong>
                </li>
                <li>
                  Would be given up: <strong className="text-neutral-900">{lost}</strong>
                </li>
              </ul>
              <p className="mt-3">
                To give the money back instead, go back, refund the {credit} and then assign {chosen}. If you continue, {chosen} is covered by the credit and the other {lost} is not paid back.
              </p>
            </>
          ),
          confirmLabel: `Change and give up ${lost}`,
          cancelLabel: "Go back and refund first",
        });
        if (answer === null) {
          setDraft((d) => ({ ...d, amount: String(e.details?.credit ?? ""), reason: `Unused days, before changing to ${chosen}` }));
          setAction("refund");
          return null;
        }
        return post(o, "change-package", { ...body, forfeitCredit: true });
      }
    });

  const invoiceUrl = (o: PackageOrder) => `${GYMFOLIO_API}/package-orders/${o._id}/invoice.pdf?download=1`;
  const openInvoice = async (o: PackageOrder) => {
    try {
      const { blob } = await apiBlob(invoiceUrl(o));
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the invoice");
    }
  };

  const select = "h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700";
  const isPack = (o: PackageOrder) => !!(o.sessions && o.sessions.total > 0);
  const live = (o: PackageOrder) => o.payment.status === "paid" && ["active", "frozen", "past_due"].includes(o.status);
  // A card subscription Stripe will charge again at the end of the term by
  // itself -- nobody has told it to stop. A Renew taken at the desk on top
  // of it would make the member pay twice, so the panel offers none. The
  // same rule as the backend's reminderJobs.willAutoRenew, which the renew
  // endpoint also checks: should the two ever disagree, its refusal (409)
  // is shown as the panel's error, and the page never sends `force`.
  const autoRenewsByCard = (o: PackageOrder) =>
    !!o.payment.stripeSubscriptionId &&
    o.subscription?.autoRenew === true &&
    !o.subscription?.cancelAtPeriodEnd &&
    !NOT_RENEWING_STRIPE_STATUSES.includes((o.subscription?.stripeStatus || "").toLowerCase());
  // A card renewal Stripe could not collect and is still retrying: the fix
  // is a working card, not a second payment.
  const cardPaymentFailed = (o: PackageOrder) => o.status === "past_due" && !!o.payment.stripeSubscriptionId;

  return (
    <div>
      {confirmDialog}
      <PageHeader eyebrow="Sales" title="Package Orders" actions={manage ? <PrimaryButton onClick={openAssign}>Assign Package</PrimaryButton> : undefined} />

      {notice && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}
      {error && !selected && !assignOpen && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={filters.search}
          onChange={(e) => filterBy({ search: e.target.value })}
          placeholder="Search order #, name, email…"
          className="h-9 w-64 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:border-neutral-400 focus:outline-none"
        />
        <select value={filters.status} onChange={(e) => filterBy({ status: e.target.value })} className={select}>
          <option value="">Any status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select value={filters.paymentStatus} onChange={(e) => filterBy({ paymentStatus: e.target.value })} className={select}>
          <option value="">Any payment</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "processing" ? "awaiting review" : s}
            </option>
          ))}
        </select>
        <select value={filters.paymentMethod} onChange={(e) => filterBy({ paymentMethod: e.target.value })} className={select}>
          <option value="">Any method</option>
          {Object.entries(METHOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={filters.hasDues === "1"} onChange={(e) => filterBy({ hasDues: e.target.checked ? "1" : "" })} className="h-4 w-4 accent-[var(--accent)]" />
          Has dues
        </label>
        {!loading && !loadErr && <span className="text-xs text-neutral-500">{total} order{total === 1 ? "" : "s"}</span>}
      </div>

      {loading ? (
        <Spinner />
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : !list.length ? (
        <EmptyState title="No package orders match" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["Order #", "Member", "Package", "Amount", "Due", "Method", "Payment", "Membership", "Runs", ""].map((c) => (
                    <th key={c} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o._id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                    <td className="px-4 py-3 align-top">
                      <code className="text-xs text-neutral-700">{o.orderNumber}</code>
                      {o.invoice?.number && <p className="text-[11px] text-neutral-400">{o.invoice.number}</p>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-neutral-900">{memberName(o)}</div>
                      <div className="text-xs text-neutral-500">{o.customerInfo?.email}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {o.packageDetails?.name}
                      {isPack(o) && (
                        <p className="text-[11px] text-neutral-500">
                          {o.sessions!.used} / {o.sessions!.total} sessions used
                        </p>
                      )}
                      {o.packageDetails?.billing?.mode === "recurring" && <p className="text-[11px] text-neutral-500">recurring{o.subscription?.cancelAtPeriodEnd ? " · ends at period end" : ""}</p>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {money(o.payment?.amount, o.payment?.currency)}
                      {feeParts(o) && <p className="text-[11px] text-neutral-500">incl. {feeParts(o)}</p>}
                      {(o.payment?.discountAmount || 0) > 0 &&<p className="text-[11px] text-emerald-700">−{money(o.payment.discountAmount, o.payment.currency)} {o.payment.couponCode || "credit"}</p>}
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {(o.payment?.balanceDue || 0) > 0 ? <span className="font-medium text-amber-700">{money(o.payment.balanceDue, o.payment.currency)}</span> : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-neutral-600">{METHOD_LABELS[o.payment?.method] || o.payment?.method}</td>
                    <td className="px-4 py-3 align-top">
                      <Badge color={statusColors[o.payment?.status] || "neutral"}>{o.payment?.status === "processing" ? "awaiting review" : o.payment?.status}</Badge>
                      {o.payment?.lastPaymentError && <p className="mt-1 max-w-[160px] text-[11px] text-rose-600">{o.payment.lastPaymentError}</p>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge color={statusColors[o.status] || "neutral"}>{o.status.replace("_", " ")}</Badge>
                      {o.status === "frozen" && o.freeze?.resumeAt && <p className="mt-1 text-[11px] text-neutral-500">until {fmtDate(o.freeze.resumeAt)}</p>}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-neutral-600 whitespace-nowrap">
                      {fmtDate(o.subscription?.startDate)} → {fmtDate(o.subscription?.endDate)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <SecondaryButton onClick={() => openAction(o, "status")}>{manage ? "Manage" : "View"}</SecondaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Pager page={page} pages={pages} total={total} onChange={setPage} disabled={loading} />

      {/* ---- Assign ---- */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Package to Member" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">Creates a membership without going through checkout — for payments taken in person or a comped package.</p>
          <MemberPicker label="Member" value={assignMember} onChange={setAssignMember} />
          <SelectField
            label="Package"
            value={assignDraft.packageId}
            onChange={(v) => setAssignDraft({ ...assignDraft, packageId: v })}
            options={packages.map((p) => ({ value: p._id, label: `${p.name} — ${(p.currency || "").toUpperCase()} ${p.price}/${p.period || "month"}` }))}
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
            <SelectField
              label="Starts"
              value={assignDraft.startMode}
              allowClear={false}
              onChange={(v) => setAssignDraft({ ...assignDraft, startMode: v })}
              options={[
                { value: "", label: "Now (or when their current membership ends)" },
                { value: "date", label: "On a date" },
                { value: "days", label: "In a number of days" },
              ]}
            />
            {assignDraft.startMode === "date" ? (
              <TextField label="Start date" type="date" value={assignDraft.startDate} onChange={(v) => setAssignDraft({ ...assignDraft, startDate: v })} />
            ) : assignDraft.startMode === "days" ? (
              <TextField label="Starts in (days from today)" type="number" value={assignDraft.startAfterDays} onChange={(v) => setAssignDraft({ ...assignDraft, startAfterDays: v })} placeholder="e.g. 3" />
            ) : (
              <TextField label="Duration in months (optional)" type="number" value={assignDraft.durationMonths} onChange={(v) => setAssignDraft({ ...assignDraft, durationMonths: v })} placeholder="Defaults to the package period" />
            )}
            <TextField label="Discount (off the package price)" type="number" value={assignDraft.discountAmount} onChange={(v) => setAssignDraft({ ...assignDraft, discountAmount: v })} />
            <TextField label="Discount note" value={assignDraft.discountNote} onChange={(v) => setAssignDraft({ ...assignDraft, discountNote: v })} placeholder="Student, family, promotion…" />
            <TextField label="Coupon code (optional)" value={assignDraft.couponCode} onChange={(v) => setAssignDraft({ ...assignDraft, couponCode: v.toUpperCase() })} />
            <TextField label="Override amount (optional)" type="number" value={assignDraft.amount} onChange={(v) => setAssignDraft({ ...assignDraft, amount: v })} placeholder="Charged as-is" />
            {assignDraft.markPaid === "yes" && (
              <TextField
                label="Amount paid now (optional)"
                type="number"
                value={assignDraft.amountPaid}
                onChange={(v) => setAssignDraft({ ...assignDraft, amountPaid: v })}
                placeholder="Blank = paid in full; the rest is due"
              />
            )}
            {(packages.find((p) => p._id === assignDraft.packageId)?.joiningFee || 0) > 0 && (
              <SelectField
                label="Joining fee"
                value={assignDraft.waiveJoiningFee}
                allowClear={false}
                onChange={(v) => setAssignDraft({ ...assignDraft, waiveJoiningFee: v })}
                options={[
                  { value: "no", label: "Charge it (first membership only)" },
                  { value: "yes", label: "Waive it" },
                ]}
              />
            )}
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <p className="text-xs font-semibold text-neutral-700">Personal trainer (optional)</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Trainer"
                value={assignDraft.trainerId}
                onChange={(v) => setAssignDraft({ ...assignDraft, trainerId: v })}
                options={trainers.map((t) => ({ value: t._id, label: t.name }))}
                placeholder="No trainer"
              />
              {assignDraft.trainerId && (
                <>
                  <TextField label="Trainer fee (charged to the member)" type="number" value={assignDraft.trainerFee} onChange={(v) => setAssignDraft({ ...assignDraft, trainerFee: v })} />
                  <SelectField
                    label="Trainer's commission"
                    value={assignDraft.trainerCommissionType}
                    allowClear={false}
                    onChange={(v) => setAssignDraft({ ...assignDraft, trainerCommissionType: v })}
                    options={[
                      { value: "percent", label: "Percent of the trainer fee" },
                      { value: "amount", label: "Fixed amount" },
                    ]}
                  />
                  <TextField
                    label={assignDraft.trainerCommissionType === "percent" ? "Commission (%)" : "Commission (amount)"}
                    type="number"
                    value={assignDraft.trainerCommissionValue}
                    onChange={(v) => setAssignDraft({ ...assignDraft, trainerCommissionValue: v })}
                  />
                </>
              )}
            </div>
            {assignDraft.trainerId && <p className="mt-2 text-xs text-neutral-500">The member&apos;s assigned trainer becomes this one.</p>}
          </div>
          <TextField label="Notes (optional)" value={assignDraft.notes} onChange={(v) => setAssignDraft({ ...assignDraft, notes: v })} />
          <p className="text-xs text-neutral-500">
            Unless a start is chosen, a membership bought while another is live starts when that one ends. The joining fee is added only to a member&apos;s first membership.
          </p>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={() => setAssignOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={assignPackage} disabled={busy}>
              {busy ? "Assigning..." : "Assign Package"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {/* ---- Manage ---- */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setAction(""); }} title={`Order ${selected?.orderNumber || ""}`} size="lg" busy={busy} error={error}>
        {selected && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-neutral-500">Member</p>
                <p className="text-neutral-900">{memberName(selected)} — {selected.customerInfo.email}</p>
              </div>
              <div>
                <p className="text-neutral-500">Package</p>
                <p className="text-neutral-900">
                  {selected.packageDetails.name} ({selected.packageDetails.currency} {selected.packageDetails.price} / {selected.packageDetails.period})
                </p>
              </div>
              <div>
                <p className="text-neutral-500">Paid</p>
                <p className="text-neutral-900">
                  {money(selected.payment.amount, selected.payment.currency)} · {METHOD_LABELS[selected.payment.method] || selected.payment.method} · {selected.payment.status}
                  {selected.payment.paidAt ? ` on ${fmtDate(selected.payment.paidAt)}` : ""}
                </p>
                {feeParts(selected) && <p className="text-xs text-neutral-500">incl. {feeParts(selected)}</p>}
                {(selected.payment.balanceDue || 0) > 0 && (
                  <p className="text-xs font-medium text-amber-700">
                    {money(selected.payment.amountPaid ?? 0, selected.payment.currency)} paid so far · {money(selected.payment.balanceDue, selected.payment.currency)} due
                  </p>
                )}
                {(selected.payment.installments || []).length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-neutral-500">
                    {(selected.payment.installments || []).map((part, i) => (
                      <li key={i}>
                        {fmtDate(part.at)} · {money(part.amount, selected.payment.currency)} · {METHOD_LABELS[part.method || selected.payment.method] || part.method}
                        {part.note ? ` — ${part.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {selected.payment.discountNote && <p className="text-xs text-neutral-500">{selected.payment.discountNote}</p>}
              </div>
              <div>
                <p className="text-neutral-500">Runs</p>
                <p className="text-neutral-900">
                  {fmtDate(selected.subscription?.startDate)} → {fmtDate(selected.subscription?.endDate)}
                  {selected.freeze?.totalFrozenDays ? ` (incl. ${selected.freeze.totalFrozenDays} frozen days)` : ""}
                </p>
              </div>
              {selected.payment.stripeSubscriptionId && (
                <div>
                  <p className="text-neutral-500">Stripe subscription</p>
                  <p className="font-mono text-xs text-neutral-700">{selected.payment.stripeSubscriptionId}</p>
                  {selected.subscription?.renewals?.length ? <p className="text-xs text-neutral-500">{selected.subscription.renewals.length} renewal(s)</p> : null}
                </div>
              )}
              {selected.payment.status === "refunded" && selected.refund?.at && (
                <div>
                  <p className="text-neutral-500">Refunded</p>
                  <p className="text-neutral-900">
                    {money(selected.refund.amount ?? undefined, selected.payment.currency)} on {fmtDate(selected.refund.at)}
                    {selected.refund.stripeRefundId ? " · to the card via Stripe" : " · by hand"}
                    {selected.refund.reason ? ` — ${selected.refund.reason}` : ""}
                  </p>
                  {selected.refund.stripeRefundId && <p className="font-mono text-xs text-neutral-500">{selected.refund.stripeRefundId}</p>}
                </div>
              )}
              {selected.cancellation?.cancelledAt && (
                <div>
                  <p className="text-neutral-500">Cancelled</p>
                  <p className="text-neutral-900">
                    {fmtDate(selected.cancellation.cancelledAt)} by {selected.cancellation.source}
                    {selected.cancellation.reason ? ` — ${selected.cancellation.reason}` : ""}
                  </p>
                </div>
              )}
              {selected.notes && (
                <div className="sm:col-span-2">
                  <p className="text-neutral-500">Notes</p>
                  <p className="whitespace-pre-line text-neutral-800">{selected.notes}</p>
                </div>
              )}
            </div>

            {/* Bank transfer review: only while there is still something to
                decide. One already rejected, failed or refunded is closed,
                and the API refuses to open it again (409 ORDER_CLOSED). */}
            {selected.payment.method === "bank_transfer" && ["pending", "processing"].includes(selected.payment.status) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Bank transfer {selected.payment.status === "processing" ? "awaiting review" : "not yet sent"}</p>
                {selected.payment.proof?.uploadedAt ? (
                  <div className="mt-2 text-sm text-amber-900">
                    <p>Sent {fmtDate(selected.payment.proof.uploadedAt)}{selected.payment.proof.reference ? ` · ref ${selected.payment.proof.reference}` : ""}</p>
                    {selected.payment.proof.note && <p className="text-xs">“{selected.payment.proof.note}”</p>}
                    {selected.payment.proof.url && (
                      <a href={absoluteUrl(selected.payment.proof.url)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold underline">
                        View receipt
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-amber-800">The member has not sent a receipt yet. You can still confirm it if the money has arrived.</p>
                )}
                {manage && (
                  <div className="mt-3 flex gap-2">
                    <PrimaryButton disabled={busy} onClick={() => run("Payment confirmed.", () => post(selected, "approve"))}>
                      Confirm payment received
                    </PrimaryButton>
                    <DangerButton disabled={busy} onClick={() => setAction("reject")}>
                      Reject
                    </DangerButton>
                  </div>
                )}
                {action === "reject" && (
                  <div className="mt-3 space-y-2">
                    <TextField label="Reason (sent to the member)" value={draft.reason} onChange={(v) => setDraft({ ...draft, reason: v })} />
                    <DangerButton disabled={busy} onClick={() => run("Payment rejected.", () => post(selected, "reject", { reason: draft.reason }))}>
                      Confirm rejection
                    </DangerButton>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {manage && (
              <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                {selected.payment.status === "paid" && (
                  <SecondaryButton onClick={() => openInvoice(selected)}>Invoice PDF</SecondaryButton>
                )}
                {selected.payment.status === "paid" && (selected.payment.balanceDue || 0) > 0 && (
                  <PrimaryButton
                    onClick={() => {
                      setDraft({ ...draft, payAmount: String(selected.payment.balanceDue ?? ""), payMethod: selected.payment.method === "stripe" ? "cash" : selected.payment.method, payNote: "" });
                      setAction("payment");
                    }}
                  >
                    Record payment
                  </PrimaryButton>
                )}
                {live(selected) && selected.status !== "frozen" && <SecondaryButton onClick={() => setAction("freeze")}>Freeze</SecondaryButton>}
                {selected.status === "frozen" && (
                  <SecondaryButton disabled={busy} onClick={() => run("Membership resumed.", () => post(selected, "unfreeze"))}>
                    Resume now
                  </SecondaryButton>
                )}
                {live(selected) &&
                  (cardPaymentFailed(selected) ? (
                    <span className="self-center text-xs font-medium text-rose-600">Card payment failed — ask the member to update their card</span>
                  ) : autoRenewsByCard(selected) ? (
                    <span className="self-center text-xs text-neutral-500">
                      Renews automatically{selected.subscription?.endDate ? ` on ${fmtDate(selected.subscription.endDate)}` : ""} (card)
                    </span>
                  ) : (
                    <SecondaryButton onClick={() => setAction("renew")}>Renew</SecondaryButton>
                  ))}
                {live(selected) && <SecondaryButton onClick={() => openAction(selected, "change")}>Change package</SecondaryButton>}
                {/* Not on a card subscription (Stripe's billing sets its dates and price) or a card payment still going through. */}
                {selected.status !== "cancelled" &&
                  !["refunded", "failed", "cancelled"].includes(selected.payment.status) &&
                  !selected.payment.stripeSubscriptionId &&
                  !(viaStripe(selected) && selected.payment.status !== "paid") && (
                  <SecondaryButton
                    onClick={() => {
                      setDraft({
                        ...draft,
                        termsStart: dateInput(selected.subscription?.startDate),
                        termsEnd: dateInput(selected.subscription?.endDate),
                        termsDiscount: String(selected.payment.discountAmount ?? 0),
                        termsDiscountNote: selected.payment.discountNote || "",
                        termsNote: "",
                      });
                      setAction("terms");
                    }}
                  >
                    Edit terms
                  </SecondaryButton>
                )}
                {live(selected) && isPack(selected) && (
                  <SecondaryButton disabled={busy} onClick={() => run("Session used.", () => post(selected, "use-session"))}>
                    Use a session
                  </SecondaryButton>
                )}
                {selected.subscription?.cancelAtPeriodEnd && selected.status !== "cancelled" && (
                  <SecondaryButton disabled={busy} onClick={() => run("Membership will renew again.", () => post(selected, "resume"))}>
                    Undo cancellation
                  </SecondaryButton>
                )}
                {selected.status !== "cancelled" && selected.status !== "expired" && <DangerButton onClick={() => setAction("cancel")}>Cancel</DangerButton>}
                {selected.payment.status === "paid" && <DangerButton onClick={() => setAction("refund")}>Refund</DangerButton>}
              </div>
            )}

            {action === "refund" && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-rose-200 p-4">
                <TextField
                  label={`Amount (${(selected.payment.currency || "").toUpperCase()}, blank = all of it)`}
                  type="number"
                  value={draft.amount}
                  onChange={(v) => setDraft({ ...draft, amount: v })}
                  placeholder={String(selected.payment.amountPaid ?? selected.payment.amount ?? "")}
                />
                <TextField label="Reason" value={draft.reason} onChange={(v) => setDraft({ ...draft, reason: v })} />
                <p className="sm:col-span-2 text-xs text-neutral-500">
                  {viaStripe(selected)
                    ? "Paid by card: the refund is sent back through Stripe, and any subscription stops renewing."
                    : "Paid by cash, bank transfer or the desk terminal: give the money back by hand — this records it."}{" "}
                  The membership is cancelled straight away.
                </p>
                <div className="sm:col-span-2 flex justify-end">
                  <DangerButton disabled={busy} onClick={() => refund(selected)}>
                    {busy ? "Refunding…" : "Refund"}
                  </DangerButton>
                </div>
              </div>
            )}

            {action === "terms" && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-neutral-200 p-4">
                <TextField label="Starts" type="date" value={draft.termsStart} onChange={(v) => setDraft({ ...draft, termsStart: v })} />
                <TextField label="Ends (through the end of that day)" type="date" value={draft.termsEnd} onChange={(v) => setDraft({ ...draft, termsEnd: v })} />
                {!viaStripe(selected) && (
                  <>
                    <TextField label={`Discount (${(selected.payment.currency || "").toUpperCase()}, off the package price)`} type="number" value={draft.termsDiscount} onChange={(v) => setDraft({ ...draft, termsDiscount: v })} />
                    <TextField label="Discount note" value={draft.termsDiscountNote} onChange={(v) => setDraft({ ...draft, termsDiscountNote: v })} />
                  </>
                )}
                <div className="sm:col-span-2">
                  <TextField label="Why (kept with the change)" value={draft.termsNote} onChange={(v) => setDraft({ ...draft, termsNote: v })} placeholder="Injury, promotion agreed at the desk…" />
                </div>
                <p className="sm:col-span-2 text-xs text-neutral-500">
                  A different discount moves the total and what is due; money already received stays as it is. A discount that would take the total below what was paid needs a refund instead.
                </p>
                <div className="sm:col-span-2 flex justify-end">
                  <PrimaryButton
                    disabled={busy}
                    onClick={() => {
                      // Only what was changed: a date sent again as it was
                      // would still be read as the whole of that day.
                      const body: Record<string, string> = {};
                      if (draft.termsStart && draft.termsStart !== dateInput(selected.subscription?.startDate)) body.startDate = draft.termsStart;
                      if (draft.termsEnd && draft.termsEnd !== dateInput(selected.subscription?.endDate)) body.endDate = draft.termsEnd;
                      if (draft.termsDiscount !== String(selected.payment.discountAmount ?? 0)) body.discountAmount = draft.termsDiscount || "0";
                      if (draft.termsDiscountNote !== (selected.payment.discountNote || "")) body.discountNote = draft.termsDiscountNote;
                      if (draft.termsNote) body.note = draft.termsNote;
                      run("Terms updated.", () => apiJson<{ message: string }>(`${GYMFOLIO_API}/package-orders/${selected._id}/terms`, "PATCH", body));
                    }}
                  >
                    {busy ? "Saving…" : "Save terms"}
                  </PrimaryButton>
                </div>
              </div>
            )}

            {(selected.termsHistory || []).length > 0 && (
              <details className="rounded-lg border border-neutral-200 p-4">
                <summary className="cursor-pointer text-xs font-semibold text-neutral-600">Changes to the terms ({(selected.termsHistory || []).length})</summary>
                <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                  {(selected.termsHistory || []).map((change, i) => (
                    <li key={i}>
                      {fmtDate(change.at)}: {fmtDate(change.from.startDate)} → {fmtDate(change.from.endDate)} became {fmtDate(change.to.startDate)} → {fmtDate(change.to.endDate)}
                      {change.from.amount !== change.to.amount ? `; total ${money(change.from.amount, selected.payment.currency)} became ${money(change.to.amount, selected.payment.currency)}` : ""}
                      {change.note ? ` — ${change.note}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {action === "payment" && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <TextField
                  label={`Amount received (${(selected.payment.currency || "").toUpperCase()}, up to ${selected.payment.balanceDue ?? 0})`}
                  type="number"
                  value={draft.payAmount}
                  onChange={(v) => setDraft({ ...draft, payAmount: v })}
                />
                <SelectField label="Paid by" value={draft.payMethod} allowClear={false} onChange={(v) => setDraft({ ...draft, payMethod: v })} options={DESK_METHOD_OPTIONS} />
                <div className="sm:col-span-2">
                  <TextField label="Note (optional)" value={draft.payNote} onChange={(v) => setDraft({ ...draft, payNote: v })} placeholder="Receipt number, who brought it…" />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <PrimaryButton
                    disabled={busy || !draft.payAmount}
                    onClick={() => run("Payment recorded.", () => postOnce(selected, "payments", { amount: draft.payAmount, method: draft.payMethod, note: draft.payNote || undefined }))}
                  >
                    {busy ? "Recording…" : "Record payment"}
                  </PrimaryButton>
                </div>
              </div>
            )}

            {action === "freeze" && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-neutral-200 p-4">
                <TextField label="Freeze for (days)" type="number" value={draft.days} onChange={(v) => setDraft({ ...draft, days: v })} />
                <TextField label="Reason" value={draft.reason} onChange={(v) => setDraft({ ...draft, reason: v })} placeholder="Travel, injury…" />
                <div className="sm:col-span-2 flex justify-end">
                  <PrimaryButton disabled={busy} onClick={() => run("Membership frozen.", () => post(selected, "freeze", { days: Number(draft.days), reason: draft.reason }))}>
                    Freeze membership
                  </PrimaryButton>
                </div>
              </div>
            )}

            {action === "cancel" && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-rose-200 p-4">
                <TextField label="Reason" value={draft.reason} onChange={(v) => setDraft({ ...draft, reason: v })} />
                <SelectField
                  label="When"
                  value={draft.immediate}
                  allowClear={false}
                  onChange={(v) => setDraft({ ...draft, immediate: v })}
                  options={[
                    { value: "no", label: "At the end of the paid period (no renewal)" },
                    { value: "yes", label: "Immediately — access ends now" },
                  ]}
                />
                <div className="sm:col-span-2 flex justify-end">
                  <DangerButton disabled={busy} onClick={() => run("Membership cancelled.", () => post(selected, "cancel", { reason: draft.reason, immediate: draft.immediate === "yes" }))}>
                    Confirm cancellation
                  </DangerButton>
                </div>
              </div>
            )}

            {action === "renew" && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-neutral-200 p-4">
                <SelectField
                  label="Paid by"
                  value={draft.paymentMethod}
                  allowClear={false}
                  onChange={(v) => setDraft({ ...draft, paymentMethod: v })}
                  options={DESK_METHOD_OPTIONS}
                />
                <SelectField
                  label="Mark as paid"
                  value={draft.markPaid}
                  allowClear={false}
                  onChange={(v) => setDraft({ ...draft, markPaid: v })}
                  options={[
                    { value: "yes", label: "Yes — starts when the current term ends" },
                    { value: "no", label: "No — leave pending" },
                  ]}
                />
                <TextField label="Months (optional)" type="number" value={draft.months} onChange={(v) => setDraft({ ...draft, months: v })} placeholder="Defaults to one term" />
                <TextField label="Start date (optional)" type="date" value={draft.startDate} onChange={(v) => setDraft({ ...draft, startDate: v })} />
                <TextField label="Discount (optional)" type="number" value={draft.discountAmount} onChange={(v) => setDraft({ ...draft, discountAmount: v })} />
                <TextField label="Discount note" value={draft.discountNote} onChange={(v) => setDraft({ ...draft, discountNote: v })} />
                <TextField label="Override amount (optional)" type="number" value={draft.amountOverride} onChange={(v) => setDraft({ ...draft, amountOverride: v })} placeholder="Charged as-is" />
                <TextField label="Amount paid now (optional)" type="number" value={draft.amountPaid} onChange={(v) => setDraft({ ...draft, amountPaid: v })} placeholder="Blank = paid in full" />
                <p className="sm:col-span-2 text-xs text-neutral-500">Without a start date the new term starts when the current one ends (today, if it has ended). No joining fee on a renewal.</p>
                <div className="sm:col-span-2 flex items-end justify-end">
                  <PrimaryButton
                    disabled={busy}
                    onClick={() =>
                      run("Renewed.", () =>
                        postOnce(selected, "renew", {
                          paymentMethod: draft.paymentMethod,
                          markPaid: draft.markPaid === "yes",
                          months: draft.months || undefined,
                          startDate: draft.startDate || undefined,
                          discountAmount: draft.discountAmount || undefined,
                          discountNote: draft.discountNote || undefined,
                          amountOverride: draft.amountOverride || undefined,
                          amountPaid: draft.amountPaid || undefined,
                        })
                      )
                    }
                  >
                    Renew
                  </PrimaryButton>
                </div>
              </div>
            )}

            {action === "change" && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-neutral-200 p-4">
                <div className="sm:col-span-2">
                  <SelectField
                    label="New package"
                    value={draft.packageId}
                    onChange={(v) => setDraft({ ...draft, packageId: v })}
                    options={packages
                      .filter((p) => p._id !== (typeof selected.userId === "object" ? "" : ""))
                      .map((p) => ({ value: p._id, label: `${p.name} — ${(p.currency || "").toUpperCase()} ${p.price}/${p.period || "month"}` }))}
                  />
                </div>
                <SelectField
                  label="Difference paid by"
                  value={draft.paymentMethod}
                  allowClear={false}
                  onChange={(v) => setDraft({ ...draft, paymentMethod: v })}
                  options={DESK_METHOD_OPTIONS}
                />
                <div className="flex items-end justify-end">
                  <PrimaryButton disabled={busy || !draft.packageId} onClick={() => changePackage(selected)}>
                    Change package
                  </PrimaryButton>
                </div>
                <p className="sm:col-span-2 text-xs text-neutral-500">The unused days of the current package are credited against the new price. Stripe subscriptions are switched and prorated by Stripe.</p>
              </div>
            )}

            {manage && action === "status" && (
              <details className="rounded-lg border border-neutral-200 p-4">
                <summary className="cursor-pointer text-xs font-semibold text-neutral-600">Override status (advanced)</summary>
                <div className="mt-3 flex items-end gap-3">
                  <div className="flex-1">
                    <SelectField
                      label="Status"
                      value={draft.status}
                      allowClear={false}
                      onChange={(v) => setDraft({ ...draft, status: v })}
                      options={["pending", "active", "frozen", "past_due", "expired", "cancelled", "suspended"].map((s) => ({ value: s, label: s.replace("_", " ") }))}
                    />
                  </div>
                  <SecondaryButton disabled={busy} onClick={() => run("Status updated.", () => apiJson(`${GYMFOLIO_API}/package-orders/${selected._id}/status`, "PUT", { status: draft.status }))}>
                    Set status
                  </SecondaryButton>
                </div>
              </details>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function PackageOrdersAdminPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <PackageOrdersAdminPageInner />
    </Suspense>
  );
}
