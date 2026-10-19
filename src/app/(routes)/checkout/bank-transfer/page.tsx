"use client";

// After choosing "bank transfer" at checkout: the amount, the gym's bank
// details, and a place to attach the receipt. Also reachable from the
// account page for an order still waiting on its transfer.

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isAuthenticated } from "../../../../helper/helper";
import { checkoutService, CheckoutRequestError, isOrderId, type BankAccount, type BankOrder } from "../services/checkoutService";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "USD").toUpperCase() }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount}`;
  }
}

function assetUrl(url?: string) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

// What a link to an order that is not there (a mistyped or someone else's
// `?order=`) is told, rather than the server's internals.
const ORDER_NOT_FOUND = "We could not find this order.";
const isNotFound = (e: unknown) => e instanceof CheckoutRequestError && (e.status === 404 || e.code === "ORDER_NOT_FOUND");

function BankTransferContent() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order");

  const [order, setOrder] = useState<BankOrder | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const { busy: sending, run } = useAsyncAction();
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) {
      setError("No order to show.");
      setLoading(false);
      return;
    }
    // Not an order id at all: no order to ask the server for.
    if (!isOrderId(orderId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      // The bank list failing leaves the order on screen; the page then says
      // to ask at reception for the details.
      const [o, b] = await Promise.all([checkoutService.getOrder(orderId), checkoutService.getBanks().catch(() => [] as BankAccount[])]);
      setOrder(o);
      setBanks(b);
      setReference(o.payment.proof?.reference || "");
    } catch (e) {
      if (isNotFound(e)) setNotFound(true);
      else setError(e instanceof Error ? e.message : "Could not load the order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push(`/authentication?redirect=${encodeURIComponent(`/checkout/bank-transfer?order=${orderId || ""}`)}`);
      return;
    }
    load();
  }, [load, router, orderId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    run(async () => {
      setError(null);
      try {
        const message = await checkoutService.submitTransferProof(order._id, { file, reference, note });
        setSent(message);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send the receipt");
        // 409: the order changed under the page -- cancelled, closed, or being
        // confirmed right now. Reloading shows it as it is.
        if (err instanceof CheckoutRequestError && err.status === 409) await load();
      }
    });
  };

  if (loading) {
    return (
      <main className="pt-24">
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-600" />
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="pt-24 px-4">
        <div className="mx-auto max-w-xl py-16 text-center">
          {notFound ? (
            <>
              <h1 className="text-2xl font-bold text-black">{ORDER_NOT_FOUND}</h1>
              <p className="mt-2 text-gray-600">Check the link you followed. Your orders are listed under My account.</p>
            </>
          ) : (
            <p className="text-red-600">{error || ORDER_NOT_FOUND}</p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/packages" className="btn-accent rounded-lg px-5 py-2.5 text-sm font-semibold">
              Back to packages
            </Link>
            {notFound && (
              <Link href="/user-detail?tab=history" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Go to my account
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  // The order's own status, not only its payment's: an order the gym (or the
  // member) cancelled still has a payment waiting, and used to offer the
  // receipt form for it.
  const cancelled = order.status === "cancelled" || order.payment.status === "cancelled";
  const refunded = !cancelled && order.payment.status === "refunded";
  // Closed: nothing to pay into and nothing to send.
  const closed = cancelled || refunded;
  const paid = !closed && order.payment.status === "paid";
  const awaiting = !closed && order.payment.status === "processing";
  const rejected = !closed && order.payment.status === "failed";
  // Paid for, then cancelled: a membership that has ended, not an unpaid order.
  const cancelledAfterPaying = cancelled && order.payment.status === "paid";

  return (
    <main className="pt-24">
      <section className="px-4 sm:px-6 lg:px-20 py-12 bg-white">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
            <Link href="/packages" className="hover:text-black">Packages</Link>
            <span className="mx-2 text-gray-400">/</span>
            <span className="text-black">Bank transfer</span>
          </nav>

          <h1 className="text-2xl font-bold text-black">
            {cancelled
              ? cancelledAfterPaying
                ? "This membership was cancelled"
                : "This order was cancelled"
              : refunded
              ? "This payment was refunded"
              : paid
              ? "Payment confirmed"
              : awaiting
              ? "Receipt received"
              : rejected
              ? "Payment not confirmed"
              : "Pay by bank transfer"}
          </h1>
          <p className="mt-2 text-gray-600">
            {cancelled
              ? cancelledAfterPaying
                ? "Its details stay under My account. Choose a package to start a new membership."
                : "There is nothing to pay or send for it. Please do not transfer money for this order. Choose a package to start a new one."
              : refunded
              ? "The money for this order was sent back, so there is nothing to pay or send. Choose a package to start a new order."
              : paid
              ? `Your ${order.packageDetails.name} membership is active.`
              : awaiting
              ? "We have your transfer details. Staff will confirm the payment shortly and your membership starts the moment they do."
              : rejected
              ? `Payment not accepted${
                  order.payment.proof?.rejectionReason?.trim() ? `: ${order.payment.proof.rejectionReason.trim().replace(/[.\s]+$/, "")}` : ""
                }. Please contact the gym, or choose the package again and upload a new receipt.`
              : "Send the amount below to one of our accounts, then attach the receipt so we can confirm it quickly."}
          </p>

          <div className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Order</p>
                <p className="text-lg font-bold text-black">{order.orderNumber}</p>
                <p className="text-sm text-gray-600">{order.packageDetails.name} · {order.packageDetails.period}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Amount to send</p>
                <p className={`text-3xl font-bold ${closed ? "text-gray-400 line-through" : ""}`} style={closed ? undefined : { color: "var(--accent-dark, #c74e1b)" }}>
                  {money(order.payment.amount, order.payment.currency)}
                </p>
                {(order.payment.discountAmount || 0) > 0 && <p className="text-xs text-green-700">includes {order.payment.couponCode} discount</p>}
              </div>
            </div>
            {!closed && (
              <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
                Use <strong>{order.orderNumber}</strong> as the payment reference so we can match it to you.
              </p>
            )}
          </div>

          {!paid && !closed && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {banks.map((bank) => (
                <div key={bank._id} className="rounded-2xl border-2 border-gray-200 bg-white p-5">
                  <p className="text-base font-bold text-black">{bank.name}</p>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Account title</dt><dd className="font-medium text-black text-right">{bank.accountTitle}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Account number</dt><dd className="font-mono font-medium text-black text-right">{bank.accountNumber}</dd></div>
                    {bank.iban && <div className="flex justify-between gap-3"><dt className="text-gray-500">IBAN</dt><dd className="font-mono font-medium text-black text-right break-all">{bank.iban}</dd></div>}
                    {bank.branch && <div className="flex justify-between gap-3"><dt className="text-gray-500">Branch</dt><dd className="text-black text-right">{bank.branch}</dd></div>}
                  </dl>
                  {bank.notes && <p className="mt-2 text-xs text-gray-500">{bank.notes}</p>}
                  {bank.qrCodeUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assetUrl(bank.qrCodeUrl)} alt={`${bank.name} QR code`} className="mt-3 h-36 w-36 rounded-lg border border-gray-200 object-contain" />
                  )}
                </div>
              ))}
              {!banks.length && <p className="text-sm text-gray-500">Bank details are not available right now — please ask at reception.</p>}
            </div>
          )}

          {!paid && !rejected && !closed && (
            <form onSubmit={submit} className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-6 space-y-4">
              <h2 className="text-lg font-bold text-black">{awaiting ? "Update your receipt" : "Attach your receipt"}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700">Receipt or screenshot (photo or PDF)</label>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
                {order.payment.proof?.url && !file && (
                  <a href={assetUrl(order.payment.proof.url)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline text-gray-600">
                    View the receipt you sent
                  </a>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Transfer reference / transaction ID</label>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
                  <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Sent from my brother's account…" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {sent && <p className="text-sm text-green-700">{sent}</p>}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={sending || (!file && !reference.trim())}
                  aria-busy={sending || undefined}
                  className="btn-accent inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {sending && <Spinner />}
                  {sending ? "Sending…" : awaiting ? "Update receipt" : "Send receipt"}
                </button>
                <Link href="/user-detail?tab=history" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  I&apos;ll do this later
                </Link>
              </div>
            </form>
          )}

          {closed && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/packages" className="btn-accent rounded-lg px-5 py-2.5 text-sm font-semibold">
                Back to packages
              </Link>
              <Link href="/user-detail?tab=history" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Go to my account
              </Link>
            </div>
          )}

          {(paid || rejected) && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/user-detail?tab=history" className="btn-accent rounded-lg px-5 py-2.5 text-sm font-semibold">
                Go to my account
              </Link>
              {rejected && (
                <Link href="/packages" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Choose the package again
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function BankTransferPage() {
  return (
    <Suspense
      fallback={
        <main className="pt-24">
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-600" />
          </div>
        </main>
      }
    >
      <BankTransferContent />
    </Suspense>
  );
}
