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
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson, authHeaders, absoluteUrl, replaceParams } from "../_shared/api";
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
  billing?: { mode: string; interval: string; intervalCount: number };
}

interface PackageOrder {
  _id: string;
  orderNumber: string;
  userId?: { _id: string; firstName?: string; lastName?: string; email: string; memberCode?: string } | string | null;
  packageDetails: { name: string; price: string; currency: string; period: string; kind?: string; sessions?: number; billing?: { mode: string } };
  customerInfo: { fullName: string; email: string; phone: string };
  payment: {
    amount: number;
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

const METHOD_LABELS: Record<string, string> = { stripe: "Card (Stripe)", card: "Card (desk)", bank_transfer: "Bank transfer", cash: "Cash" };
// Stripe subscription statuses that never charge again on their own (the
// backend's reminderJobs reads them the same way).
const NOT_RENEWING_STRIPE_STATUSES = ["canceled", "incomplete", "incomplete_expired", "unpaid", "paused"];
const ORDER_STATUSES = ["pending", "active", "frozen", "past_due", "expired", "cancelled"];
const PAYMENT_STATUSES = ["pending", "processing", "paid", "failed", "refunded"];

type Filters = { search: string; status: string; paymentStatus: string; paymentMethod: string };
type PanelAction = "" | "status" | "freeze" | "cancel" | "renew" | "change" | "reject" | "refund";

// The list's filters as the address gives them (the bell links to
// ?status=past_due, for one). A value the filters do not offer is ignored.
function filtersFrom(params: { get(key: string): string | null }): Filters {
  const offered = (value: string | null, options: string[]) => (value && options.includes(value) ? value : "");
  return {
    search: params.get("search") ?? "",
    status: offered(params.get("status"), ORDER_STATUSES),
    paymentStatus: offered(params.get("paymentStatus"), PAYMENT_STATUSES),
    paymentMethod: offered(params.get("paymentMethod"), Object.keys(METHOD_LABELS)),
  };
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function money(amount: number | undefined, currency: string) {
  return `${(currency || "").toUpperCase()} ${Number(amount || 0).toLocaleString()}`;
}

function memberName(o: PackageOrder) {
  const u = o.userId && typeof o.userId === "object" ? o.userId : null;
  return (u && [u.firstName, u.lastName].filter(Boolean).join(" ")) || o.customerInfo?.fullName || o.customerInfo?.email;
}

function PackageOrdersAdminPageInner() {
  const { can } = usePermissions();
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
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState<PackageOrder | null>(null);
  const [action, setAction] = useState<PanelAction>("");
  const [draft, setDraft] = useState<Record<string, string>>({});

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMember, setAssignMember] = useState<MemberOption | null>(null);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const emptyAssign = { packageId: "", paymentMethod: "cash", markPaid: "yes", durationMonths: "", notes: "", couponCode: "", amount: "" };
  const [assignDraft, setAssignDraft] = useState(emptyAssign);

  // Paged: a fixed limit of 200 used to cut the list off without saying so
  // beyond a small "showing N of M".
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.status) params.set("status", filters.status);
      if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
      if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
      const r = await apiGet<{ data: PackageOrder[]; pagination?: { total?: number; pages?: number; limit?: number } }>(`${GYMFOLIO_API}/package-orders?${params.toString()}`);
      setList(r.data || []);
      setTotal(r.pagination?.total ?? (r.data || []).length);
      setPages(pageCount(r.pagination));
    } catch (e) {
      setList([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : "Could not load orders");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

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
    const next = { search: url.search, status: url.status, paymentStatus: url.paymentStatus, paymentMethod: url.paymentMethod };
    setFilters((prev) =>
      prev.search === next.search && prev.status === next.status && prev.paymentStatus === next.paymentStatus && prev.paymentMethod === next.paymentMethod
        ? prev
        : next
    );
    setPage(1);
  }, [url.search, url.status, url.paymentStatus, url.paymentMethod]);

