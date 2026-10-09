"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { checkoutService, type VerifiedOrder } from "../services/checkoutService";
import "@fortawesome/fontawesome-free/css/all.css";

// Where the member lands after paying at Stripe. The payment has already
// happened by the time this page opens; all it does is ask the API to confirm
// it. So a check that fails is not a payment that failed, and the page must
// never say so: it tries again by itself, and if it still has no answer it
// says exactly that, with a way to check again and where to look.

// How long to wait before each further try, after the first.
const RETRY_WAITS_MS = [1500, 3000, 5000];

type Status =
  | "checking"
  | "paid"
  // The API answered, and Stripe has not taken the money (yet).
  | "unpaid"
  // No proper answer after every try: offline, or the server is having trouble.
  | "unknown"
  // Opened without a payment to look up.
  | "missing";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<Status>(sessionId ? "checking" : "missing");
  const [orderDetails, setOrderDetails] = useState<VerifiedOrder | null>(null);
  // Which check is the current one: a newer check (or leaving the page) makes
  // an older one stop quietly instead of overwriting the newer answer.
  const run = useRef(0);

  const check = useCallback(async () => {
    if (!sessionId) {
      setStatus("missing");
      return;
    }
    const mine = ++run.current;
    setStatus("checking");

    let answered = false;
    for (let attempt = 0; attempt <= RETRY_WAITS_MS.length; attempt++) {
      if (attempt > 0) await wait(RETRY_WAITS_MS[attempt - 1]);
      if (run.current !== mine) return;
      try {
        const result = await checkoutService.verifyPayment(sessionId);
        if (run.current !== mine) return;
        answered = true;
        if (result.paid) {
          setOrderDetails(result.order);
          setStatus("paid");
          return;
        }
      } catch (error) {
        if (run.current !== mine) return;
        console.error("Error verifying payment:", error);
      }
    }
    setStatus(answered ? "unpaid" : "unknown");
  }, [sessionId]);

  useEffect(() => {
    check();
    return () => {
      run.current += 1;
    };
  }, [check]);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-4" role="status">
          <div className="animate-spin rounded-full h-16 w-16 spinner-accent border-b-2 mx-auto"></div>
          <p className="mt-4 text-gray-600">Confirming your payment…</p>
          <p className="mt-1 text-sm text-gray-500">This can take a few seconds. Please keep this page open.</p>
        </div>
      </div>
    );
  }

  if (status !== "paid") {
    const heading =
      status === "unknown"
        ? "We could not confirm your payment yet"
        : status === "unpaid"
        ? "Your payment has not arrived yet"
        : "No payment to show";
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-amber-100">
              <i className="fas fa-hourglass-half text-3xl text-amber-600"></i>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">{heading}</h2>
            {status === "unknown" && (
              <p className="mt-2 text-gray-600">
                We had trouble reaching our server. This is not a problem with your payment, which may well have gone through.
              </p>
            )}
            {status === "unpaid" && (
              <p className="mt-2 text-gray-600">
                If you have just paid, it can take a minute to reach us.
              </p>
            )}
            {status === "missing" && (
              <p className="mt-2 text-gray-600">
                This page opens after a card payment. If you have paid, your membership is under My account.
              </p>
            )}
            {status !== "missing" && (
              <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
                <p className="font-semibold">Please do not pay again.</p>
                <p className="mt-1">
                  Check again in a moment. Once the payment is confirmed, your membership shows under My account → History and a receipt is emailed to you. If it is still missing after a few minutes, contact us and we will sort it out.
                </p>
              </div>
            )}
            <div className="mt-6 space-y-3">
              {status !== "missing" && (
                <button type="button" onClick={check} className="block w-full btn-accent rounded-lg px-4 py-3 text-center">
                  Check again
                </button>
              )}
              <Link
                href="/user-detail?tab=history"
                className={`block w-full rounded-lg px-4 py-3 text-center ${status === "missing" ? "btn-accent" : "bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"}`}
              >
                Go to My account
              </Link>
              <Link
                href="/contact-us"
                className="block w-full bg-gray-200 text-gray-800 rounded-lg px-4 py-3 text-center hover:bg-gray-300 transition-colors"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* Success Header */}
          <div className="bg-green-50 px-6 py-8 text-center">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100">
              <i className="fas fa-check text-3xl text-green-600"></i>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">Payment Successful!</h1>
            <p className="mt-2 text-gray-600">Thank you for your purchase</p>
          </div>

          {/* Order Details */}
          <div className="px-6 py-8">
            <div className="border-b pb-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription Information</h2>
              <div className="space-y-3">
                {orderDetails && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Number:</span>
                      <span className="font-medium text-gray-900">{orderDetails.orderNumber || 'Pending'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium text-gray-900">
                        {new Date().toLocaleDateString()}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Status:</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Completed
                  </span>
                </div>
              </div>
            </div>

            {/* What's Next */}
            <div className="bg-accent-soft rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">What happens next?</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• A confirmation email with your receipt is on its way</li>
                <li>• Your start and end dates are in your account — a renewal bought early starts when your current term ends</li>
                <li>• Book classes and manage your membership from your account, or sign in to the member app with the same email or username</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/user-detail?tab=history"
                className="flex-1 btn-accent text-center rounded-lg px-4 py-3"
              >
                My account
              </Link>
              <Link
                href="/"
                className="flex-1 bg-gray-200 text-gray-800 text-center rounded-lg px-4 py-3 hover:bg-gray-300 transition-colors"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-6 text-center text-gray-600">
          <p>
            Need help with your membership?{" "}
            <Link href="/contact-us" className="text-accent hover:underline">
              Get in touch
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 spinner-accent border-b-2 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
