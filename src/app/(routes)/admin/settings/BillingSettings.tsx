"use client";

// Settings → Billing: the gym's own GymsPilotPro subscription, in two cards,
// the same look as Settings → Payments:
//   * Your GymsPilotPro plan: plan, status, next due date, amount, usage, and
//     (folded away) the plans it can move to.
//   * Pay: however the super admin chose that gyms pay GymsPilotPro
//     (`pay.provider` from GET /api/billing/subscription):
//       safepay  "Pay now" opens Safepay's page (POST /api/billing/pay).
//       stripe   Subscribe / the Stripe billing portal, as before.
//       generic  GymsPilotPro's bank accounts, then the receipt
//                (POST /api/billing/receipt), which the super admin approves.
//       none     Contact GymsPilotPro.
// A gym Stripe is still billing keeps the Stripe card whatever is chosen
// now: paying again another way would charge it twice.
//
// Anyone who can open Settings sees what the gym is on; only Settings ·
// manage can pay or change plan (the API checks the same thing again).
//
// Coming back: Stripe adds ?billing=success or ?billing=cancelled, Safepay
// ?paid=1. Either payment is recorded by a webhook a few seconds later, so
// the subscription is re-read a few times until it shows.
//
// Plans change here, not in the Stripe portal (which only has the card,
// invoices and cancelling): a gym Stripe bills moves at once, prorated
// (POST /api/billing/change-plan); one it does not yet subscribes to the
// plan it picked through checkout. With Safepay the owner pays for the plan
// picked; with a bank transfer, or no online payment, they ask GymsPilotPro.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, PrimaryButton, SecondaryButton, Badge, Spinner, Modal, useAsyncAction, untilPageLeaves } from "../_shared/ui";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { CardHead, Step } from "./PaymentsSettings";
import { AmountDue, ContactToPay, DueLine, PlatformBankAccounts, ReceiptUpload } from "./PlatformPay";
import {
  getSubscription,
  getPlans,
  changePlan,
  startCheckout,
  startPay,
  openPortal,
  formatMoney,
  formatDate,
  daysLeftLabel,
  payProviderOf,
  STATUS_LABELS,
  type BillingCycle,
  type BillingPlan,
  type BillingResult,
  type BillingSubscription,
  type PayProvider,
  type PendingPayRequest,
  type PlanUsage,
  type SubscriptionStatus,
} from "./billingApi";

const STATUS_COLORS: Record<SubscriptionStatus, "neutral" | "green" | "amber" | "rose" | "blue"> = {
  trialing: "blue",
  active: "green",
  past_due: "amber",
  expired: "rose",
  cancelled: "neutral",
};

// After Stripe: until the subscription shows. After Safepay: until the due
// date moves, about 30 seconds in all.
const CONFIRM_ATTEMPTS = 6;
const CONFIRM_EVERY_MS = 3000;
const PAID_ATTEMPTS = 10;

// The due date before the owner left for Safepay, to tell on the way back
// whether the payment has been recorded yet. Per tab, and only a nicety:
// without it the first read back is taken as "before".
const PAY_FROM_KEY = "gymspilotpro.billing.payFrom";

type Notice = { tone: "ok" | "warn" | "error"; text: string };

