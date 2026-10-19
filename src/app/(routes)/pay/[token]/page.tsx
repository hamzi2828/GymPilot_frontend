"use client";

// A member's payment link: /pay/<token>, sent before, on and after the day
// their membership falls due. No sign-in -- the link is the key, and it opens
// one order only.
//
// Two ways to pay. Online: "Pay now" takes them to the gym's gateway (card,
// JazzCash, Easypaisa or any bank app), which sends them back here with
// ?done=1, and the page asks until the payment is confirmed. By bank
// transfer: the gym's accounts and QR codes, then a screenshot of the
// receipt uploaded here for the gym's staff to check. A gym on the "generic"
// gateway has only the second; any other gym with bank accounts offers both.

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import "@fortawesome/fontawesome-free/css/all.css";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";
import { useSiteSettings } from "@/components/ThemeProvider";
import {
  PayLinkError,
  assetUrl,
  getGymBanks,
  getPayLink,
  startPayLinkCheckout,
  uploadPayLinkProof,
  type PayLink,
  type PayLinkBank,
} from "../payService";

// After coming back from the gateway: ask every few seconds, for about a minute.
const POLL_EVERY_MS = 3000;
const POLL_TRIES = 20;
// The API's own cap on a receipt (Vercel refuses bodies over 4.5 MB first).
const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const RECEIPT_TYPES = "image/jpeg,image/png,image/webp,application/pdf,.pdf";

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

/** A refusal that means the link or its order has moved on: read it again rather than show the error. */
function linkMovedOn(e: unknown) {
  return e instanceof PayLinkError && (e.status === 409 || e.status === 410 || e.code === "LINK_INVALID" || e.code === "LINK_EXPIRED");
}

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6";
const secondaryBtn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60";

/** A number to copy into a bank app. */
function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // No clipboard here: the number is on screen to select by hand.
      setFailed(true);
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="break-all font-mono text-sm font-semibold text-gray-900">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      >
        {copied ? "Copied" : failed ? "Select it" : "Copy"}
      </button>
    </div>
  );
}

function BankCard({ bank }: { bank: PayLinkBank }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-base font-bold text-gray-900">{bank.bank_name}</p>
      {bank.qr_code_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetUrl(bank.qr_code_url)}
          alt={`${bank.bank_name} payment QR code`}
          className="mx-auto my-4 block aspect-square w-full max-w-[260px] rounded-xl border border-gray-200 bg-white object-contain p-2"
        />
      )}
      <div className="divide-y divide-gray-100">
        {bank.account_title && (
          <div className="py-2">
            <p className="text-xs text-gray-500">Account title</p>
            <p className="text-sm font-semibold text-gray-900">{bank.account_title}</p>
          </div>
        )}
        {bank.account_number && <CopyValue label="Account number" value={bank.account_number} />}
        {bank.iban && <CopyValue label="IBAN" value={bank.iban} />}
        {bank.branch && (
          <div className="py-2">
            <p className="text-xs text-gray-500">Branch</p>
            <p className="text-sm text-gray-900">{bank.branch}</p>
          </div>
        )}
      </div>
      {bank.notes && <p className="mt-2 text-xs text-gray-500">{bank.notes}</p>}
    </div>
  );
}

