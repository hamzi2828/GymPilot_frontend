"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import "@fortawesome/fontawesome-free/css/all.css";
import CheckoutForm from "./components/CheckoutForm";
import OrderSummary from "./components/OrderSummary";
import { isAuthenticated } from "../../../helper/helper";
import { packageService, type Package } from "../packages/services/packageService";
import { checkoutService, type CouponPreview, type PaymentMethodKey, type PaymentMethods } from "./services/checkoutService";

const CheckoutPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get("packageId");

  const [loading, setLoading] = useState(true);
  const [packageData, setPackageData] = useState<Package | null>(null);
  const [submitHandler, setSubmitHandler] = useState<(() => void) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Why the last attempt to pay did not go ahead, shown beside the Pay button.
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The package could not be loaded: said on the page, with a way back.
  const [loadError, setLoadError] = useState<string | null>(null);

  // How the member pays. Card is offered when the gym has Stripe set up, bank
  // transfer when it has an account on file; the first available one is
  // preselected.
  const [methods, setMethods] = useState<PaymentMethods | null>(null);
  // Set when the payment options could not be loaded, so the summary offers a
  // retry instead of saying "Loading…" forever with Pay disabled.
  const [methodsError, setMethodsError] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>("stripe");
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  // Whether the joining fee will be charged: only with a member's first
  // membership. null when it is not known (the summary then says so).
  const [joiningFeeDue, setJoiningFeeDue] = useState<boolean | null>(null);

  const retryMethods = async () => {
    setMethodsError(false);
    const available = await checkoutService.getPaymentMethods().catch(() => null);
    setMethods(available);
    setMethodsError(!available);
    if (available) setPaymentMethod(available.card ? "stripe" : "bank_transfer");
  };

  const handleSubmitChange = (handler: () => void, submitting: boolean) => {
    setSubmitHandler(() => handler);
    setIsSubmitting(submitting);
  };

  useEffect(() => {
    const initCheckout = async () => {
      if (!isAuthenticated()) {
        const redirectUrl = packageId ? `/checkout?packageId=${packageId}` : "/checkout";
        router.push(`/authentication?redirect=${encodeURIComponent(redirectUrl)}`);
        return;
      }

      try {
        const [packages, available, feeDue] = await Promise.all([
          packageId ? packageService.getActivePackages() : Promise.resolve([] as Package[]),
          checkoutService.getPaymentMethods().catch(() => null),
          checkoutService.getJoiningFeeDue().catch(() => null),
        ]);
        setJoiningFeeDue(feeDue);
        setMethods(available);
        setMethodsError(!available);
        if (available) setPaymentMethod(available.card ? "stripe" : "bank_transfer");

        if (packageId) {
          const selectedPackage = packages.find((p) => p._id === packageId);
          if (selectedPackage) {
            setPackageData(selectedPackage);
          } else {
            setLoadError("This package is no longer on sale. Choose another one from Packages.");
            return;
          }
        }
      } catch (error) {
        console.error("Error fetching package:", error);
        setLoadError("We could not load this package. Check your connection and try again.");
        return;
      } finally {
        setLoading(false);
      }
    };
    initCheckout();
  }, [router, packageId]);

  if (loading) {
    return (
      <main className="pt-24">
        <section className="px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20 bg-white">
          <div className="mx-auto">
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
                <span className="text-gray-600">Loading checkout...</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="pt-24">
        <section className="px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20 bg-white">
          <div role="alert" className="mx-auto max-w-xl rounded-2xl border-2 border-red-200 bg-red-50 p-8 text-center">
            <h1 className="text-lg font-bold text-gray-900">Checkout could not open</h1>
            <p className="mt-1 text-sm text-gray-700">{loadError} Nothing has been charged.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white">
                Try again
              </button>
              <Link href="/packages" className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Back to packages
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="pt-24">
      <section className="px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20 bg-white">
        <div className="mx-auto">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
            <Link href="/packages" className="hover:text-black">
              Packages
            </Link>
            <span className="mx-2 text-gray-400">/</span>
            <span className="text-black">Checkout</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <CheckoutForm
              packageData={packageData}
              onSubmitChange={handleSubmitChange}
              paymentMethod={paymentMethod}
              couponCode={coupon?.code}
              onError={setSubmitError}
            />
            <OrderSummary
              packageData={packageData}
              onSubmit={submitHandler || undefined}
              isSubmitting={isSubmitting}
              error={submitError}
              methods={methods}
              methodsError={methodsError}
              onRetryMethods={retryMethods}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              coupon={coupon}
              onCouponChange={setCoupon}
              joiningFeeDue={joiningFeeDue}
            />
          </div>
        </div>
      </section>
    </main>
  );
};

const CheckoutPage = () => {
  return (
    <Suspense
      fallback={
        <main className="pt-20">
          <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#91b200]"></div>
          </div>
        </main>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
};

export default CheckoutPage;