const NOTICE_STYLES: Record<Notice["tone"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A Stripe subscription in one of these is still charging the gym.
const STRIPE_LIVE: SubscriptionStatus[] = ["trialing", "active", "past_due"];

/** Paid for through Stripe, and Stripe has said so. */
function isSubscribed(sub: BillingSubscription | null) {
  return !!sub && sub.hasStripeSubscription && (sub.status === "active" || sub.status === "trialing");
}

/** How this gym pays now: the chosen way, or Stripe while a Stripe subscription still bills it. */
function payWithOf(sub: BillingSubscription): PayProvider {
  if (sub.stripeConfigured && sub.hasStripeSubscription && STRIPE_LIVE.includes(sub.status)) return "stripe";
  return payProviderOf(sub);
}

/** The date a payment moves forward: compared before and after paying. */
function dueKey(sub: BillingSubscription | null) {
  return (sub && (sub.pay?.due_date || sub.currentPeriodEnd)) || "";
}

function rememberDue(sub: BillingSubscription) {
  try {
    sessionStorage.setItem(PAY_FROM_KEY, dueKey(sub));
  } catch {
    /* storage off: the page goes by its first read instead */
  }
}

function recalledDue(): string | null {
  try {
    const value = sessionStorage.getItem(PAY_FROM_KEY);
    sessionStorage.removeItem(PAY_FROM_KEY);
    return value;
  } catch {
    return null;
  }
}

function periodLabel(sub: BillingSubscription, payWith: PayProvider) {
  switch (sub.status) {
    case "trialing":
      return "Trial ends";
    case "active":
      return sub.hasStripeSubscription && payWith === "stripe" ? "Renews" : "Next payment due";
    case "past_due":
      return "Payment was due";
    default:
      return "Ended";
  }
}

function contactLine(sub: BillingSubscription) {
  return sub.contactEmail ? sub.contactEmail : "GymsPilotPro support";
}

// A limit this full is worth a warning before it starts refusing people.
const NEAR_LIMIT = 0.9;

type UsageTone = "ok" | "near" | "full";

function usageTone(item: PlanUsage): UsageTone {
  if (!item.limit) return "ok";
  if (item.used >= item.limit) return "full";
  return item.used >= item.limit * NEAR_LIMIT ? "near" : "ok";
}

const USAGE_BAR: Record<UsageTone, string> = {
  ok: "bg-neutral-700",
  near: "bg-amber-500",
  full: "bg-rose-500",
};

const USAGE_TEXT: Record<UsageTone, string> = {
  ok: "text-neutral-900",
  near: "text-amber-700",
  full: "text-rose-700",
};

/** "Members", "Members and Classes", "Members, Trainers and Classes". */
function listOf(labels: string[]) {
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}` : labels[0] || "";
}

// A plan's limits, and the usage entry (billingController planUsage) each is counted by.
const PLAN_LIMITS: { field: keyof BillingPlan["limits"]; usageKey: string; label: string }[] = [
  { field: "maxMembers", usageKey: "members", label: "Members" },
  { field: "maxStaff", usageKey: "staff", label: "Staff accounts" },
  { field: "maxTrainers", usageKey: "trainers", label: "Trainers" },
  { field: "maxClasses", usageKey: "classes", label: "Classes" },
];

type PlanChoice = { plan: BillingPlan; cycle: BillingCycle };

// What a plan picked in the picker is paid with: Stripe (moved at once when
// Stripe already bills the gym) or Safepay (paid for there and then).
type PickerMode = "stripe" | "safepay";

const perLabel = (cycle: BillingCycle) => (cycle === "yearly" ? "year" : "month");
const planPrice = (plan: BillingPlan, cycle: BillingCycle) => (cycle === "yearly" ? plan.price.yearly : plan.price.monthly);

/** What the gym has more of than `plan` allows: nothing is removed, but nothing more can be added. */
function overLimits(plan: BillingPlan, usage: PlanUsage[]) {
  return PLAN_LIMITS.filter(({ field, usageKey }) => {
    const limit = plan.limits[field];
    const used = usage.find((u) => u.key === usageKey)?.used ?? 0;
    return limit > 0 && used > limit;
  }).map(({ label }) => label);
}

// One plan limit: "182 / 200" over a bar, amber from 90% and red once full.
function UsageMeter({ item }: { item: PlanUsage }) {
  const tone = usageTone(item);
  const percent = item.limit ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-neutral-500">{item.label}</span>
        <span className={`text-sm font-semibold ${USAGE_TEXT[tone]}`}>
          {item.used.toLocaleString()}
          <span className="font-normal text-neutral-500">{item.limit ? ` / ${item.limit.toLocaleString()}` : " · no limit"}</span>
        </span>
      </div>
      {item.limit ? (
        <div
          role="meter"
          aria-label={item.label}
          aria-valuemin={0}
          aria-valuemax={item.limit}
          aria-valuenow={Math.min(item.used, item.limit)}
          aria-valuetext={`${item.used} of ${item.limit}`}
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100"
        >
          <div className={`h-full rounded-full ${USAGE_BAR[tone]}`} style={{ width: `${percent}%` }} />
        </div>
      ) : null}
      {tone !== "ok" && (
        <p className={`mt-1 text-[11px] font-medium ${USAGE_TEXT[tone]}`}>{tone === "full" ? "Limit reached" : "Almost at the limit"}</p>
      )}
    </li>
  );
}

// The plans on sale, a tile each: the price for the chosen cycle, the limits
// (and what the gym already has more of than a smaller plan allows), and the
// button that moves to it -- or why it cannot.
function PlanPicker({
  plans,
  sub,
  mode,
  subscribed,
  cycle,
  onCycle,
  onPick,
  disabled,
}: {
  plans: BillingPlan[];
  sub: BillingSubscription;
  mode: PickerMode;
  subscribed: boolean;
  cycle: BillingCycle;
  onCycle: (cycle: BillingCycle) => void;
  onPick: (choice: PlanChoice) => void;
  disabled: boolean;
}) {
  const offersYearly = plans.some((plan) => plan.price.yearly > 0);
  const usage = sub.usage || [];
  // Paid for there and then (Safepay), a plan is moved to rather than subscribed to.
  const moving = subscribed || mode === "safepay";
  return (
    <div>
      {offersYearly && (
        <div className="mb-4">
          <CycleSwitch cycle={cycle} onCycle={onCycle} />
        </div>
      )}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const price = planPrice(plan, cycle);
          const isCurrent = plan.current && cycle === sub.billingCycle;
          // A running Stripe subscription cannot change currency (the API refuses it too).
          const otherCurrency = mode === "stripe" && subscribed && plan.price.currency.toUpperCase() !== sub.currency.toUpperCase();
          const over = plan.current ? [] : overLimits(plan, usage);

          let action: string | null = null;
          let blocked = "";
          if (isCurrent) action = null;
          else if (!(price > 0)) blocked = plan.price.monthly > 0 || plan.price.yearly > 0 ? `Not sold ${cycle}.` : "Free — contact us to move to it.";
          else if (otherCurrency) blocked = `Priced in ${plan.price.currency} — contact us to switch currency.`;
          // Not billed by Stripe yet: subscribing to the gym's own plan is the Subscribe button below.
          else if (plan.current) action = moving ? `Switch to ${cycle}` : null;
          else action = moving ? `Move to ${plan.name}` : `Subscribe to ${plan.name}`;

          return (
            <li
              key={plan.slug}
              className={`flex flex-col rounded-xl border p-4 ${isCurrent ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-neutral-200"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-neutral-900">{plan.name}</span>
                {plan.current && <Badge color="blue">{isCurrent ? "Your plan" : `Your plan · ${sub.billingCycle}`}</Badge>}
              </div>
              <p className="mt-1 text-sm text-neutral-900">
                {price > 0 ? (
                  <>
                    {formatMoney(price, plan.price.currency)} <span className="text-neutral-500">/ {perLabel(cycle)}</span>
                  </>
                ) : (
                  <span className="text-neutral-500">—</span>
                )}
              </p>
              {plan.description && <p className="mt-1 text-xs text-neutral-500">{plan.description}</p>}
              <ul className="mt-3 space-y-1 text-xs text-neutral-600">
                {PLAN_LIMITS.map(({ field, label }) => (
                  <li key={field} className="flex justify-between gap-3">
                    <span>{label}</span>
                    <span className="font-medium text-neutral-800">{plan.limits[field] > 0 ? plan.limits[field].toLocaleString() : "Unlimited"}</span>
                  </li>
                ))}
              </ul>
              {over.length > 0 && (
                <p className="mt-2 text-[11px] font-medium text-amber-700">You have more {listOf(over).toLowerCase()} than this plan allows.</p>
              )}
              <div className="mt-auto pt-4">
                {action ? (
                  <SecondaryButton onClick={() => onPick({ plan, cycle })} disabled={disabled}>
                    {action}
                  </SecondaryButton>
                ) : blocked ? (
                  <p className="text-xs text-neutral-500">{blocked}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Monthly | Yearly, small: the plan picker's prices, and what Pay now pays for.
function CycleSwitch({ cycle, onCycle }: { cycle: BillingCycle; onCycle: (c: BillingCycle) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-200 p-0.5" role="radiogroup" aria-label="Billing cycle">
      {(["monthly", "yearly"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={cycle === c}
          onClick={() => onCycle(c)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
            cycle === c ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          {c === "yearly" ? "Yearly" : "Monthly"}
        </button>
      ))}
    </div>
  );
}

// Monthly or yearly, each with what it costs: before subscribing through Stripe.
function CycleChoice({ cycle, onCycle, priceFor }: { cycle: BillingCycle; onCycle: (c: BillingCycle) => void; priceFor: (c: BillingCycle) => string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Billing cycle">
      {(["monthly", "yearly"] as const).map((c) => {
        const active = cycle === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onCycle(c)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              active ? "border-neutral-900 ring-2 ring-neutral-900/10 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
            }`}
          >
            <span className="block text-sm font-semibold text-neutral-900">{c === "yearly" ? "Yearly" : "Monthly"}</span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              {priceFor(c)} / {perLabel(c)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// A card's lower band: its buttons, on the same grey as Settings → Payments.
function CardFoot({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-b-xl border-t border-neutral-100 bg-neutral-50/70 px-4 py-4 sm:px-6">{children}</div>
  );
}

const PAY_LINES: Record<PayProvider, string> = {
  safepay: "Card, JazzCash, Easypaisa or your bank app.",
  stripe: "By card, through Stripe.",
  generic: "By bank transfer, then upload the receipt.",
  none: "",
};

export default function BillingSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = usePermissions();
  const canManage = can("settings", "manage");

  const [sub, setSub] = useState<BillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  // Keyed "checkout", "portal", "pay" or "plan": whichever is running holds back the others.
  const billingAction = useAsyncAction();
  const busy = billingAction.busy;
  const retrying = useAsyncAction();
  const [notice, setNotice] = useState<Notice | null>(null);
  // The plan picker: what is on sale, whether it is open, the cycle it
  // shows, and the choice waiting to be confirmed.
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickCycle, setPickCycle] = useState<BillingCycle>("monthly");
  const [choice, setChoice] = useState<PlanChoice | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // The confirm loop outlives re-renders but must stop when the tab closes.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async (): Promise<BillingSubscription | null> => {
    try {
      const res = await getSubscription();
      if (!res.ok || !res.data) throw new Error(res.message || "Could not load your subscription.");
      if (!alive.current) return res.data;
      setSub(res.data);
      setCycle(res.data.billingCycle === "yearly" ? "yearly" : "monthly");
      setPickCycle(res.data.billingCycle === "yearly" ? "yearly" : "monthly");
      setLoadError(null);
      return res.data;
    } catch (e) {
      if (alive.current) setLoadError(e instanceof Error ? e.message : "Could not load your subscription.");
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  // The picker is extra: plans that cannot be read leave it out, not the tab.
  const loadPlans = useCallback(async () => {
    try {
      const res = await getPlans();
      if (alive.current) setPlans(res.ok && Array.isArray(res.data) ? res.data : []);
    } catch {
      if (alive.current) setPlans([]);
    }
  }, []);

  useEffect(() => {
    if (canManage) loadPlans();
  }, [canManage, loadPlans]);

  // Runs once per visit to the tab: the first read, and whatever Stripe or
  // Safepay sent the owner back to say. ?billing= and ?paid= come off the URL
  // straight away so a refresh does not repeat the message.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const outcome = searchParams.get("billing");
    const paid = searchParams.get("paid") === "1";
    if (outcome === "success" || outcome === "cancelled" || searchParams.has("paid")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("billing");
      params.delete("paid");
      router.replace(`/admin/settings?${params.toString()}`, { scroll: false });
    }

    // Back from Safepay: paid. Recorded once Safepay's webhook lands, which
    // moves the due date on.
    if (paid) {
      setNotice({ tone: "ok", text: "Payment received — thank you. Updating your plan…" });
      let before = recalledDue();
      (async () => {
        for (let attempt = 0; attempt < PAID_ATTEMPTS; attempt += 1) {
          const latest = await load();
          if (!alive.current) return;
          if (latest) {
            const now = dueKey(latest);
            if (before === null) before = now;
            else if (now !== before) {
              const until = formatDate(latest.currentPeriodEnd || latest.pay?.due_date);
              setNotice({ tone: "ok", text: `Payment received — thank you.${until ? ` Paid until ${until}.` : ""}` });
              return;
            }
          }
          await wait(CONFIRM_EVERY_MS);
        }
        if (alive.current) {
          setNotice({ tone: "ok", text: "Payment received — thank you. It can take a minute to show here; refresh the page soon." });
        }
      })();
      return;
    }

    if (outcome === "cancelled") {
      setNotice({ tone: "warn", text: "Checkout was cancelled — nothing was charged." });
      load();
      return;
    }
    if (outcome !== "success") {
      load();
      return;
    }

    setNotice({ tone: "ok", text: "Payment received — confirming your subscription…" });
    (async () => {
      for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt += 1) {
        const latest = await load();
        if (!alive.current) return;
        if (isSubscribed(latest)) {
          setNotice({
            tone: "ok",
            text: latest?.status === "trialing" ? "You're subscribed. Your card will be charged when the trial ends." : "You're subscribed — thank you.",
          });
          return;
        }
        await wait(CONFIRM_EVERY_MS);
      }
      if (alive.current) {
        setNotice({ tone: "warn", text: "Payment received. Stripe is still confirming it — refresh this page in a minute to see it here." });
      }
    })();
  }, [searchParams, router, load]);

  // Off to Stripe when the checkout opened; otherwise says why, and re-reads
  // the subscription when the answer means it has changed underneath.
  const followCheckout = async (res: BillingResult<{ url: string }>) => {
    if (res.ok && res.data?.url) {
      // Stays "busy" while the browser leaves for Stripe.
      window.location.assign(res.data.url);
      return untilPageLeaves();
    }
    if (res.code === "ALREADY_SUBSCRIBED" || res.code === "CHECKOUT_COMPLETED") {
      setNotice({ tone: "warn", text: res.message || "This gym already has a subscription. Change its plan here, or its card from Manage billing." });
      await load();
    } else if (res.code === "PLATFORM_STRIPE_NOT_CONFIGURED") {
      setNotice({ tone: "warn", text: `Online payment isn't set up yet — contact ${sub ? contactLine(sub) : "GymsPilotPro support"}.` });
      await load();
    } else {
      setNotice({ tone: "error", text: res.message || "Could not start the checkout." });
    }
  };

  // Off to Safepay when its page opened. A refusal that means GymsPilotPro
  // changed how gyms pay re-reads the subscription, which redraws the card.
  const followPay = async (res: BillingResult<{ url: string }>) => {
    if (res.ok && res.data?.url) {
      if (sub) rememberDue(sub);
      // Stays "busy" while the browser leaves for Safepay.
      window.location.assign(res.data.url);
      return untilPageLeaves();
    }
    if (res.code === "BANK_TRANSFER_ONLY" || res.code === "ONLINE_PAYMENT_OFF") {
      setNotice({ tone: "warn", text: res.message || "GymsPilotPro has changed how gyms pay. See Pay below." });
      await load();
    } else {
      setNotice({ tone: "error", text: res.message || "Could not open the payment page. Please try again." });
    }
  };

  const subscribe = () => billingAction.run("checkout", async () => {
    setNotice(null);
    try {
      await followCheckout(await startCheckout(cycle));
    } catch {
      setNotice({ tone: "error", text: "Could not reach the server. Please try again." });
    }
  });

  const payNow = () => billingAction.run("pay", async () => {
    setNotice(null);
    try {
      await followPay(await startPay(cycle));
    } catch {
      setNotice({ tone: "error", text: "Could not reach the server. Please try again." });
    }
  });

  // The confirmed choice from the plan picker. With Safepay it is paid for
  // there and then. With Stripe, a gym Stripe bills moves at once; one it
  // does not (yet) subscribes to the plan through checkout.
  const applyChoice = (picked: PlanChoice, subscribed: boolean, mode: PickerMode) => billingAction.run("plan", async () => {
    setNotice(null);
    try {
      if (mode === "safepay") {
        const res = await startPay(picked.cycle, picked.plan.current ? undefined : picked.plan.slug);
        setChoice(null);
        await followPay(res);
        return;
      }
      if (subscribed) {
        const res = await changePlan(picked.plan.slug, picked.cycle);
        if (res.ok) {
          setChoice(null);
          setNotice({ tone: "ok", text: res.message || `You are on ${picked.plan.name} now.` });
          await Promise.all([load(), loadPlans()]);
          return;
        }
        if (res.code !== "NO_STRIPE_SUBSCRIPTION") {
          setChoice(null);
          setNotice({ tone: res.status >= 500 ? "error" : "warn", text: res.message || "Could not change the plan." });
          return;
        }
        // Stripe does not bill the gym after all: subscribe instead.
      }
      const res = await startCheckout(picked.cycle, picked.plan.current ? undefined : picked.plan.slug);
      setChoice(null);
      await followCheckout(res);
    } catch {
      setChoice(null);
      setNotice({ tone: "error", text: "Could not reach the server. Please try again." });
    }
  });

  const manage = () => billingAction.run("portal", async () => {
    setNotice(null);
    try {
      const res = await openPortal();
      if (res.ok && res.data?.url) {
        // Stays "busy" while the browser leaves for Stripe.
        window.location.assign(res.data.url);
        return untilPageLeaves();
      }
      setNotice({ tone: "error", text: res.message || "Could not open the billing portal." });
    } catch {
      setNotice({ tone: "error", text: "Could not reach the server. Please try again." });
    }
  });

  // A receipt went up: shown as sent at once, then the subscription re-read.
  const receiptSent = async (next: PendingPayRequest | null) => {
    setSub((current) => (current && current.pay ? { ...current, pay: { ...current.pay, pending_request: next } } : current));
    await load();
  };

  const noticeBox = notice && (
    <div className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${NOTICE_STYLES[notice.tone]}`} role="status">
      <span className="min-w-0">{notice.text}</span>
      <button
        type="button"
        onClick={() => setNotice(null)}
        className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  );

  if (loading && !sub) return <Spinner />;

  if (!sub) {
    return (
      <div className="space-y-6">
        {noticeBox}
        <Card className="p-6">
          <p className="text-sm font-semibold text-neutral-900">Your subscription could not be loaded</p>
          <p className="mt-1 text-xs text-neutral-500">{loadError || "Please try again in a moment."}</p>
          <div className="mt-4">
            <SecondaryButton
              onClick={() =>
                retrying.run(async () => {
                  setLoading(true);
                  await load();
                })
              }
              loading={retrying.busy}
            >
              Try again
            </SecondaryButton>
          </div>
        </Card>
      </div>
    );
  }

  const plan = sub.plan;
  const pay = sub.pay || null;
  const payWith = payWithOf(sub);
  const paidAddons = sub.addons.filter((a) => a.amount > 0);
  const hasYearly = !!plan && plan.price.yearly > 0;
  const planIsFree = !!plan && !(plan.price.monthly > 0) && !(plan.price.yearly > 0);
  const perCycle = perLabel(sub.billingCycle);
  const periodDate = formatDate(sub.currentPeriodEnd || pay?.due_date);
  const left = daysLeftLabel(sub.daysLeft);

  // What the plan allows against what the gym has. The warning points at the
  // plan picker when there is one, and at the platform otherwise.
  const usage = plan ? sub.usage || [] : [];
  const fullLabels = usage.filter((item) => usageTone(item) === "full").map((item) => item.label);
  const nearLabels = usage.filter((item) => usageTone(item) === "near").map((item) => item.label);
  // The limit warning already says who to ask about a bigger plan.
  const limitWarning = fullLabels.length > 0 || nearLabels.length > 0;

  // The plan picker, for whoever may pay, and only where a plan can be paid
  // for from here. With Stripe: not for a gym the platform bills by hand (it
  // pays some other way), nor one whose Stripe subscription is waiting on a
  // payment -- the card comes first, in the portal. With Safepay: any gym on
  // a paid plan. A bank transfer or no online payment: ask GymsPilotPro.
  const subscribed = isSubscribed(sub);
  const billedByHand = sub.status === "active" && !sub.hasStripeSubscription;
  const owesStripe = sub.hasStripeSubscription && !subscribed;
  const pickerMode: PickerMode | null =
    payWith === "stripe" && sub.stripeConfigured && !billedByHand && !owesStripe ? "stripe" : payWith === "safepay" && !!plan ? "safepay" : null;
  const showPicker = canManage && !!pickerMode && plans.length > 0;
  const otherPlans = plans.some((p) => !p.current);
  const seePlans = () => {
    setPickerOpen(true);
    // After the picker has opened.
    requestAnimationFrame(() => pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // What a cycle costs. The gym's own cycle is its agreed all-in amount; the
  // other is the plan's list price, with add-ons priced at checkout.
  const priceFor = (c: BillingCycle) => {
    if (!plan) return "";
    if (c === sub.billingCycle && sub.amount > 0) return formatMoney(sub.amount, sub.currency);
    const base = formatMoney(c === "yearly" ? plan.price.yearly : plan.price.monthly, plan.price.currency || sub.currency);
    return paidAddons.length ? `${base} + add-ons` : base;
  };
  // What a Safepay payment or a bank transfer is for: the API's own figure for the gym's cycle.
  const amountDue = (c: BillingCycle = sub.billingCycle) =>
    c === sub.billingCycle && pay && pay.amount_due > 0 ? formatMoney(pay.amount_due, pay.currency || sub.currency) : priceFor(c);

  // ---- Pay, by how GymsPilotPro is paid ----
  const stripeBody = !sub.stripeConfigured ? (
    <p className="text-sm text-neutral-600">Online payment isn&apos;t set up yet — contact {contactLine(sub)}.</p>
  ) : sub.hasStripeSubscription ? (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="min-w-0 text-sm text-neutral-600">
        {sub.status === "past_due"
          ? "Your last payment did not go through. Update your card and Stripe will try again."
          : sub.status === "expired"
          ? "A payment did not go through, so your subscription lapsed. Pay it or update your card in the billing portal: everything comes back as soon as Stripe is paid."
          : `Your card is on file. Update it, download invoices or cancel in the billing portal.${showPicker ? " To change plan, use Change plan above." : ""}`}
      </p>
      <PrimaryButton onClick={manage} loading={billingAction.isBusy("portal")} disabled={busy}>
        Manage billing, card & invoices
      </PrimaryButton>
    </div>
  ) : !plan ? (
    <p className="text-sm text-neutral-600">This gym is not on a plan yet — contact {contactLine(sub)} to choose one.</p>
  ) : planIsFree ? (
    <p className="text-sm text-neutral-600">Your plan is free — there is nothing to pay.</p>
  ) : sub.status === "active" ? (
    <p className="text-sm text-neutral-600">GymsPilotPro bills this gym directly. To pay by card instead, contact {contactLine(sub)}.</p>
  ) : (
    <div className="space-y-4">
      {hasYearly && <CycleChoice cycle={cycle} onCycle={setCycle} priceFor={priceFor} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="min-w-0 text-sm text-neutral-600">
          {sub.status === "trialing"
            ? // Stripe keeps a trial only with more than 48 hours of it left.
              sub.daysLeft !== null && sub.daysLeft >= 3
              ? `Add your card now and keep your trial: the first charge is on ${periodDate}.`
              : "Your trial is ending — subscribe to keep everything running."
            : sub.status === "past_due"
            ? "Your payment is overdue. Subscribe now to keep your website, member app and admin running."
            : "Subscribe to bring everything back exactly as you left it."}
          {!hasYearly && ` ${priceFor(cycle)} / ${perLabel(cycle)}.`}
        </p>
        <PrimaryButton onClick={subscribe} loading={billingAction.isBusy("checkout")} disabled={busy}>
          Subscribe
        </PrimaryButton>
      </div>
    </div>
  );

  const safepayBody = (
    <div className="space-y-4">
      {hasYearly && <CycleSwitch cycle={cycle} onCycle={setCycle} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AmountDue amount={amountDue(cycle)} dueDate={pay?.due_date || sub.currentPeriodEnd} />
        <PrimaryButton onClick={payNow} loading={billingAction.isBusy("pay")} disabled={busy}>
          Pay now
        </PrimaryButton>
      </div>
      <p className="text-xs text-neutral-500">You pay on Safepay&apos;s secure page, then come back here.</p>
    </div>
  );

  const pending = pay?.pending_request || null;
  const bankBody = (
    <ol>
      <Step n={1} title={`Send ${amountDue()} to GymsPilotPro`}>
        <div className="space-y-3">
          <DueLine day={pay?.due_date || sub.currentPeriodEnd} />
          <PlatformBankAccounts accounts={pay?.bank_accounts || []} contactEmail={sub.contactEmail} />
        </div>
      </Step>
      <Step n={2} title="Upload the receipt" done={pending?.status === "pending"} last>
        <ReceiptUpload request={pending} currency={pay?.currency || sub.currency} onSent={receiptSent} />
      </Step>
    </ol>
  );

  const payBody = !canManage ? (
    <p className="text-sm text-neutral-600">Only the gym&apos;s owner or an admin with Settings access can pay.</p>
  ) : payWith === "stripe" ? (
    stripeBody
  ) : !plan ? (
    <ContactToPay email={sub.contactEmail} what="This gym is not on a plan yet. To choose one" />
  ) : planIsFree ? (
    <p className="text-sm text-neutral-600">Your plan is free — there is nothing to pay.</p>
  ) : payWith === "safepay" ? (
    safepayBody
  ) : payWith === "generic" ? (
    bankBody
  ) : (
    <ContactToPay email={sub.contactEmail} />
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Billing</h2>
        <p className="mt-0.5 text-sm text-neutral-500">Your GymsPilotPro plan and how you pay for it.</p>
      </div>

      {noticeBox}

      {/* ---- Your GymsPilotPro plan ---- */}
      <Card>
        <CardHead title="Your GymsPilotPro plan" line="Keeps your website, member app and admin running." />
        <div className="px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-neutral-500">Plan</dt>
              <dd className="mt-1 text-sm font-semibold text-neutral-900">{plan ? plan.name : "No plan"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-neutral-500">Status</dt>
              <dd className="mt-1">
                <Badge color={STATUS_COLORS[sub.status] || "neutral"}>{STATUS_LABELS[sub.status] || sub.status}</Badge>
              </dd>
            </div>
            {periodDate && (
              <div className="min-w-0">
                <dt className="text-xs font-medium text-neutral-500">{periodLabel(sub, payWith)}</dt>
                <dd className="mt-1 text-sm text-neutral-900">
                  {periodDate}
                  {left && (sub.status === "trialing" || sub.status === "active") && <span className="text-neutral-500"> · {left}</span>}
                </dd>
              </div>
            )}
            {plan && sub.amount > 0 && (
              <div className="min-w-0">
                <dt className="text-xs font-medium text-neutral-500">Amount</dt>
                <dd className="mt-1 text-sm text-neutral-900">
                  {formatMoney(sub.amount, sub.currency)} <span className="text-neutral-500">/ {perCycle}</span>
                </dd>
              </div>
            )}
          </dl>

          {sub.addons.length > 0 && (
            <div className="mt-5 border-t border-neutral-100 pt-5">
              <p className="text-xs font-medium text-neutral-500">Add-ons</p>
              <ul className="mt-2 space-y-1">
                {sub.addons.map((addon) => (
                  <li key={addon.slug} className="flex items-center justify-between gap-4 text-sm">
                    <span className="min-w-0 text-neutral-800">{addon.name}</span>
                    <span className="shrink-0 text-neutral-500">{addon.amount > 0 ? `${formatMoney(addon.amount, sub.currency)} / ${perCycle}` : "Included"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {usage.length > 0 && (
            <div className="mt-5 border-t border-neutral-100 pt-5">
              <p className="text-xs font-medium text-neutral-500">Plan usage</p>
              <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                {usage.map((item) => (
                  <UsageMeter key={item.key} item={item} />
                ))}
              </ul>

              {limitWarning && (
                <div
                  className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-[13px] ${
                    fullLabels.length ? NOTICE_STYLES.error : NOTICE_STYLES.warn
                  }`}
                >
                  <span className="min-w-0">
                    {fullLabels.length
                      ? `${listOf(fullLabels)} are at your plan's limit — no more can be added until the plan is upgraded.`
                      : `${listOf(nearLabels)} are close to your plan's limit.`}{" "}
                    {showPicker
                      ? "Move to a bigger plan."
                      : canManage
                      ? `Contact ${contactLine(sub)} to move to a bigger plan.`
                      : "Ask the gym's owner to upgrade the plan."}
                  </span>
                  {showPicker && <SecondaryButton onClick={seePlans}>See plans</SecondaryButton>}
                </div>
              )}
            </div>
          )}
        </div>

        {showPicker ? (
          <>
            <CardFoot>
              <SecondaryButton onClick={() => setPickerOpen((open) => !open)} disabled={busy}>
                {pickerOpen ? "Hide plans" : "Change plan"}
              </SecondaryButton>
              {pickerOpen && (
                <p className="text-xs text-neutral-500">
                  {pickerMode === "safepay"
                    ? "Pick a plan, then pay for it on Safepay."
                    : subscribed
                    ? sub.status === "trialing"
                      ? "Nothing is charged until your trial ends."
                      : "Prorated against what you have already paid."
                    : "Your data stays exactly as it is."}
                </p>
              )}
            </CardFoot>
            {pickerOpen && (
              <div ref={pickerRef} className="scroll-mt-6 border-t border-neutral-100 px-4 py-5 sm:px-6">
                <PlanPicker
                  plans={plans}
                  sub={sub}
                  mode={pickerMode || "stripe"}
                  subscribed={subscribed}
                  cycle={pickCycle}
                  onCycle={setPickCycle}
                  onPick={setChoice}
                  disabled={busy}
                />
                {paidAddons.length > 0 && <p className="mt-3 text-xs text-neutral-500">Prices are for the plan; your paid add-ons stay on at their own price.</p>}
              </div>
            )}
          </>
        ) : canManage && otherPlans && !limitWarning && (payWith === "generic" || payWith === "none") ? (
          <CardFoot>
            <ContactToPay email={sub.contactEmail} what="To change plan" />
          </CardFoot>
        ) : null}
      </Card>

      {/* ---- Pay ---- */}
      <Card>
        <CardHead title="Pay" line={PAY_LINES[payWith] || undefined} />
        <div className="px-4 py-5 sm:px-6">{payBody}</div>
      </Card>

      <Modal
        open={!!choice}
        onClose={() => {
          if (!billingAction.isBusy("plan")) setChoice(null);
        }}
        title={
          choice
            ? subscribed || pickerMode === "safepay"
              ? choice.plan.current
                ? `Switch to ${choice.cycle} billing?`
                : `Move to ${choice.plan.name}?`
              : `Subscribe to ${choice.plan.name}?`
            : ""
        }
        size="sm"
        busy={billingAction.isBusy("plan")}
      >
        {choice && (
          <div className="space-y-3 text-sm text-neutral-700">
            <p>
              <span className="font-semibold text-neutral-900">
                {formatMoney(planPrice(choice.plan, choice.cycle), choice.plan.price.currency)} / {perLabel(choice.cycle)}
              </span>
              {paidAddons.length > 0 && <span className="text-neutral-500"> plus your add-ons</span>}
            </p>
            <p>
              {pickerMode === "safepay"
                ? `You pay on Safepay's secure page. Your plan moves to ${choice.plan.name}${choice.plan.current ? ` (${choice.cycle})` : ""} once it's paid.`
                : subscribed
                ? sub.status === "trialing"
                  ? `You're on your free trial, so nothing is charged now. Your card is first charged the new price when the trial ends${periodDate ? `, on ${periodDate}` : ""}.`
                  : "Stripe prorates the change: moving to a dearer plan or cycle charges the difference for the rest of your current period to your card straight away; moving to a cheaper one leaves the unused part as a credit on your next invoice."
                : sub.status === "trialing" && sub.daysLeft !== null && sub.daysLeft >= 3
                ? `You'll add your card on Stripe's secure page. Your trial carries on: the first charge is on ${periodDate}.`
                : `You'll add your card on Stripe's secure page and pay the first ${perLabel(choice.cycle)} now.`}
            </p>
            {overLimits(choice.plan, sub.usage || []).length > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                You have more {listOf(overLimits(choice.plan, sub.usage || [])).toLowerCase()} than {choice.plan.name} allows. Nothing is removed,
                but no more can be added until you are under its limits.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setChoice(null)} disabled={billingAction.isBusy("plan")}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                onClick={() => applyChoice(choice, subscribed, pickerMode || "stripe")}
                loading={billingAction.isBusy("plan")}
                disabled={busy}
              >
                {subscribed && pickerMode !== "safepay" ? "Confirm change" : "Continue to payment"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
