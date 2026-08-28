"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@fortawesome/fontawesome-free/css/all.css";

export default function CheckoutCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* Cancel Header */}
          <div className="bg-yellow-50 px-6 py-8 text-center">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-yellow-100">
              <i className="fas fa-exclamation-triangle text-3xl text-yellow-600"></i>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">Payment Cancelled</h1>
            <p className="mt-2 text-gray-600">Your payment was cancelled and no charges were made</p>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">No worries!</h3>
              <p className="text-sm text-gray-600">
                You can browse our packages and subscribe anytime you&apos;re ready.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Why was your payment cancelled?</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-gray-400 mt-0.5 mr-2"></i>
                  <span>You clicked the cancel or back button during checkout</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-gray-400 mt-0.5 mr-2"></i>
                  <span>You closed the payment window</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-gray-400 mt-0.5 mr-2"></i>
                  <span>The payment session expired</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 space-y-3">
              <Link
                href="/packages"
                className="block w-full bg-blue-600 text-white text-center rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors"
              >
                <i className="fas fa-boxes mr-2"></i>
                View All Packages
              </Link>
              <button
                onClick={() => router.push("/")}
                className="w-full bg-gray-200 text-gray-800 text-center rounded-lg px-4 py-3 hover:bg-gray-300 transition-colors"
              >
                Return to Home
              </button>
            </div>

            {/* Help Section */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Need Help?</h4>
              <p className="text-sm text-gray-600 mb-3">
                If you&apos;re experiencing issues with payment, our support team is here to help.
              </p>
              <div className="space-y-2">
                <a
                  href="mailto:support@gymwear.com"
                  className="flex items-center text-sm text-blue-600 hover:underline"
                >
                  <i className="fas fa-envelope mr-2"></i>
                  support@gymwear.com
                </a>
                <a
                  href="tel:+1234567890"
                  className="flex items-center text-sm text-blue-600 hover:underline"
                >
                  <i className="fas fa-phone mr-2"></i>
                  +1 (234) 567-890
                </a>
              </div>
            </div>

            {/* Common Issues */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">Common Payment Issues:</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Ensure your card has sufficient funds</li>
                <li>• Check if your card is enabled for online transactions</li>
                <li>• Verify your billing address matches your card details</li>
                <li>• Try using a different browser or clearing cache</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            <i className="fas fa-lock mr-1"></i>
            Your payment information is secure and encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