function PayContent() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(String(params?.token || ""));
  const searchParams = useSearchParams();
  const returned = searchParams.get("done") === "1";
  const { siteName, ianaTimezone } = useSiteSettings();

  const [link, setLink] = useState<PayLink | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);
  // Only for an older API, whose link does not list the accounts itself.
  const [publicBanks, setPublicBanks] = useState<PayLinkBank[]>([]);
  // Back from the gateway: asking until it is paid, then out of tries.
  const [confirming, setConfirming] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pay = useAsyncAction();
  const uploader = useAsyncAction();
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
      if (gone || !data) return;
      if (returned && data.status === "due") confirm();
      if (!Array.isArray(data.banks)) {
        getGymBanks()
          .then((list) => !gone && setPublicBanks(list))
          .catch(() => !gone && setPublicBanks([]));
      }
    })();
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
        if (linkMovedOn(e)) await load();
        else setPayError(e instanceof Error && e.message ? e.message : "We could not start the payment. Please try again.");
      }
    });

  const sendReceipt = (file: File) =>
    uploader.run(async () => {
      setUploadError(null);
      if (file.size > MAX_RECEIPT_BYTES) {
        setUploadError("That file is too large. Upload a photo or PDF under 4 MB.");
        return;
      }
      try {
        const proof = await uploadPayLinkProof(token, file);
        if (proof) setLink((l) => (l ? { ...l, proof } : l));
        await load();
      } catch (e) {
        if (linkMovedOn(e)) await load();
        else setUploadError(e instanceof Error && e.message ? e.message : "We could not send your receipt. Please try again.");
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
  const proof = link.proof?.status || "none";
  const status = failure?.kind === "expired" ? "expired" : proof === "approved" ? "paid" : link.status;

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
  // Online through a gateway, unless the gym has none or only takes
  // transfers ("generic"). An older API names no provider: it has one.
  const online = link.provider === undefined ? true : !!link.provider && link.provider !== "generic" && link.provider !== "none";
  const banks = Array.isArray(link.banks) ? link.banks : publicBanks;
  const receiptSent = proof === "submitted";
  const period = (link.period || "").trim().toLowerCase();
  const consentText = `I allow ${gymName} to charge my saved card for my membership (${Number(link.amount || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${(link.currency || "").toUpperCase()}${period ? ` every ${period}` : ""}) on each due date. I can turn this off anytime in my account.`;
  // While a gateway payment is being confirmed, or a receipt is with the
  // gym, nothing else is offered: either may already have paid.
  const busyElsewhere = confirming || timedOut || receiptSent;
  const showPay = online && !busyElsewhere;
  const showTransfer = !busyElsewhere && (banks.length > 0 || !online);

  const uploadButton = (label: string, primary: boolean) => (
    <label
      aria-busy={uploader.busy || undefined}
      className={`relative inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold aria-busy:cursor-wait ${
        primary ? "btn-accent" : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
      }`}
    >
      {uploader.busy ? <Spinner /> : <i className="fas fa-upload" aria-hidden="true" />}
      {uploader.busy ? "Sending your receipt…" : label}
      <input
        type="file"
        accept={RECEIPT_TYPES}
        className="sr-only"
        disabled={uploader.busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) sendReceipt(file);
        }}
      />
    </label>
  );

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
              <dt className="text-gray-500">Membership expires</dt>
              <dd className="text-right font-medium text-gray-900">{dayLabel(link.due_date, ianaTimezone)}</dd>
            </div>
            {link.last_day && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <dt className="text-gray-500">Last day to pay</dt>
                <dd className="text-right font-medium text-gray-900">{dayLabel(link.last_day, ianaTimezone)}</dd>
              </div>
            )}
          </dl>

          {receiptSent && !confirming && !timedOut && (
            <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900" role="status">
              <p className="font-semibold">Receipt received — {gymName} will check it and confirm.</p>
              <p className="mt-1">
                {link.proof?.submitted_at ? `Sent ${dayLabel(link.proof.submitted_at, ianaTimezone)}. ` : ""}Your membership is renewed as soon as they do, and a receipt is emailed to you.
                Please do not pay again.
              </p>
              <div className="mt-4">{uploadButton("Send a different receipt", false)}</div>
              {uploadError && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {uploadError}
                </p>
              )}
            </div>
          )}

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
                disabled={pay.busy || uploader.busy}
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

        {/* ---- Bank transfer, and the receipt ---- */}
        {showTransfer && (
          <div className={card}>
            <h2 className="text-base font-bold text-gray-900">{online ? "Or pay by bank transfer (no fee)" : "Pay by bank transfer"}</h2>

            {proof === "rejected" && (
              <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <strong>Rejected{link.proof?.reason ? `: ${link.proof.reason.trim().replace(/[.\s]+$/, "")}` : ""}</strong> — upload a new receipt.
              </p>
            )}

            {banks.length > 0 ? (
              <>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-600">
                  <li>
                    Send <strong className="text-gray-900">{amount}</strong> from any bank app to {banks.length === 1 ? "this account" : "one of these accounts"}: scan the QR code, or
                    copy the account number or IBAN.
                  </li>
                  <li>Take a screenshot of the receipt and upload it below. {gymName} checks it and confirms your membership.</li>
                </ol>
                <div className="mt-4 space-y-3">
                  {banks.map((bank) => (
                    <BankCard key={bank.id || bank.account_number} bank={bank} />
                  ))}
                </div>
                <div className="mt-5">{uploadButton("I've paid — upload the screenshot", !online)}</div>
                <p className="mt-2 text-center text-xs text-gray-500">A photo (JPG, PNG or WebP) or a PDF, up to 4 MB.</p>
                {uploadError && (
                  <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {uploadError}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                Bank details are not available right now. Please{" "}
                <Link href="/contact-us" className="font-semibold underline">
                  contact {gymName}
                </Link>{" "}
                to pay.
              </p>
            )}
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
