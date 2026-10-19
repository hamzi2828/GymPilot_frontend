"use client";

// A member's payment link: /pay/<token>, sent before, on and after the day
// their membership falls due. No sign-in -- the link is the key, and it opens
// one order only. "Pay now" takes them to the gym's gateway (card, JazzCash,
// Easypaisa or any bank app); the gym's bank details are offered as well, for
// a transfer instead. The gateway sends them back here with ?done=1, and the
// page then asks until the payment is confirmed.

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import "@fortawesome/fontawesome-free/css/all.css";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";
import { useSiteSettings } from "@/components/ThemeProvider";
import type { BankAccount } from "../../checkout/services/checkoutService";
import { PayLinkError, assetUrl, getGymBanks, getPayLink, startPayLinkCheckout, type PayLink } from "../payService";

// After coming back from the gateway: ask every few seconds, for about a minute.
const POLL_EVERY_MS = 3000;
const POLL_TRIES = 20;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Failure = { kind: "invalid" | "expired" | "unreachable"; message: string };

function money(amount: number, currency: string) {
  const code = (currency || "").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code || "PKR", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${code} ${Number(amount || 0).toLocaleString()}`;
  }
}

/** A day the API sent, as the gym's calendar has it (a bare YYYY-MM-DD is that day). */
function dayLabel(value: string | null | undefined, timeZone: string) {
  if (!value) return "—";
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = bare ? new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "long", year: "numeric" };
  try {
    return date.toLocaleDateString(undefined, bare || !timeZone ? options : { ...options, timeZone });
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}

function lowerFirst(text: string) {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function failureOf(e: unknown): Failure {
  if (e instanceof PayLinkError && (e.status === 410 || e.code === "LINK_EXPIRED")) return { kind: "expired", message: e.message };
  if (e instanceof PayLinkError && (e.status === 400 || e.status === 404 || e.code === "LINK_INVALID")) return { kind: "invalid", message: e.message };
  return { kind: "unreachable", message: e instanceof Error && e.message ? e.message : "We could not load this payment." };
}

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6";
const secondaryBtn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60";

function PayContent() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(String(params?.token || ""));
  const searchParams = useSearchParams();
  const returned = searchParams.get("done") === "1";
  const { siteName, ianaTimezone } = useSiteSettings();

  const [link, setLink] = useState<PayLink | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  // Back from the gateway: asking until it is paid, then out of tries.
  const [confirming, setConfirming] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const pay = useAsyncAction();
  const recheck = useAsyncAction();
  const retry = useAsyncAction();
  // Which round of asking is the current one: leaving the page, or a newer
  // round, stops an older one quietly.
  const round = useRef(0);

  const load = useCallback(async (): Promise<PayLink | null> => {
    try {
      const data = await getPayLink(token);
      setLink(data);
      setFailure(null);
      return data;
    } catch (e) {
      const f = failureOf(e);
      setFailure(f);
      // An expired link may still say what it was for.
      if (e instanceof PayLinkError && e.data) setLink({ ...e.data, status: f.kind === "expired" ? "expired" : e.data.status });
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Asks until the payment shows as paid (or the link is closed), for about
  // a minute. A failed request is not an answer: it just asks again.
  const confirm = useCallback(async () => {
    const mine = ++round.current;
    setConfirming(true);
    setTimedOut(false);
    for (let attempt = 0; attempt < POLL_TRIES; attempt++) {
      if (attempt > 0) await wait(POLL_EVERY_MS);
      if (round.current !== mine) return;
      try {
        const data = await getPayLink(token);
        if (round.current !== mine) return;
        setLink(data);
        setFailure(null);
        if (data.status !== "due") {
          setConfirming(false);
          return;
        }
      } catch (e) {
        if (round.current !== mine) return;
        const f = failureOf(e);
        if (f.kind !== "unreachable") {
          setFailure(f);
          setConfirming(false);
          return;
        }
      }
    }
    if (round.current !== mine) return;
    setConfirming(false);
    setTimedOut(true);
  }, [token]);

  useEffect(() => {
    let gone = false;
    (async () => {
      const data = await load();
      if (!gone && returned && data && data.status === "due") confirm();
    })();
    getGymBanks()
      .then((list) => !gone && setBanks(list))
      .catch(() => !gone && setBanks([]));
    return () => {
      gone = true;
      round.current += 1;
    };
  }, [load, confirm, returned]);

  const startPaying = () =>
    pay.run(async () => {
      setPayError(null);
      try {
        const url = await startPayLinkCheckout(token, autoPay);
        // Off to the gateway: the button stays busy until the page has gone.
        pay.leave();
        window.location.href = url;
      } catch (e) {
        const f = failureOf(e);
        if (f.kind === "unreachable") setPayError(e instanceof Error ? e.message : "We could not start the payment. Please try again.");
        else await load();
      }
    });

  const gymName = link?.gym_name || siteName || "the gym";

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 pb-16 pt-28">
        <div className="mx-auto flex max-w-lg justify-center py-16" role="status">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 spinner-accent" />
          <span className="sr-only">Loading your payment…</span>
        </div>
      </main>
    );
  }

  // ---- A link that cannot be used, or no answer at all ----
  if (failure && (failure.kind !== "expired" || !link)) {
    const title =
      failure.kind === "invalid" ? "This payment link isn't valid" : failure.kind === "expired" ? "This payment link has expired" : "We couldn't load your payment";
    return (
      <main className="min-h-screen bg-gray-50 px-4 pb-16 pt-28">
        <div className={`mx-auto max-w-lg text-center ${card}`}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <i className="fas fa-link-slash text-2xl text-amber-600" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {failure.kind === "invalid"
              ? `It may have been cut short when it was copied. Open it again from the message ${gymName} sent you, or contact the gym.`
              : failure.kind === "expired"
              ? `Contact ${gymName} to renew your membership.`
              : failure.message}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {failure.kind === "unreachable" && (
              <button
                type="button"
                disabled={retry.busy}
                aria-busy={retry.busy || undefined}
                onClick={() => retry.run(load)}
                className="btn-accent inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {retry.busy && <Spinner />}
                Try again
              </button>
            )}
            <Link href="/contact-us" className={secondaryBtn}>
              Contact {gymName}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!link) return null;

  const first = (link.member_first_name || "").trim();
  const amount = money(link.amount, link.currency);
  const status = failure?.kind === "expired" ? "expired" : link.status;

  // ---- Paid, closed or expired: nothing to pay here ----
  if (status !== "due") {
    const paid = status === "paid";
    return (
      <main className="min-h-screen bg-gray-50 px-4 pb-16 pt-28">
        <div className={`mx-auto max-w-lg text-center ${card}`}>
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${paid ? "bg-green-100" : "bg-gray-100"}`}>
            <i className={`fas ${paid ? "fa-check text-green-600" : status === "expired" ? "fa-hourglass-end text-gray-500" : "fa-circle-info text-gray-500"} text-2xl`} aria-hidden="true" />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">{gymName}</p>
          <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
            {paid ? `Paid — thank you${first ? `, ${first}` : ""}!` : status === "expired" ? "This payment link has expired" : "Nothing to pay on this link"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {paid
              ? `Your ${link.package_name} membership is paid (${amount}). A receipt is on its way.`
              : status === "expired"
              ? `The last day to pay${link.last_day ? ` was ${dayLabel(link.last_day, ianaTimezone)}` : " has passed"}. Contact ${gymName} to renew your ${link.package_name} membership.`
              : `This payment is no longer needed: your ${link.package_name} membership was renewed another way, or ${gymName} closed it. Please do not pay for it.`}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {paid ? (
              <Link href="/user-detail?tab=history" className="btn-accent inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold">
                Go to my account
              </Link>
            ) : (
              <Link href="/contact-us" className="btn-accent inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold">
                Contact {gymName}
              </Link>
            )}
            <Link href="/" className={secondaryBtn}>
              {gymName} home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ---- Due ----
  const period = (link.period || "").trim().toLowerCase();
  const consentText = `I allow ${gymName} to charge my saved card for my membership (${Number(link.amount || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${(link.currency || "").toUpperCase()}${period ? ` every ${period}` : ""}) on each due date. I can turn this off anytime in my account.`;
  const showPay = !confirming && !timedOut;

  return (
    <main className="min-h-screen bg-gray-50 px-4 pb-16 pt-28">
      <div className="mx-auto max-w-lg space-y-5">
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{gymName}</p>
          <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
            {first ? `Hi ${first}, your` : "Your"} membership is due
          </h1>

          <dl className="mt-5 divide-y divide-gray-100 border-y border-gray-100 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
              <dt className="text-gray-500">Package</dt>
              <dd className="text-right font-semibold text-gray-900">{link.package_name}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
              <dt className="text-gray-500">Amount</dt>
              <dd className="text-right text-2xl font-bold text-gray-900">{amount}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
              <dt className="text-gray-500">Due date</dt>
              <dd className="text-right font-medium text-gray-900">{dayLabel(link.due_date, ianaTimezone)}</dd>
            </div>
            {link.last_day && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <dt className="text-gray-500">Last day to pay</dt>
                <dd className="text-right font-medium text-gray-900">{dayLabel(link.last_day, ianaTimezone)}</dd>
              </div>
            )}
          </dl>

          {confirming && (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-4" role="status">
              <div className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-b-2 spinner-accent" />
              <div className="text-sm">
                <p className="font-semibold text-gray-900">Confirming your payment…</p>
                <p className="mt-0.5 text-gray-600">This can take a few seconds. Please keep this page open and do not pay again.</p>
              </div>
            </div>
          )}

          {timedOut && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900" role="alert">
              <p className="font-semibold">We haven&apos;t had confirmation yet</p>
              <p className="mt-1">
                If you have just paid, it can take a minute to reach us, so please do not pay again. Check again in a moment; if it still isn&apos;t confirmed, contact {gymName} with
                your receipt.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={recheck.busy}
                  aria-busy={recheck.busy || undefined}
                  onClick={() => recheck.run(confirm)}
                  className="btn-accent inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {recheck.busy && <Spinner />}
                  Check again
                </button>
                <button type="button" onClick={() => setTimedOut(false)} className={secondaryBtn}>
                  I didn&apos;t finish paying
                </button>
              </div>
            </div>
          )}

          {showPay && (
            <>
              {link.auto_pay_available === true && (
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                  <input
                    type="checkbox"
                    checked={autoPay}
                    onChange={(e) => setAutoPay(e.target.checked)}
                    disabled={pay.busy}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">
                      Save my card and pay automatically {period ? (/^\d/.test(period) ? `every ${period}` : `each ${period}`) : "on each due date"}
                    </span>
                    <span className="mt-1 block text-xs text-gray-600">{consentText}</span>
                  </span>
                </label>
              )}

              {payError && (
                <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {payError}
                </p>
              )}

              <button
                type="button"
                onClick={startPaying}
                disabled={pay.busy}
                aria-busy={pay.busy || undefined}
                className="btn-accent mt-5 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl px-6 py-4 text-lg font-bold shadow-sm disabled:opacity-80"
              >
                {pay.busy ? <Spinner /> : <i className="fas fa-lock" aria-hidden="true" />}
                {pay.busy ? "Opening the payment page…" : `Pay ${amount} now`}
              </button>
              <p className="mt-3 text-center text-xs text-gray-500">
                {link.online_label ? `Pay by ${lowerFirst(link.online_label)}. ` : ""}You will be taken to a secure payment page. Card details are never stored by {gymName}.
              </p>
            </>
          )}
        </div>

        {/* ---- Paying by transfer instead ---- */}
        {showPay && banks.length > 0 && (
          <div className={card}>
            <h2 className="text-base font-bold text-gray-900">Or pay by bank transfer — no fee</h2>
            <p className="mt-1 text-sm text-gray-600">
              Send {amount} from any bank app to {banks.length === 1 ? "this account" : "one of these accounts"} (Raast works with the IBAN). Use{" "}
              {link.order_number ? <strong className="text-gray-900">{link.order_number}</strong> : "your full name"} as the reference, then send the receipt to {gymName} so they
              can confirm it.
            </p>
            <div className="mt-4 space-y-3">
              {banks.map((bank) => (
                <div key={bank._id} className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-bold text-gray-900">{bank.name}</p>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    <div className="flex flex-wrap justify-between gap-x-3">
                      <dt className="text-gray-500">Account title</dt>
                      <dd className="text-right font-medium text-gray-900">{bank.accountTitle}</dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3">
                      <dt className="text-gray-500">Account number</dt>
                      <dd className="break-all text-right font-mono font-medium text-gray-900">{bank.accountNumber}</dd>
                    </div>
                    {bank.iban && (
                      <div className="flex flex-wrap justify-between gap-x-3">
                        <dt className="text-gray-500">IBAN</dt>
                        <dd className="break-all text-right font-mono font-medium text-gray-900">{bank.iban}</dd>
                      </div>
                    )}
                    {bank.branch && (
                      <div className="flex flex-wrap justify-between gap-x-3">
                        <dt className="text-gray-500">Branch</dt>
                        <dd className="text-right text-gray-900">{bank.branch}</dd>
                      </div>
                    )}
                  </dl>
                  {bank.notes && <p className="mt-2 text-xs text-gray-500">{bank.notes}</p>}
                  {bank.qrCodeUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assetUrl(bank.qrCodeUrl)} alt={`${bank.name} payment QR code`} className="mt-3 h-36 w-36 rounded-lg border border-gray-200 object-contain" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 px-4 pb-16 pt-28">
          <div className="mx-auto flex max-w-lg justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 spinner-accent" />
          </div>
        </main>
      }
    >
      <PayContent />
    </Suspense>
  );
}
