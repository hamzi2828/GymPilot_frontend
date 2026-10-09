"use client";

// Collect fees: the front desk's till for memberships. Find the member by
// name, phone or member ID, see what they hold and owe, take the money --
// renew the membership, settle a balance, or sell a first one -- and print
// the receipt.
//
// Built for a queue at the desk: the search box has the focus, Enter picks
// the only match, and every action has a key (shown on its button) that
// works whenever the cursor is not in a field. The money moves through the
// same routes Package Orders uses (renew, payments, assign); this screen
// only reads through the fee desk's own lookup (package-orders/desk/members).

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader, Card, Badge, Spinner, useRequestId } from "../_shared/ui";
import { API_BASE, GYMFOLIO_API, apiGet, apiJson, absoluteUrl, replaceParams } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { useSiteSettings } from "@/components/ThemeProvider";
import { printReceipt, loadReceiptProfile, EMPTY_RECEIPT_PROFILE, type ReceiptProfile } from "@/components/receipts";
import {
  DESK_API,
  DESK_METHODS,
  STATUS_COLORS,
  daysLabel,
  daysTone,
  deskMethod,
  fmtDate,
  methodLabel,
  money,
  priceNumber,
  round2,
  typedAmount,
  type DeskMembership,
  type DeskSearchRow,
  type DeskView,
  type OrderResult,
} from "./desk";
import { membershipReceipt, paymentReceipt, type DeskReceipt } from "./receipts";

// Long enough that a name typed at normal speed is one request.
const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 8;

type Mode = "" | "renew" | "dues" | "new";

interface PackageOption {
  _id: string;
  name: string;
  price: string | number;
  priceAmount?: number | null;
  currency?: string;
  period?: string;
  kind?: string;
  joiningFee?: number;
  isActive?: boolean;
}

interface RenewDraft {
  discount: string;
  discountNote: string;
  override: string;
  // Where the new term starts: where the current one ends (backdated when
  // it has already ended), today, or a chosen date.
  startFrom: "expiry" | "today" | "date";
  startDate: string;
  method: string;
  paid: string;
}

interface DuesDraft {
  orderId: string;
  amount: string;
  method: string;
  note: string;
}

interface NewDraft {
  packageId: string;
  discount: string;
  discountNote: string;
  override: string;
  // "auto": now, or when a membership they still hold ends (the API's rule).
  startMode: "auto" | "date";
  startDate: string;
  method: string;
  paid: string;
  waiveJoiningFee: boolean;
}

// The keys the desk's actions answer to, whenever the cursor is not in a field.
const KEYS = { search: "/", renew: "r", dues: "d", new: "n", print: "p" } as const;

const inputCls =
  "mt-1 w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]";
const primaryCls =
  "inline-flex items-center gap-2 h-9 px-4 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";
const secondaryCls =
  "inline-flex items-center gap-2 h-9 px-3 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";

function Key({ k }: { k: string }) {
  return (
    <kbd className="rounded border border-current px-1 font-mono text-[10px] font-semibold uppercase leading-4 opacity-70">{k}</kbd>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">{label}</p>
      <div className="mt-0.5 text-sm text-neutral-900">{children}</div>
    </div>
  );
}

function Avatar({ name, url, size = "h-16 w-16 text-lg" }: { name: string; url: string | null; size?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 font-bold text-neutral-500 ${size}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={absoluteUrl(url)} alt="" className="h-full w-full object-cover" />
      ) : (
        (name || "?").trim().charAt(0).toUpperCase()
      )}
    </div>
  );
}

/** Totals owed, one per currency (money is never added across currencies). */
function owedByCurrency(dues: { balanceDue: number; currency: string }[]) {
  const totals = new Map<string, number>();
  for (const due of dues) totals.set(due.currency, round2((totals.get(due.currency) || 0) + due.balanceDue));
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount }));
}

// Whether a bare number or a code the desk typed is this member's ID -- so
// Enter can pick it even when other members match the digits too.
function isExactCode(row: DeskSearchRow, term: string) {
  const code = (row.memberCode || "").toLowerCase();
  if (!code) return false;
  const typed = term.trim().toLowerCase();
  if (code === typed) return true;
  const digits = code.match(/(\d+)$/);
  return /^\d+$/.test(typed) && !!digits && Number(digits[1]) === Number(typed);
}