  // Members come from the picker's own search. Packages: the full list when
  // this account has the Packages tab, else the ones on sale right now.
  const loadPickers = async () => {
    try {
      const p = await apiGet<{ data?: PackageOption[] }>(`${GYMFOLIO_API}/packages`).catch(() =>
        apiGet<{ data?: PackageOption[] }>(`${GYMFOLIO_API}/packages/active`)
      );
      setPackages(p.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load packages.");
    }
  };

  const openAssign = async () => {
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
      const res = (await fn()) as { message?: string } | undefined;
      setNotice((res && res.message) || label);
      setAction("");
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const assignPackage = () =>
    run("Package assigned.", async () => {
      if (!assignMember || !assignDraft.packageId) throw new Error("Choose both a member and a package.");
      const res = await apiJson<{ message: string }>(`${GYMFOLIO_API}/package-orders/assign`, "POST", {
        userId: assignMember.id,
        packageId: assignDraft.packageId,
        paymentMethod: assignDraft.paymentMethod,
        markPaid: assignDraft.markPaid === "yes",
        durationMonths: assignDraft.durationMonths ? Number(assignDraft.durationMonths) : undefined,
        notes: assignDraft.notes || undefined,
        couponCode: assignDraft.couponCode || undefined,
        amount: assignDraft.amount || undefined,
      });
      setAssignOpen(false);
      return res;
    });

  // The manage panel on one order, its forms reset.
  const openOrder = (o: PackageOrder, a: PanelAction) => {
    setSelected(o);
    setAction(a);
    setDraft({ status: o.status, days: "7", reason: "", immediate: "no", paymentMethod: "cash", markPaid: "yes", months: "", packageId: "", amount: "" });
  };

  const openAction = async (o: PackageOrder, a: typeof action) => {
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

  // Card payments go back through Stripe; cash, bank and desk-terminal ones
  // are only recorded -- the money moves by hand. Either way the membership
  // ends now, which is why this asks first.
  const viaStripe = (o: PackageOrder) => o.payment.method === "stripe" || !!o.payment.stripePaymentIntentId || !!o.payment.stripeSessionId;
  const refund = (o: PackageOrder) => {
    const amount = draft.amount.trim();
    const shown = amount ? money(Number(amount), o.payment.currency) : `the full ${money(o.payment.amount, o.payment.currency)}`;
    const how = viaStripe(o) ? "It is sent back to the member's card through Stripe." : "Give the money back by hand; this only records it.";
    if (!confirm(`Refund ${shown} on ${o.orderNumber}? ${how} The membership is cancelled straight away. This cannot be undone.`)) return;
    run("Refunded.", () => post(o, "refund", { amount: amount || undefined, reason: draft.reason }));
  };

  const invoiceUrl = (o: PackageOrder) => `${GYMFOLIO_API}/package-orders/${o._id}/invoice.pdf?download=1`;
  const openInvoice = async (o: PackageOrder) => {
    try {
      const res = await fetch(invoiceUrl(o), { headers: authHeaders() });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Could not load the invoice");
      }
      const blob = await res.blob();
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
        {!loading && <span className="text-xs text-neutral-500">{total} order{total === 1 ? "" : "s"}</span>}
      </div>

      {loading ? (
        <Spinner />
      ) : !list.length ? (
        <EmptyState title="No package orders match" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["Order #", "Member", "Package", "Amount", "Method", "Payment", "Membership", "Runs", ""].map((c) => (
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
                      {(o.payment?.discountAmount || 0) > 0 && <p className="text-[11px] text-emerald-700">−{money(o.payment.discountAmount, o.payment.currency)} {o.payment.couponCode || "credit"}</p>}
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
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Package to Member" size="md">
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
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank_transfer", label: "Bank Transfer" },
                { value: "card", label: "Card (desk terminal)" },
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
            <TextField label="Coupon code (optional)" value={assignDraft.couponCode} onChange={(v) => setAssignDraft({ ...assignDraft, couponCode: v.toUpperCase() })} />
            <TextField label="Override amount (optional)" type="number" value={assignDraft.amount} onChange={(v) => setAssignDraft({ ...assignDraft, amount: v })} placeholder="Charged as-is" />
          </div>
          <TextField label="Duration in months (optional)" type="number" value={assignDraft.durationMonths} onChange={(v) => setAssignDraft({ ...assignDraft, durationMonths: v })} placeholder="Defaults to the package period" />
          <TextField label="Notes (optional)" value={assignDraft.notes} onChange={(v) => setAssignDraft({ ...assignDraft, notes: v })} />
          <p className="text-xs text-neutral-500">If the member already has a live membership, the new one starts when it ends.</p>
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
      <Modal open={!!selected} onClose={() => { setSelected(null); setAction(""); }} title={`Order ${selected?.orderNumber || ""}`} size="lg">
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

            {/* Bank transfer review */}
            {selected.payment.method === "bank_transfer" && selected.payment.status !== "paid" && (
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
                  placeholder={String(selected.payment.amount ?? "")}
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
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "bank_transfer", label: "Bank transfer" },
                    { value: "card", label: "Card (desk terminal)" },
                  ]}
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
                <div className="flex items-end justify-end">
                  <PrimaryButton disabled={busy} onClick={() => run("Renewed.", () => post(selected, "renew", { paymentMethod: draft.paymentMethod, markPaid: draft.markPaid === "yes", months: draft.months || undefined }))}>
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
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "bank_transfer", label: "Bank transfer" },
                    { value: "card", label: "Card (desk terminal)" },
                  ]}
                />
                <div className="flex items-end justify-end">
                  <PrimaryButton disabled={busy || !draft.packageId} onClick={() => run("Package changed.", () => post(selected, "change-package", { packageId: draft.packageId, paymentMethod: draft.paymentMethod }))}>
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

            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
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
