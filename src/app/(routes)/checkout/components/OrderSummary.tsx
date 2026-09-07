"use client";

import React, { useState } from "react";
import Image from "next/image";
import { type Package } from "../../packages/services/packageService";
import { checkoutService, type CouponPreview, type PaymentMethodKey, type PaymentMethods } from "../services/checkoutService";

interface OrderSummaryProps {
  packageData?: Package | null;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  methods: PaymentMethods | null;
  paymentMethod: PaymentMethodKey;
  onPaymentMethodChange: (method: PaymentMethodKey) => void;
  coupon: CouponPreview | null;
  onCouponChange: (coupon: CouponPreview | null) => void;
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function billingLine(pkg: Package) {
  const b = pkg.billing;
  if (b && b.mode === "recurring") {
    const every = b.intervalCount > 1 ? `every ${b.intervalCount} ${b.interval}s` : `per ${b.interval}`;
    return `${every}, renews automatically${b.trialDays ? ` · ${b.trialDays}-day free trial` : ""}`;
  }
  if (pkg.kind === "session_pack" || pkg.kind === "pt_pack") return `${pkg.sessions || 0} sessions`;
  if (pkg.durationDays) return `valid ${pkg.durationDays} days`;
  return pkg.period;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  packageData,
  onSubmit,
  isSubmitting = false,
  methods,
  paymentMethod,
  onPaymentMethodChange,
  coupon,
  onCouponChange,
}) => {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  if (!packageData) {
    return (
      <div className="lg:pl-8">
        <div className="sticky top-24 bg-white rounded-lg shadow-sm p-6">
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">No package selected</div>
            <a href="/packages" className="text-accent">
              Browse packages
            </a>
          </div>
        </div>
      </div>
    );
  }

  const currency = packageData.currency;
  const listPrice = parseFloat(packageData.price.replace(/[^\d.]/g, "")) || 0;
  const joiningFee = Number(packageData.joiningFee || 0);
  const discount = coupon ? coupon.discount : 0;
  const total = Math.max(0, listPrice + joiningFee - discount);
  const recurring = packageData.billing?.mode === "recurring";

  const applyCoupon = async () => {
    if (!code.trim()) return;
    setChecking(true);
    setCouponError(null);
    try {
      const preview = await checkoutService.validateCoupon(code.trim(), packageData._id);
      onCouponChange(preview);
    } catch (e) {
      onCouponChange(null);
      setCouponError(e instanceof Error ? e.message : "That code is not valid");
    } finally {
      setChecking(false);
    }
  };

  const noMethods = methods && !methods.card && !methods.bankTransfer;
  const canPay = !noMethods && (paymentMethod === "stripe" ? !!methods?.card : !!methods?.bankTransfer);

  const MethodOption = ({ value, title, hint, disabled, right }: { value: PaymentMethodKey; title: string; hint: string; disabled?: boolean; right?: React.ReactNode }) => {
    const active = paymentMethod === value;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPaymentMethodChange(value)}
        className={`w-full text-left rounded-lg border p-4 transition-colors ${active ? "border-accent bg-gray-50" : "border-gray-300 bg-white hover:border-gray-400"} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="flex items-center mt-1">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? "border-accent bg-accent-solid" : "border-gray-300"}`}>
                {active && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
            <div>
              <p className="checkout-label font-medium">{title}</p>
              <p className="checkout-input text-sm text-gray-600">{hint}</p>
            </div>
          </div>
          {right}
        </div>
      </button>
    );
  };

  return (
    <div className="lg:pl-8">
      <div className="sticky top-24 bg-white rounded-lg shadow-sm p-6 space-y-8">
        {/* Package */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="checkout-product-title font-semibold text-lg">{packageData.name} Package</h3>
              <p className="text-sm text-gray-600 mt-1">{billingLine(packageData)}</p>
            </div>
            <div className="checkout-shipping-price font-bold text-lg">
              {currency} {packageData.price}
            </div>
          </div>
          {packageData.features && packageData.features.length > 0 && (
            <div className="border-t pt-3 mt-4">
              <ul className="space-y-1">
                {packageData.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="text-sm text-gray-600 flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    {feature}
                  </li>
                ))}
                {packageData.features.length > 3 && <li className="text-sm text-gray-500 italic">+{packageData.features.length - 3} more features</li>}
              </ul>
            </div>
          )}
        </div>

        {/* Coupon */}
        <div>
          <label className="checkout-label block font-medium mb-2">Discount code</label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter a code"
              className="checkout-input flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm"
            />
            <button type="button" onClick={applyCoupon} disabled={checking || !code.trim()} className="rounded-lg border border-gray-300 px-4 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
              {checking ? "Checking…" : "Apply"}
            </button>
          </div>
          {coupon && (
            <p className="mt-2 text-sm text-green-700">
              <i className="fas fa-check-circle mr-1" /> {coupon.code} applied — {coupon.type === "percent" ? `${coupon.value}% off` : `${money(coupon.discount, currency)} off`}
              {recurring && (coupon.appliesToRenewals ? " every renewal" : " your first payment")}.{" "}
              <button type="button" className="underline" onClick={() => { onCouponChange(null); setCode(""); }}>
                Remove
              </button>
            </p>
          )}
          {couponError && <p className="mt-2 text-sm text-red-600">{couponError}</p>}
        </div>

        {/* Totals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="checkout-subtotal-label text-gray-600">Package price</span>
            <span className="checkout-shipping-price font-medium">{money(listPrice, currency)}</span>
          </div>
          {joiningFee > 0 && (
            <div className="flex items-center justify-between">
              <span className="checkout-subtotal-label text-gray-600">Joining fee (one-off)</span>
              <span className="font-medium">{money(joiningFee, currency)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex items-center justify-between text-green-700">
              <span>Discount ({coupon?.code})</span>
              <span className="font-medium">−{money(discount, currency)}</span>
            </div>
          )}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="checkout-total-label font-bold text-lg">{recurring ? "Due today" : "Total"}</span>
              <span className="checkout-total-price font-bold text-lg">{money(total, currency)}</span>
            </div>
            {recurring && (
              <p className="mt-1 text-xs text-gray-500">
                Then {money(listPrice - (coupon?.appliesToRenewals ? discount : 0), currency)} {packageData.billing && packageData.billing.intervalCount > 1 ? `every ${packageData.billing.intervalCount} ${packageData.billing.interval}s` : `per ${packageData.billing?.interval}`}. Cancel any time from your account.
              </p>
            )}
          </div>
        </div>

        {/* Payment method */}
        <div className="pt-2 space-y-3">
          <h3 className="checkout-section-title text-lg font-bold">Payment</h3>
          {!methods ? (
            <p className="text-sm text-gray-500">Loading payment options…</p>
          ) : noMethods ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Online payment is not set up yet. Please pay at reception and we will activate your membership on the spot.
            </div>
          ) : (
            <>
              {methods.card && (
                <MethodOption
                  value="stripe"
                  title="Pay by card"
                  hint={recurring ? "Securely via Stripe. Your card renews the membership automatically." : "Securely via Stripe Checkout"}
                  right={
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-6 relative">
                        <Image src="/images/MasterCard.svg" alt="Mastercard" fill style={{ objectFit: "contain" }} />
                      </div>
                      <div className="w-8 h-3 relative">
                        <Image src="/images/Visa.svg" alt="Visa" fill style={{ objectFit: "contain" }} />
                      </div>
                    </div>
                  }
                />
              )}
              {methods.bankTransfer && (
                <MethodOption
                  value="bank_transfer"
                  title="Bank transfer"
                  hint={recurring ? "Pay one term now by transfer; staff confirm it once the money arrives." : "We show you the bank details; staff confirm once the money arrives."}
                />
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !canPay}
          className="checkout-green-bg w-full px-6 py-3 rounded-lg flex items-center justify-center space-x-2 text-black font-semibold hover:opacity-90 transition-opacity duration-200 bg-green-400 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={paymentMethod === "stripe" ? "Pay now" : "Continue to bank details"}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
              <span className="font-semibold">Processing...</span>
            </>
          ) : (
            <>
              <i className={`fas ${paymentMethod === "stripe" ? "fa-lock" : "fa-university"}`} />
              <span>{paymentMethod === "stripe" ? `Pay ${money(total, currency)}` : "Continue to bank details"}</span>
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center">
          {paymentMethod === "stripe" ? "You will be redirected to Stripe to complete your payment. Card details are never stored on our servers." : "Your membership starts as soon as the transfer is confirmed."}
        </p>
      </div>
    </div>
  );
};

export default OrderSummary;