function FeeCollectionInner() {
  const { can, me } = usePermissions();
  const manage = can("package-orders", "manage");
  // Sent with every renewal, payment and sale, so one sent twice after a
  // lost reply takes the money once.
  const requestId = useRequestId();
  const { siteName } = useSiteSettings();
  const searchParams = useSearchParams();
  const urlMember = searchParams.get("member");
  const urlAction = searchParams.get("action");

  /* ---------------------------- search ---------------------------- */

  const searchRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DeskSearchRow[]>([]);
  const [resultsFor, setResultsFor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // -1 until the arrows are used: Enter then picks only an unambiguous match.
  const [highlight, setHighlight] = useState(-1);

  const runSearch = useCallback(async (term: string): Promise<DeskSearchRow[]> => {
    const q = term.trim();
    const seq = ++searchSeq.current;
    if (!q) {
      setResults([]);
      setResultsFor("");
      setHasMore(false);
      setSearchError(null);
      return [];
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q, limit: String(SEARCH_LIMIT) });
      const r = await apiGet<{ data?: DeskSearchRow[]; hasMore?: boolean }>(`${DESK_API}?${params.toString()}`);
      const rows = r.data || [];
      // An older search answering late must not replace a newer one.
      if (seq === searchSeq.current) {
        setResults(rows);
        setResultsFor(q);
        setHasMore(!!r.hasMore);
        setSearchError(null);
        setHighlight(-1);
      }
      return rows;
    } catch (e) {
      if (seq === searchSeq.current) {
        setResults([]);
        setResultsFor(q);
        setSearchError(e instanceof Error ? e.message : "Could not search members");
      }
      return [];
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      void runSearch("");
      return;
    }
    const timer = setTimeout(() => void runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  /* ---------------------------- member ---------------------------- */

  const viewSeq = useRef(0);
  const [memberId, setMemberId] = useState<string | null>(urlMember);
  const [view, setView] = useState<DeskView | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  // An action the address asked for (?action=renew from the expiry lists),
  // opened once the member has loaded.
  const pendingAction = useRef<string | null>(urlAction);
  // Set when a member is picked (or named by a link), so the card's first
  // action takes the focus.
  const focusCard = useRef(!!urlMember);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const [mode, setMode] = useState<Mode>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; receipt: DeskReceipt } | null>(null);
  const printRef = useRef<HTMLButtonElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const loadView = useCallback(async (id: string) => {
    const seq = ++viewSeq.current;
    setLoadingView(true);
    setViewError(null);
    try {
      const r = await apiGet<{ data: DeskView }>(`${DESK_API}/${encodeURIComponent(id)}`);
      if (seq === viewSeq.current) setView(r.data);
      return r.data;
    } catch (e) {
      if (seq === viewSeq.current) {
        setView(null);
        setViewError(e instanceof Error ? e.message : "Could not load the member");
      }
      return null;
    } finally {
      if (seq === viewSeq.current) setLoadingView(false);
    }
  }, []);

  // A link followed while already here (Fee expiry's Collect) names another member.
  useEffect(() => {
    if (!urlMember) return;
    pendingAction.current = urlAction;
    setMemberId((prev) => {
      if (prev !== urlMember) focusCard.current = true;
      return prev === urlMember ? prev : urlMember;
    });
  }, [urlMember, urlAction]);

  useEffect(() => {
    setMode("");
    setDone(null);
    setError(null);
    if (!memberId) {
      viewSeq.current++;
      setView(null);
      setViewError(null);
      return;
    }
    void loadView(memberId);
  }, [memberId, loadView]);

  const pick = (id: string) => {
    searchSeq.current++;
    setQuery("");
    setResults([]);
    setResultsFor("");
    setHighlight(-1);
    focusCard.current = true;
    pendingAction.current = null;
    replaceParams({ member: id, action: null });
    if (id === memberId) {
      setMode("");
      setDone(null);
      void loadView(id);
    } else {
      setMemberId(id);
    }
  };

  const clearMember = () => {
    replaceParams({ member: null, action: null });
    setMemberId(null);
    searchRef.current?.focus();
  };

  const onSearchKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      if (query) {
        e.preventDefault();
        e.stopPropagation();
        setQuery("");
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      // Typed faster than the search answers: ask now rather than pick from
      // the results of what was typed before.
      const fresh = resultsFor === q;
      const rows = fresh ? results : await runSearch(q);
      if (!rows.length) return;
      if (fresh && highlight >= 0 && rows[highlight]) return pick(rows[highlight].id);
      if (rows.length === 1) return pick(rows[0].id);
      // The search puts an exact member ID first.
      if (isExactCode(rows[0], q)) return pick(rows[0].id);
      setHighlight(0);
    }
  };

  /* ---------------------------- the money ---------------------------- */

  const m = view?.membership || null;
  const pkg = view?.package || null;
  const collectableDues = useMemo(() => (view?.dues || []).filter((due) => !due.stripeBilled), [view]);
  const owed = useMemo(() => owedByCurrency(view?.dues || []), [view]);
  // Assigned and not paid for yet, and its term still to run: the money is
  // taken by confirming that order, not by selling another on top of it.
  const awaitingPayment = !!m && ["pending", "processing"].includes(m.paymentStatus) && (m.daysLeft ?? -1) >= 0;

  // Why this membership cannot be renewed here, or null when it can.
  const renewBlock: string | null = !m
    ? "No membership to renew yet."
    : m.cardPaymentFailed
      ? "The card payment failed and Stripe is retrying it. Ask the member to update their card in the billing portal — a desk renewal would be a second payment."
      : m.autoRenews
        ? `Paid by card: Stripe renews this membership by itself${m.endDate ? ` on ${fmtDate(m.endDate)}` : ""}. A desk renewal would charge twice. The member can change their card in the billing portal.`
        : awaitingPayment
          ? "This membership has not been paid for yet. Confirm the payment on Package Orders instead of selling another term."
          : !pkg
            ? "The package this membership was for no longer exists. Sell a new membership instead."
            : pkg.price === null
              ? `The price of ${pkg.name} cannot be read. Fix it on the Packages screen first.`
              : null;
  const canRenew = manage && !renewBlock;
  const canDues = manage && collectableDues.length > 0;

  const [renewDraft, setRenewDraft] = useState<RenewDraft>({ discount: "", discountNote: "", override: "", startFrom: "expiry", startDate: "", method: "cash", paid: "" });
  const [duesDraft, setDuesDraft] = useState<DuesDraft>({ orderId: "", amount: "", method: "cash", note: "" });
  const [newDraft, setNewDraft] = useState<NewDraft>({ packageId: "", discount: "", discountNote: "", override: "", startMode: "auto", startDate: "", method: "cash", paid: "", waiveJoiningFee: false });
  const [packages, setPackages] = useState<PackageOption[] | null>(null);

  // The packages on sale: the full list for the Packages tab, else the ones
  // on the website, as Package Orders reads them.
  const loadPackages = useCallback(async () => {
    try {
      const r = await apiGet<{ data?: PackageOption[] }>(`${GYMFOLIO_API}/packages`).catch(() =>
        apiGet<{ data?: PackageOption[] }>(`${GYMFOLIO_API}/packages/active`)
      );
      const onSale = (r.data || []).filter((p) => p.isActive !== false);
      setPackages(onSale);
      return onSale;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the packages");
      setPackages([]);
      return [];
    }
  }, []);

  const openMode = useCallback(
    async (next: Mode) => {
      if (!view) return;
      requestId.reset();
      setError(null);
      setDone(null);
      if (next === "renew") {
        if (!canRenew || !m) return;
        setRenewDraft({ discount: "", discountNote: "", override: "", startFrom: "expiry", startDate: "", method: deskMethod(m.method), paid: "" });
      } else if (next === "dues") {
        if (!canDues) return;
        const first = collectableDues[0];
        setDuesDraft({ orderId: first.orderId, amount: "", method: deskMethod(first.method), note: "" });
      } else if (next === "new") {
        if (!manage) return;
        const list = packages || (await loadPackages());
        const same = list.find((p) => p._id === pkg?.id);
        setNewDraft({
          packageId: (same || list[0])?._id || "",
          discount: "",
          discountNote: "",
          override: "",
          startMode: "auto",
          startDate: "",
          method: deskMethod(m?.method),
          paid: "",
          waiveJoiningFee: false,
        });
      }
      setMode(next);
    },
    [view, canRenew, canDues, manage, m, collectableDues, packages, loadPackages, pkg, requestId]
  );

  // Once a member is on screen: open what the address asked for, or hand
  // the keyboard to the card's first action.
  useEffect(() => {
    if (!view || loadingView) return;
    const asked = pendingAction.current;
    if (asked) {
      pendingAction.current = null;
      replaceParams({ action: null });
      if (asked === "renew" || asked === "dues" || asked === "new") {
        void openMode(asked);
        return;
      }
    }
    if (focusCard.current) {
      focusCard.current = false;
      primaryRef.current?.focus();
    }
  }, [view, loadingView, openMode]);

  // The amount field takes the focus when a form opens: type, then Enter.
  // (Effects run once the form is on the page, so no frame needs waiting for.)
  useEffect(() => {
    if (mode) amountRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (done) printRef.current?.focus();
  }, [done]);

  // Renewal: the package's price today, less the discount, unless an amount
  // is agreed; what is not paid now is left as the balance due.
  const renewQuote = useMemo(() => {
    const price = pkg?.price ?? 0;
    const discount = typedAmount(renewDraft.discount) ?? 0;
    const override = typedAmount(renewDraft.override);
    const total = round2(override !== null ? override : price - Math.min(Math.max(discount, 0), price));
    const paid = typedAmount(renewDraft.paid);
    const paying = paid === null ? total : round2(paid);
    return { price, discount, override, total, paid, paying, balance: round2(total - paying) };
  }, [pkg, renewDraft]);

  const chosenPackage = packages?.find((p) => p._id === newDraft.packageId) || null;
  const newQuote = useMemo(() => {
    const price = chosenPackage ? (chosenPackage.priceAmount ?? priceNumber(chosenPackage.price) ?? 0) : 0;
    const joiningFee = chosenPackage && view?.joiningFeeDue && !newDraft.waiveJoiningFee ? round2(chosenPackage.joiningFee || 0) : 0;
    const discount = typedAmount(newDraft.discount) ?? 0;
    const override = typedAmount(newDraft.override);
    const total = round2(override !== null ? override : price - Math.min(Math.max(discount, 0), price) + joiningFee);
    const paid = typedAmount(newDraft.paid);
    const paying = paid === null ? total : round2(paid);
    const currency = (chosenPackage?.currency || view?.currency || "").toUpperCase();
    return { price, joiningFee, discount, override, total, paid, paying, balance: round2(total - paying), currency };
  }, [chosenPackage, newDraft, view]);

  const chosenDue = collectableDues.find((due) => due.orderId === duesDraft.orderId) || null;

  // What the desk typed that the API would refuse anyway, said before sending.
  function amountProblem(q: { discount: number; override: number | null; paid: number | null; total: number }, discountText: string, overrideText: string, paidText: string) {
    if (discountText.trim() && (typedAmount(discountText) === null || q.discount < 0)) return "The discount must be an amount of 0 or more.";
    if (overrideText.trim() && (q.override === null || q.override < 0)) return "The amount must be 0 or more.";
    if (paidText.trim() && (q.paid === null || q.paid < 0)) return "The amount received must be 0 or more.";
    if (q.paid !== null && q.paid > q.total) return `More than the total of ${q.total.toLocaleString()} — nothing is kept as credit.`;
    return null;
  }

  const cashier = me?.name || undefined;

  // Sends one desk action; the banner says what was recorded, read from the
  // order the API answered with.
  const act = async (describe: (order: OrderResult) => string, send: () => Promise<{ data: OrderResult }>, receipt: (order: OrderResult) => DeskReceipt) => {
    if (!view || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await send();
      requestId.reset();
      setDone({ message: describe(res.data), receipt: receipt(res.data) });
      setMode("");
      void receiptProfile();
      await loadView(view.member.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const submitRenew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!m || !view) return;
    const d = renewDraft;
    const problem = amountProblem(renewQuote, d.discount, d.override, d.paid);
    if (problem) return setError(problem);
    if (d.startFrom === "date" && !d.startDate) return setError("Choose the date the new term starts.");
    const body: Record<string, unknown> = { paymentMethod: d.method, markPaid: true };
    if (d.startFrom === "today") body.startAfterDays = 0;
    else if (d.startFrom === "date") body.startDate = d.startDate;
    // Left out, a live membership's renewal starts where it ends; one that
    // has already ended would start today, so its end is sent instead.
    else if (!m.live && m.endDate) body.startDate = m.endDate;
    if (renewQuote.discount > 0) body.discountAmount = renewQuote.discount;
    if (d.discountNote.trim()) body.discountNote = d.discountNote.trim();
    if (renewQuote.override !== null) body.amountOverride = renewQuote.override;
    if (renewQuote.paid !== null) body.amountPaid = renewQuote.paid;
    const member = view.member;
    void act(
      (order) => `Renewed until ${fmtDate(order.subscription?.endDate)}.`,
      () => apiJson(`${GYMFOLIO_API}/package-orders/${m.orderId}/renew`, "POST", { ...body, requestId: requestId.for(`renew ${m.orderId}`, body) }),
      (order) => membershipReceipt(order, member, cashier)
    );
  };

  const submitDues = (e: React.FormEvent) => {
    e.preventDefault();
    if (!view || !chosenDue) return;
    const typed = typedAmount(duesDraft.amount);
    const amount = typed === null ? chosenDue.balanceDue : round2(typed);
    if (duesDraft.amount.trim() && typed === null) return setError("Enter the amount received.");
    if (!(amount > 0)) return setError("The payment must be more than 0.");
    if (amount > chosenDue.balanceDue) return setError(`The balance due is ${money(chosenDue.balanceDue, chosenDue.currency)}; a payment cannot be more than that.`);
    const member = view.member;
    const method = duesDraft.method;
    const body = { amount, method, note: duesDraft.note.trim() || undefined };
    void act(
      () => "Payment recorded.",
      () => apiJson(`${GYMFOLIO_API}/package-orders/${chosenDue.orderId}/payments`, "POST", { ...body, requestId: requestId.for(`payments ${chosenDue.orderId}`, body) }),
      (order) => paymentReceipt(order, member, amount, method, cashier)
    );
  };

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!view) return;
    const d = newDraft;
    if (!d.packageId) return setError("Choose a package.");
    const problem = amountProblem(newQuote, d.discount, d.override, d.paid);
    if (problem) return setError(problem);
    if (d.startMode === "date" && !d.startDate) return setError("Choose the date the membership starts.");
    const member = view.member;
    const body = {
      userId: member.id,
      packageId: d.packageId,
      paymentMethod: d.method,
      markPaid: true,
      startDate: d.startMode === "date" ? d.startDate : undefined,
      discountAmount: newQuote.discount > 0 ? newQuote.discount : undefined,
      discountNote: d.discountNote.trim() || undefined,
      amountOverride: newQuote.override !== null ? newQuote.override : undefined,
      amountPaid: newQuote.paid !== null ? newQuote.paid : undefined,
      waiveJoiningFee: d.waiveJoiningFee || undefined,
    };
    void act(
      (order) => `${order.packageDetails.name} sold, ${fmtDate(order.subscription?.startDate)} – ${fmtDate(order.subscription?.endDate)}.`,
      () => apiJson(`${GYMFOLIO_API}/package-orders/assign`, "POST", { ...body, requestId: requestId.for("assign", body) }),
      (order) => membershipReceipt(order, member, cashier)
    );
  };

  /* ---------------------------- receipt ---------------------------- */

  const profileRef = useRef<ReceiptProfile | null>(null);
  // The gym's details for the paper, read once; without them the receipt
  // still prints, under the site's name.
  const receiptProfile = useCallback(async (): Promise<ReceiptProfile> => {
    if (profileRef.current) return profileRef.current;
    try {
      profileRef.current = await loadReceiptProfile(`${API_BASE}/admin/receipt-profile`);
      return profileRef.current;
    } catch {
      return { ...EMPTY_RECEIPT_PROFILE, branding: { ...EMPTY_RECEIPT_PROFILE.branding, name: siteName || "" } };
    }
  }, [siteName]);

  const print = useCallback(async () => {
    if (!done) return;
    try {
      const profile = await receiptProfile();
      await printReceipt({ ...profile, ...done.receipt });
      // The print frame took the focus; the desk's keys answer on the page.
      printRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not print the receipt");
    }
  }, [done, receiptProfile]);

  // A card subscription's own page at Stripe, where the member changes the card.
  const openPortal = async (orderId: string) => {
    // Opened now, while the click still counts, and pointed at Stripe once
    // the address arrives; a window opened after the wait would be blocked.
    const tab = window.open("", "_blank");
    try {
      const r = await apiJson<{ url?: string }>(`${GYMFOLIO_API}/package-orders/${orderId}/billing-portal`, "POST");
      if (!r.url) throw new Error("Stripe did not return a billing portal link");
      if (tab) {
        tab.opener = null;
        tab.location.href = r.url;
      } else {
        window.location.href = r.url;
      }
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Could not open the billing portal");
    }
  };

  /* ---------------------------- keyboard ---------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing = !!target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if (e.key === "Escape") {
        if (mode) {
          e.preventDefault();
          setMode("");
          setError(null);
          primaryRef.current?.focus();
        } else if (!typing) {
          searchRef.current?.focus();
        }
        return;
      }
      if (typing || busy) return;
      const key = e.key.toLowerCase();
      if (key === KEYS.search) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (key === KEYS.renew && canRenew) {
        e.preventDefault();
        void openMode("renew");
      } else if (key === KEYS.dues && canDues) {
        e.preventDefault();
        void openMode("dues");
      } else if (key === KEYS.new && manage && view) {
        e.preventDefault();
        void openMode("new");
      } else if (key === KEYS.print && done) {
        e.preventDefault();
        void print();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, busy, canRenew, canDues, manage, view, done, openMode, print]);

  /* ---------------------------- render ---------------------------- */

  const showResults = !!query.trim();
  const primaryAction: Mode = !view ? "" : canRenew ? "renew" : canDues ? "dues" : manage ? "new" : "";

  const actionButton = (target: Mode, label: string, key: string, enabled: boolean) => {
    const primary = target === primaryAction;
    return (
      <button
        ref={primary ? primaryRef : undefined}
        type="button"
        disabled={!enabled || busy}
        onClick={() => void openMode(target)}
        className={primary ? primaryCls : secondaryCls}
        aria-keyshortcuts={key.toUpperCase()}
      >
        {label} <Key k={key} />
      </button>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Collect fees"
        actions={
          <Link href="/admin/fee-expiry" className={secondaryCls}>
            Fee expiry lists
          </Link>
        }
      />

      {/* ---- Search ---- */}
      <div className="relative mb-6 max-w-2xl">
        <label htmlFor="desk-search" className="text-xs font-semibold text-neutral-700">
          Find a member
        </label>
        <div className="relative mt-1">
          <input
            id="desk-search"
            ref={searchRef}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => void onSearchKey(e)}
            placeholder="Name, phone or member ID (e.g. GP-0184 or 184)"
            role="combobox"
            aria-expanded={showResults}
            aria-controls="desk-search-results"
            aria-activedescendant={highlight >= 0 && results[highlight] ? `desk-result-${results[highlight].id}` : undefined}
            className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-4 pr-16 text-base focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
            {searching ? "Searching…" : <Key k={KEYS.search} />}
          </span>
        </div>
        {showResults && (
          <div id="desk-search-results" role="listbox" className="admin-scroll mt-1 max-h-96 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
            {results.map((row, i) => {
              const held = row.membership;
              return (
                <button
                  key={row.id}
                  id={`desk-result-${row.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(row.id)}
                  className={`flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 ${i === highlight ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
                >
                  <Avatar name={row.name} url={row.avatarUrl} size="h-8 w-8 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-900">
                      {row.name}
                      {row.memberCode && <span className="ml-2 font-mono text-xs text-neutral-500">{row.memberCode}</span>}
                      {!row.isActive && <span className="ml-2 text-[11px] font-semibold text-rose-600">disabled</span>}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">{[row.phone, row.email].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    {held ? (
                      <>
                        <span className="block text-neutral-700">{held.packageName}</span>
                        <span className={`block ${daysTone(held.daysLeft)}`}>
                          {held.endDate ? `${fmtDate(held.endDate)} · ${daysLabel(held.daysLeft)}` : held.status}
                        </span>
                      </>
                    ) : (
                      <span className="text-neutral-400">No membership</span>
                    )}
                  </span>
                </button>
              );
            })}
            {searching && !results.length && <p className="px-3 py-2 text-xs text-neutral-500">Searching…</p>}
            {!searching && searchError && <p className="px-3 py-2 text-xs text-rose-600">{searchError}</p>}
            {!searching && !searchError && resultsFor === query.trim() && !results.length && (
              <p className="px-3 py-2 text-xs text-neutral-500">No member matches “{query.trim()}”.</p>
            )}
            {hasMore && <p className="border-t border-neutral-100 px-3 py-2 text-[11px] text-neutral-400">More matches — keep typing to narrow it down.</p>}
          </div>
        )}
        <p className="mt-2 text-[11px] text-neutral-400">
          Enter picks the only match (or the member ID typed) · ↑ ↓ to choose · Esc clears
        </p>
      </div>

      {!manage && (
        <p className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600">
          Your role can look members up here but not take payments.
        </p>
      )}

      {/* ---- Done ---- */}
      {done && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          <span>
            <span className="font-semibold">{done.message}</span> Received {money(done.receipt.paid, done.receipt.currency)}
            {(done.receipt.balanceDue || 0) > 0 ? ` · ${money(done.receipt.balanceDue, done.receipt.currency)} still due.` : " · paid in full."}
          </span>
          <span className="flex gap-2">
            <button ref={printRef} type="button" onClick={() => void print()} className={primaryCls}>
              Print receipt <Key k={KEYS.print} />
            </button>
            <button
              type="button"
              onClick={() => {
                setDone(null);
                clearMember();
              }}
              className={secondaryCls}
            >
              Next member <Key k={KEYS.search} />
            </button>
          </span>
        </div>
      )}

      {/* ---- Member ---- */}
      {!memberId ? (
        <div className="rounded-xl border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-500">
          Search for a member to collect their fee — or open one from the{" "}
          <Link href="/admin/fee-expiry" className="font-semibold text-neutral-700 underline">
            fee expiry lists
          </Link>
          .
        </div>
      ) : loadingView && !view ? (
        <Spinner />
      ) : viewError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {viewError}{" "}
          <button type="button" onClick={() => memberId && void loadView(memberId)} className="ml-2 font-semibold underline">
            Try again
          </button>
        </div>
      ) : view ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-start gap-4">
              <Avatar name={view.member.name} url={view.member.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-neutral-900">{view.member.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                  {view.member.memberCode && <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-700">{view.member.memberCode}</span>}
                  {view.member.phone && <span>{view.member.phone}</span>}
                </p>
                {view.member.email && <p className="truncate text-xs text-neutral-500">{view.member.email}</p>}
                {!view.member.isActive && (
                  <p className="mt-1 text-xs font-semibold text-rose-600">Account disabled — attendance will turn them away until it is switched on under Users.</p>
                )}
              </div>
              <button type="button" onClick={clearMember} className="shrink-0 text-xs font-semibold text-neutral-500 underline hover:text-neutral-900">
                Change
              </button>
            </div>

            {m ? <MembershipFacts m={m} owed={owed} /> : <p className="mt-5 rounded-lg bg-neutral-50 px-3 py-3 text-sm text-neutral-600">No membership yet.</p>}

            {view.running && m && (
              <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
                Running now: {view.running.packageName} until {fmtDate(view.running.endDate)} ({daysLabel(view.running.daysLeft).toLowerCase()}). The next term is already paid for and starts {fmtDate(m.startDate)}.
              </p>
            )}

            {manage && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                {m && actionButton("renew", "Collect & renew", KEYS.renew, canRenew)}
                {collectableDues.length > 0 && actionButton("dues", "Collect dues", KEYS.dues, canDues)}
                {actionButton("new", m ? "New membership" : "Sell a membership", KEYS.new, true)}
              </div>
            )}
            {manage && m && renewBlock && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {renewBlock}
                {(m.autoRenews || m.cardPaymentFailed) && (
                  <button type="button" onClick={() => void openPortal(m.orderId)} className="ml-1 font-semibold underline">
                    Open the billing portal
                  </button>
                )}
                {awaitingPayment && (
                  <Link href={`/admin/package-orders?id=${encodeURIComponent(m.orderId)}`} className="ml-1 font-semibold underline">
                    Open the order
                  </Link>
                )}
              </div>
            )}
          </Card>

          <div className="lg:col-span-3">
            {mode === "renew" && m && pkg && (
              <Card className="p-5">
                <form onSubmit={submitRenew} className="space-y-4">
                  <FormHeading title={`Renew ${pkg.name}`} onClose={() => setMode("")} />
                  <p className="text-sm text-neutral-600">
                    {money(pkg.price, pkg.currency)}
                    {pkg.period ? ` / ${pkg.period}` : ""} — the package&apos;s price today. No joining fee on a renewal.
                    {!pkg.isActive && " This package is no longer on sale, but it can still be renewed."}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Start from">
                      <select className={inputCls} value={renewDraft.startFrom} onChange={(e) => setRenewDraft({ ...renewDraft, startFrom: e.target.value as RenewDraft["startFrom"] })}>
                        <option value="expiry">{m.endDate ? `Current expiry (${fmtDate(m.endDate)})` : "Current expiry"}</option>
                        <option value="today">Today</option>
                        <option value="date">A date…</option>
                      </select>
                    </Field>
                    {renewDraft.startFrom === "date" ? (
                      <Field label="Start date">
                        <input type="date" className={inputCls} value={renewDraft.startDate} onChange={(e) => setRenewDraft({ ...renewDraft, startDate: e.target.value })} />
                      </Field>
                    ) : (
                      <StartHint m={m} startFrom={renewDraft.startFrom} />
                    )}
                    <Field label={`Discount (${pkg.currency})`}>
                      <input inputMode="decimal" className={inputCls} value={renewDraft.discount} onChange={(e) => setRenewDraft({ ...renewDraft, discount: e.target.value })} placeholder="0" />
                    </Field>
                    <Field label="Discount note">
                      <input className={inputCls} value={renewDraft.discountNote} onChange={(e) => setRenewDraft({ ...renewDraft, discountNote: e.target.value })} placeholder="Student, family, promotion…" />
                    </Field>
                    <Field label={`Amount agreed (${pkg.currency}, optional)`} hint="Charged instead of the price less the discount.">
                      <input inputMode="decimal" className={inputCls} value={renewDraft.override} onChange={(e) => setRenewDraft({ ...renewDraft, override: e.target.value })} placeholder="—" />
                    </Field>
                    <Field label="Paid by">
                      <MethodSelect value={renewDraft.method} onChange={(method) => setRenewDraft({ ...renewDraft, method })} />
                    </Field>
                    <Field label={`Received now (${pkg.currency})`} hint="Blank = the whole total. Less leaves the rest as a balance due.">
                      <input ref={amountRef} inputMode="decimal" className={inputCls} value={renewDraft.paid} onChange={(e) => setRenewDraft({ ...renewDraft, paid: e.target.value })} placeholder={String(renewQuote.total)} />
                    </Field>
                  </div>
                  <Totals
                    currency={pkg.currency}
                    rows={[
                      ["Price", renewQuote.price],
                      ...(renewQuote.override === null && renewQuote.discount > 0 ? [["Discount", -Math.min(renewQuote.discount, renewQuote.price)] as [string, number]] : []),
                    ]}
                    total={renewQuote.total}
                    paying={renewQuote.paying}
                    balance={renewQuote.balance}
                  />
                  <FormFooter busy={busy} error={error} label={`Collect ${money(renewQuote.paying, pkg.currency)} & renew`} />
                </form>
              </Card>
            )}

            {mode === "dues" && chosenDue && (
              <Card className="p-5">
                <form onSubmit={submitDues} className="space-y-4">
                  <FormHeading title="Collect dues" onClose={() => setMode("")} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {collectableDues.length > 1 ? (
                      <div className="sm:col-span-2">
                        <Field label="For">
                          <select
                            className={inputCls}
                            value={duesDraft.orderId}
                            onChange={(e) => {
                              const due = collectableDues.find((d) => d.orderId === e.target.value);
                              setDuesDraft({ ...duesDraft, orderId: e.target.value, method: deskMethod(due?.method) });
                            }}
                          >
                            {collectableDues.map((due) => (
                              <option key={due.orderId} value={due.orderId}>
                                {due.packageName} · {due.orderNumber} · {money(due.balanceDue, due.currency)} due
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    ) : (
                      <p className="sm:col-span-2 text-sm text-neutral-600">
                        {chosenDue.packageName} · {chosenDue.orderNumber} · {fmtDate(chosenDue.startDate)} – {fmtDate(chosenDue.endDate)}
                      </p>
                    )}
                    <Field label={`Received (${chosenDue.currency}, up to ${chosenDue.balanceDue.toLocaleString()})`} hint="Blank = the whole balance.">
                      <input ref={amountRef} inputMode="decimal" className={inputCls} value={duesDraft.amount} onChange={(e) => setDuesDraft({ ...duesDraft, amount: e.target.value })} placeholder={String(chosenDue.balanceDue)} />
                    </Field>
                    <Field label="Paid by">
                      <MethodSelect value={duesDraft.method} onChange={(method) => setDuesDraft({ ...duesDraft, method })} />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Note (optional)">
                        <input className={inputCls} value={duesDraft.note} onChange={(e) => setDuesDraft({ ...duesDraft, note: e.target.value })} placeholder="Who brought it, a reference…" />
                      </Field>
                    </div>
                  </div>
                  {(() => {
                    const typed = typedAmount(duesDraft.amount);
                    const paying = typed === null ? chosenDue.balanceDue : round2(typed);
                    return (
                      <Totals
                        currency={chosenDue.currency}
                        rows={[
                          ["Order total", chosenDue.amount],
                          ["Paid so far", -chosenDue.amountPaid],
                        ]}
                        total={chosenDue.balanceDue}
                        totalLabel="Balance due"
                        paying={paying}
                        balance={round2(chosenDue.balanceDue - paying)}
                      />
                    );
                  })()}
                  <FormFooter
                    busy={busy}
                    error={error}
                    label={`Collect ${money(typedAmount(duesDraft.amount) ?? chosenDue.balanceDue, chosenDue.currency)}`}
                  />
                </form>
              </Card>
            )}

            {mode === "new" && (
              <Card className="p-5">
                <form onSubmit={submitNew} className="space-y-4">
                  <FormHeading title={m ? "New membership" : "Sell a membership"} onClose={() => setMode("")} />
                  {packages === null ? (
                    <Spinner />
                  ) : !packages.length ? (
                    <p className="text-sm text-neutral-600">No packages are on sale. Add one under Packages first.</p>
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Package">
                            <select className={inputCls} value={newDraft.packageId} onChange={(e) => setNewDraft({ ...newDraft, packageId: e.target.value })}>
                              {packages.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.name} — {(p.currency || view.currency || "").toUpperCase()} {p.price}
                                  {p.period ? ` / ${p.period}` : ""}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <Field label="Starts">
                          <select className={inputCls} value={newDraft.startMode} onChange={(e) => setNewDraft({ ...newDraft, startMode: e.target.value as NewDraft["startMode"] })}>
                            <option value="auto">
                              {/* Packs and passes start at once; a membership after the one still running. */}
                              {m?.live && (chosenPackage?.kind || "membership") === "membership" ? `When the current one ends (${fmtDate(m.endDate)})` : "Today"}
                            </option>
                            <option value="date">On a date…</option>
                          </select>
                        </Field>
                        {newDraft.startMode === "date" ? (
                          <Field label="Start date">
                            <input type="date" className={inputCls} value={newDraft.startDate} onChange={(e) => setNewDraft({ ...newDraft, startDate: e.target.value })} />
                          </Field>
                        ) : (
                          <div />
                        )}
                        <Field label={`Discount (${newQuote.currency})`}>
                          <input inputMode="decimal" className={inputCls} value={newDraft.discount} onChange={(e) => setNewDraft({ ...newDraft, discount: e.target.value })} placeholder="0" />
                        </Field>
                        <Field label="Discount note">
                          <input className={inputCls} value={newDraft.discountNote} onChange={(e) => setNewDraft({ ...newDraft, discountNote: e.target.value })} placeholder="Student, family, promotion…" />
                        </Field>
                        <Field label={`Amount agreed (${newQuote.currency}, optional)`} hint="Charged instead of the price less the discount, fees included.">
                          <input inputMode="decimal" className={inputCls} value={newDraft.override} onChange={(e) => setNewDraft({ ...newDraft, override: e.target.value })} placeholder="—" />
                        </Field>
                        <Field label="Paid by">
                          <MethodSelect value={newDraft.method} onChange={(method) => setNewDraft({ ...newDraft, method })} />
                        </Field>
                        <Field label={`Received now (${newQuote.currency})`} hint="Blank = the whole total. Less leaves the rest as a balance due.">
                          <input ref={amountRef} inputMode="decimal" className={inputCls} value={newDraft.paid} onChange={(e) => setNewDraft({ ...newDraft, paid: e.target.value })} placeholder={String(newQuote.total)} />
                        </Field>
                        {view.joiningFeeDue && (chosenPackage?.joiningFee || 0) > 0 && (
                          <label className="flex items-center gap-2 self-end pb-2 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              checked={newDraft.waiveJoiningFee}
                              onChange={(e) => setNewDraft({ ...newDraft, waiveJoiningFee: e.target.checked })}
                              className="h-4 w-4 accent-[var(--accent)]"
                            />
                            Waive the joining fee
                          </label>
                        )}
                      </div>
                      <Totals
                        currency={newQuote.currency}
                        rows={[
                          ["Price", newQuote.price],
                          ...(newQuote.override === null && newQuote.discount > 0 ? [["Discount", -Math.min(newQuote.discount, newQuote.price)] as [string, number]] : []),
                          ...(newQuote.override === null && newQuote.joiningFee > 0 ? [["Joining fee", newQuote.joiningFee] as [string, number]] : []),
                        ]}
                        total={newQuote.total}
                        paying={newQuote.paying}
                        balance={newQuote.balance}
                      />
                      <FormFooter busy={busy} error={error} label={`Collect ${money(newQuote.paying, newQuote.currency)} & start`} />
                    </>
                  )}
                </form>
              </Card>
            )}

            {!mode && (
              <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-sm text-neutral-500">
                {manage ? (
                  <>
                    <p className="font-medium text-neutral-700">Keys</p>
                    <ul className="mt-2 space-y-1 text-xs">
                      <li>
                        <Key k={KEYS.renew} /> collect &amp; renew · <Key k={KEYS.dues} /> collect dues · <Key k={KEYS.new} /> new membership
                      </li>
                      <li>
                        <Key k={KEYS.print} /> print the last receipt · <Key k={KEYS.search} /> find the next member · <Key k="Esc" /> close a form
                      </li>
                      <li>In a form, Enter collects.</li>
                    </ul>
                  </>
                ) : (
                  <p>Taking payments needs Package Orders at manage.</p>
                )}
                {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MembershipFacts({ m, owed }: { m: DeskMembership; owed: { currency: string; amount: number }[] }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
      <div className="col-span-2">
        <Fact label="Package">
          <span className="font-medium">{m.packageName}</span>
          {m.startsLater && <span className="ml-2 text-xs text-sky-700">paid in advance</span>}
          {m.trainerName && <span className="block text-xs text-neutral-500">Trainer: {m.trainerName}</span>}
        </Fact>
      </div>
      <Fact label="Fee">
        {money(m.amount, m.currency)}
        {m.discountAmount > 0 && (
          <span className="block text-xs text-emerald-700">
            −{money(m.discountAmount, m.currency)} discount{m.discountNote ? ` (${m.discountNote})` : ""}
          </span>
        )}
      </Fact>
      <Fact label="Paid by">{methodLabel(m.method) || "—"}</Fact>
      <Fact label="Start">{fmtDate(m.startDate)}</Fact>
      <Fact label="Next expiry">
        {fmtDate(m.endDate)}
        <span className={`block text-xs font-semibold ${daysTone(m.daysLeft)}`}>{daysLabel(m.daysLeft)}</span>
      </Fact>
      <Fact label="Status">
        <span className="flex flex-wrap gap-1">
          <Badge color={STATUS_COLORS[m.status] || "neutral"}>{m.status.replace("_", " ")}</Badge>
          {m.paymentStatus !== "paid" && <Badge color={STATUS_COLORS[m.paymentStatus] || "neutral"}>{m.paymentStatus === "processing" ? "awaiting review" : m.paymentStatus}</Badge>}
          {m.autoRenews && <Badge color="blue">card · renews itself</Badge>}
        </span>
      </Fact>
      <Fact label="Balance due">
        {owed.length ? (
          owed.map((row) => (
            <span key={row.currency} className="block font-semibold text-amber-700">
              {money(row.amount, row.currency)}
            </span>
          ))
        ) : (
          <span className="text-neutral-500">None</span>
        )}
      </Fact>
    </div>
  );
}

function StartHint({ m, startFrom }: { m: DeskMembership; startFrom: "expiry" | "today" }) {
  let text = "";
  let tone = "text-neutral-500";
  if (startFrom === "expiry") {
    if (m.live) text = `Continues from ${fmtDate(m.endDate)}: no days are lost.`;
    else if (m.endDate && (m.daysLeft ?? 0) < 0) {
      text = `Backdated to ${fmtDate(m.endDate)}: the ${-(m.daysLeft ?? 0)} day(s) since it ran out are part of the new term. Choose Today to start afresh.`;
      tone = "text-amber-700";
    } else if (m.endDate) text = `Starts ${fmtDate(m.endDate)}.`;
    else text = "Starts today.";
  } else if (m.live && (m.daysLeft ?? 0) > 0) {
    text = `The ${m.daysLeft} day(s) left on the current term overlap the new one.`;
    tone = "text-amber-700";
  } else {
    text = "Starts now.";
  }
  return <p className={`self-end pb-2 text-xs ${tone}`}>{text}</p>;
}

function MethodSelect({ value, onChange }: { value: string; onChange: (method: string) => void }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {DESK_METHODS.map((method) => (
        <option key={method} value={method}>
          {methodLabel(method)}
        </option>
      ))}
    </select>
  );
}

function FormHeading({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <button type="button" onClick={onClose} className="text-xs font-semibold text-neutral-500 hover:text-neutral-900">
        Close <Key k="Esc" />
      </button>
    </div>
  );
}

function Totals({
  currency,
  rows,
  total,
  totalLabel = "Total",
  paying,
  balance,
}: {
  currency: string;
  rows: [string, number][];
  total: number;
  totalLabel?: string;
  paying: number;
  balance: number;
}) {
  return (
    <div className="rounded-lg bg-neutral-50 px-4 py-3 text-sm" aria-live="polite">
      {rows.map(([label, amount]) => (
        <div key={label} className="flex justify-between text-neutral-600">
          <span>{label}</span>
          <span>{amount < 0 ? `−${money(-amount, currency)}` : money(amount, currency)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1 font-semibold text-neutral-900">
        <span>{totalLabel}</span>
        <span>{money(total, currency)}</span>
      </div>
      <div className="flex justify-between text-neutral-700">
        <span>Received now</span>
        <span>{money(paying, currency)}</span>
      </div>
      <div className={`flex justify-between font-semibold ${balance > 0 ? "text-amber-700" : balance < 0 ? "text-rose-700" : "text-emerald-700"}`}>
        <span>{balance < 0 ? "Over the total" : "Balance due after"}</span>
        <span>{money(Math.abs(balance), currency)}</span>
      </div>
    </div>
  );
}

function FormFooter({ busy, error, label }: { busy: boolean; error: string | null; label: string }) {
  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={primaryCls}>
          {busy ? "Saving…" : label} {!busy && <Key k="↵" />}
        </button>
      </div>
    </div>
  );
}

export default function FeeCollectionPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <FeeCollectionInner />
    </Suspense>
  );
}
