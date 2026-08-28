"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { checkoutService } from "../services/checkoutService";
import "@fortawesome/fontawesome-free/css/all.css";

interface OrderDetails {
  orderNumber?: string;
  packageId?: string;
  customerId?: string;
  amount?: number;
  currency?: string;
  status?: string;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const [verificationStatus, setVerificationStatus] = useState<"loading" | "success" | "error">("loading");
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);

  const sessionId = searchParams.get("session_id");

  const verifyPayment = useCallback(async () => {
    try {
      const result = await checkoutService.verifyPayment(sessionId!);

      if (result.success && result.paid) {
        setVerificationStatus("success");
        setOrderDetails(result.order);
      } else {
        setVerificationStatus("error");
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
      setVerificationStatus("error");
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    } else {
      setVerificationStatus("error");
    }
  }, [sessionId, verifyPayment]);

  if (verificationStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (verificationStatus === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100">
              <i className="fas fa-times text-3xl text-red-600"></i>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Payment Verification Failed</h2>
            <p className="mt-2 text-gray-600">
              We couldn&apos;t verify your payment. Please contact support if you believe this is an error.
            </p>
            <div className="mt-6 space-y-3">
              <Link
                href="/packages"
                className="block w-full bg-blue-600 text-white rounded-lg px-4 py-3 text-center hover:bg-blue-700 transition-colors"
              >
                View Packages
              </Link>
              <Link
                href="/"
                className="block w-full bg-gray-200 text-gray-800 rounded-lg px-4 py-3 text-center hover:bg-gray-300 transition-colors"
              >
                Return to Home
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
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">What happens next?</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• You will receive a confirmation email shortly</li>
                <li>• Your subscription is now active</li>
                <li>• You can access all the features included in your package</li>
                <li>• Our team will contact you to schedule your sessions</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/packages"
                className="flex-1 bg-blue-600 text-white text-center rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors"
              >
                View All Packages
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
            Need help? Contact our support team at{" "}
            <a href="mailto:support@gymwear.com" className="text-blue-600 hover:underline">
              support@gymwear.com
            </a>
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
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
