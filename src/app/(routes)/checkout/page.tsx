"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import "@fortawesome/fontawesome-free/css/all.css";
import CheckoutForm, { type OrderData } from "./components/CheckoutForm";
import OrderSummary from "./components/OrderSummary";
import { isAuthenticated } from "../../../helper/helper";
import { packageService, type Package } from "../packages/services/packageService";

const CheckoutPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get('packageId');

  const [loading, setLoading] = useState(true);
  const [packageData, setPackageData] = useState<Package | null>(null);
  const [submitHandler, setSubmitHandler] = useState<(() => void) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitChange = (handler: () => void, submitting: boolean) => {
    setSubmitHandler(() => handler);
    setIsSubmitting(submitting);
  };

  useEffect(() => {
    const initCheckout = async () => {
      // Check if user is authenticated
      if (!isAuthenticated()) {
        alert('Please login to continue with checkout');
        const redirectUrl = packageId ? `/checkout?packageId=${packageId}` : '/checkout';
        router.push(`/authentication?redirect=${redirectUrl}`);
        return;
      }

      // If packageId is present, fetch package details
      if (packageId) {
        try {
          const packages = await packageService.getActivePackages();
          const selectedPackage = packages.find(p => p._id === packageId);

          if (selectedPackage) {
            setPackageData(selectedPackage);
          } else {
            alert('Package not found');
            router.push('/packages');
            return;
          }
        } catch (error) {
          console.error('Error fetching package:', error);
          alert('Failed to load package details');
          router.push('/packages');
          return;
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    initCheckout();
  }, [router, packageId]);

  const handleOrderCreate = (orderData: OrderData) => {
    console.log('Order created:', orderData);
  };

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

  return (
    <main className="pt-24">
      <section className="px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20 bg-white">
        <div className="mx-auto">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
            <Link href={packageId ? "/packages" : "/cart"} className="hover:text-black">
              {packageId ? "Packages" : "Cart"}
            </Link>
            <span className="mx-2 text-gray-400">/</span>
            <span className="text-black">Checkout</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <CheckoutForm
              onOrderCreate={handleOrderCreate}
              packageData={packageData}
              onSubmitChange={handleSubmitChange}
            />
            <OrderSummary
              packageData={packageData}
              onSubmit={submitHandler || undefined}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </section>
    </main>
  );
};

const CheckoutPage = () => {
  return (
    <Suspense fallback={
      <main className="pt-20">
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#91b200]"></div>
        </div>
      </main>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
};

export default CheckoutPage;
