"use client";

// Settings → Billing: the gym's own GymPilot subscription. Anyone who can
// open Settings sees what the gym is on; only Settings · manage can pay or
// open the Stripe portal (the API checks the same thing again).
//
// Stripe sends the owner back here with ?billing=success or ?billing=cancelled.
// A successful checkout is recorded by Stripe's webhook a few seconds later,
// so on success the subscription is re-read a few times until it shows.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, PrimaryButton, SecondaryButton, Badge, Spinner } from "../_shared/ui";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import {
  getSubscription,
  startCheckout,
  openPortal,
  formatMoney,
  formatDate,
  daysLeftLabel,
  STATUS_LABELS,
  type BillingCycle,
  type BillingSubscription,
  type SubscriptionStatus,
} from "./billingApi";

const STATUS_COLORS: Record<SubscriptionStatus, "neutral" | "green" | "amber" | "rose" | "blue"> = {
  trialing: "blue",
  active: "green",
  past_due: "amber",
  expired: "rose",
  cancelled: "neutral",
};

const CONFIRM_ATTEMPTS = 6;
const CONFIRM_EVERY_MS = 3000;

type Notice = { tone: "ok" | "warn" | "error"; text: string };

const NOTICE_STYLES: Record<Notice["tone"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Paid for through Stripe, and Stripe has said so. */
function isSubscribed(sub: BillingSubscription | null) {
  return !!sub && sub.hasStripeSubscription && (sub.status === "active" || sub.status === "trialing");
}

function periodLabel(sub: BillingSubscription) {
  switch (sub.status) {
    case "trialing":
      return "Trial ends";
    case "active":
      return sub.hasStripeSubscription ? "Renews" : "Paid until";
    case "past_due":
      return "Payment was due";
    default:
      return "Ended";
  }
}

function contactLine(sub: BillingSubscription) {
  return sub.contactEmail ? sub.contactEmail : "GymPilot support";
}

export default function BillingSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = usePermissions();
  const canManage = can("settings", "manage");

  const [sub, setSub] = useState<BillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

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
      setLoadError(null);
      return res.data;
    } catch (e) {
      if (alive.current) setLoadError(e instanceof Error ? e.message : "Could not load your subscription.");
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  // Runs once per visit to the tab: the first read, and whatever Stripe sent
  // the owner back to say. ?billing= comes off the URL straight away so a
  // refresh does not repeat the message.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const outcome = searchParams.get("billing");
    if (outcome === "success" || outcome === "cancelled") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("billing");
      router.replace(`/admin/settings?${params.toString()}`, { scroll: false });
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

  const subscribe = async () => {
    setBusy("checkout");
    setNotice(null);
    try {
      const res = await startCheckout(cycle);
      if (res.ok && res.data?.url) {
        // Stays "busy" while the browser leaves for Stripe.
        window.location.assign(res.data.url);
        return;
      }
      if (res.code === "ALREADY_SUBSCRIBED") {
        setNotice({ tone: "warn", text: "This gym already has a subscription. Use Manage billing to change the card, cycle or plan." });
        await load();
      } else if (res.code === "PLATFORM_STRIPE_NOT_CONFIGURED") {
        setNotice({ tone: "warn", text: `Online payment isn't set up yet — contact ${sub ? contactLine(sub) : "GymPilot support"}.` });
        await load();
      } else {
        setNotice({ tone: "error", text: res.message || "Could not start the checkout." });
      }
    } catch {
      setNotice({ tone: "error", text: "Could not reach the server. Please try again." });
    }
    setBusy(null);
  };

  const manage = async () => {
    setBusy("portal");
    setNotice(null);
    try {
      const res = await openPortal();
      if (res.ok && res.data?.url) {
        window.location.assign(res.data.url);
        return;
      }
      setNotice({ tone: "error", text: res.message || "Could not open the billing portal." });
    } catch {
      setNotice({ tone: "error", text: "Could not reach the server. Please try again." });
    }
    setBusy(null);
  };

  const noticeBox = notice && (
    <div className={`mb-5 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${NOTICE_STYLES[notice.tone]}`}>
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
      <div>
        {noticeBox}
        <Card className="p-6">
          <p className="text-sm font-semibold text-neutral-900">Your subscription could not be loaded</p>
          <p className="mt-1 text-xs text-neutral-500">{loadError || "Please try again in a moment."}</p>
          <div className="mt-4">
            <SecondaryButton
              onClick={() => {
                setLoading(true);
                load();
              }}
            >
              Try again
            </SecondaryButton>
          </div>
        </Card>
      </div>
    );
  }

  const plan = sub.plan;
  const paidAddons = sub.addons.filter((a) => a.amount > 0);
  const hasYearly = !!plan && plan.price.yearly > 0;
  const planIsFree = !!plan && !(plan.price.monthly > 0) && !(plan.price.yearly > 0);
  const perCycle = sub.billingCycle === "yearly" ? "year" : "month";
  const periodDate = formatDate(sub.currentPeriodEnd);
  const left = daysLeftLabel(sub.daysLeft);

  // What a cycle costs. The gym's own cycle is its agreed all-in amount; the
  // other is the plan's list price, with add-ons priced at checkout.
  const priceFor = (c: BillingCycle) => {
    if (!plan) return "";
    if (c === sub.billingCycle && sub.amount > 0) return formatMoney(sub.amount, sub.currency);
    const base = formatMoney(c === "yearly" ? plan.price.yearly : plan.price.monthly, plan.price.currency || sub.currency);
    return paidAddons.length ? `${base} + add-ons` : base;
  };

  return (
    <div className="space-y-6">
      {noticeBox}

      <Card className="p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-neutral-900">Your GymPilot plan</h2>
          <p className="mt-1 text-xs text-neutral-500">What keeps your website, member app and admin running.</p>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-neutral-500">Plan</dt>
            <dd className="mt-1 text-sm font-semibold text-neutral-900">{plan ? plan.name : "No plan"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-neutral-500">Status</dt>
            <dd className="mt-1">
              <Badge color={STATUS_COLORS[sub.status] || "neutral"}>{STATUS_LABELS[sub.status] || sub.status}</Badge>
            </dd>
          </div>
          {periodDate && (
            <div>
              <dt className="text-xs font-medium text-neutral-500">{periodLabel(sub)}</dt>
              <dd className="mt-1 text-sm text-neutral-900">
                {periodDate}
                {left && (sub.status === "trialing" || sub.status === "active") && <span className="text-neutral-500"> · {left}</span>}
              </dd>
            </div>
          )}
          {plan && sub.amount > 0 && (
            <div>
              <dt className="text-xs font-medium text-neutral-500">Price</dt>
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
                  <span className="text-neutral-800">{addon.name}</span>
                  <span className="text-neutral-500">{addon.amount > 0 ? `${formatMoney(addon.amount, sub.currency)} / ${perCycle}` : "Included"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-neutral-900">Payment</h2>
          <p className="mt-1 text-xs text-neutral-500">Paid by card through Stripe. Invoices and receipts live in the billing portal.</p>
        </div>

        {!canManage ? (
          <p className="text-sm text-neutral-600">
            Only the gym&apos;s owner or an admin with Settings access can change billing.
          </p>
        ) : !sub.stripeConfigured ? (
          <p className="text-sm text-neutral-600">Online payment isn&apos;t set up yet — contact {contactLine(sub)}.</p>
        ) : sub.hasStripeSubscription ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-neutral-600">
              {sub.status === "past_due"
                ? "Your last payment did not go through. Update your card and Stripe will try again."
                : "Your card is on file. Change it, switch between monthly and yearly, or download invoices in the billing portal."}
            </p>
            <PrimaryButton onClick={manage} disabled={busy !== null}>
              {busy === "portal" ? "Opening…" : "Manage billing, card & invoices"}
            </PrimaryButton>
          </div>
        ) : !plan ? (
          <p className="text-sm text-neutral-600">This gym is not on a plan yet — contact {contactLine(sub)} to choose one.</p>
        ) : planIsFree ? (
          <p className="text-sm text-neutral-600">Your plan is free — there is nothing to pay.</p>
        ) : sub.status === "active" ? (
          <p className="text-sm text-neutral-600">
            GymPilot bills this gym directly. To pay by card instead, contact {contactLine(sub)}.
          </p>
        ) : (
          <div className="space-y-4">
            {hasYearly && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Billing cycle">
                {(["monthly", "yearly"] as const).map((c) => {
                  const active = cycle === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setCycle(c)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        active ? "border-neutral-900 ring-2 ring-neutral-900/10 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-neutral-900">{c === "yearly" ? "Yearly" : "Monthly"}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {priceFor(c)} / {c === "yearly" ? "year" : "month"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-neutral-600">
                {sub.status === "trialing"
                  ? // Stripe keeps a trial only with more than 48 hours of it left.
                    sub.daysLeft !== null && sub.daysLeft >= 3
                    ? `Add your card now and keep your trial: the first charge is on ${periodDate}.`
                    : "Your trial is ending — subscribe to keep everything running."
                  : sub.status === "past_due"
                  ? "Your payment is overdue. Subscribe now to keep your website, member app and admin running."
                  : "Subscribe to bring everything back exactly as you left it."}
                {!hasYearly && ` ${priceFor(cycle)} / ${cycle === "yearly" ? "year" : "month"}.`}
              </p>
              <PrimaryButton onClick={subscribe} disabled={busy !== null}>
                {busy === "checkout" ? "Opening checkout…" : "Subscribe"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
