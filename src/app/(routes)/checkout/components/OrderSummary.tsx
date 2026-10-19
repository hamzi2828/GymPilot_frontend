"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { type Package } from "../../packages/services/packageService";
import { checkoutService, onlineMethod, providerName, type CouponPreview, type PaymentMethodKey, type PaymentMethods } from "../services/checkoutService";
import { parseAmount } from "@/helper/money";
import { signInUrl } from "@/helper/helper";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";
import { useSiteSettings } from "@/components/ThemeProvider";

interface OrderSummaryProps {
  packageData?: Package | null;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  /** Why the last attempt to pay did not go ahead; shown above the button. */
  error?: string | null;
  methods: PaymentMethods | null;
  /** The payment options failed to load; offer a retry. */
  methodsError?: boolean;
  onRetryMethods?: () => void;
  paymentMethod: PaymentMethodKey;
  onPaymentMethodChange: (method: PaymentMethodKey) => void;
  /** "Save my card and pay automatically", as the member has ticked it. */
  autoPay?: boolean;
  onAutoPayChange?: (value: boolean) => void;
  coupon: CouponPreview | null;
  onCouponChange: (coupon: CouponPreview | null) => void;
  /**
   * Whether checkout adds the joining fee: true or false once the API has
   * said (it is left off only for a signed-in account that has paid here
   * before), null when it could not be asked -- nobody is signed in, or the
   * check failed.
   */
  joiningFeeDue?: boolean | null;
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// `renewsByItself`: Stripe charges a recurring package again by itself. A
// gym on another gateway sends a payment link before each due date instead.
function billingLine(pkg: Package, renewsByItself = true) {
  const b = pkg.billing;
  if (b && b.mode === "recurring") {
    const every = b.intervalCount > 1 ? `every ${b.intervalCount} ${b.interval}s` : `per ${b.interval}`;
    return `${every}${renewsByItself ? ", renews automatically" : ""}${b.trialDays ? ` · ${b.trialDays}-day free trial` : ""}`;
  }
  if (pkg.kind === "session_pack" || pkg.kind === "pt_pack") return `${pkg.sessions || 0} sessions`;
  if (pkg.durationDays) return `valid ${pkg.durationDays} days`;
  return pkg.period;
}

/** How often the membership falls due: "month", "3 months". */
function termOf(pkg: Package): string {
  const b = pkg.billing;
  if (b && b.mode === "recurring") return b.intervalCount > 1 ? `${b.intervalCount} ${b.interval}s` : b.interval;
  return (pkg.period || "month").toLowerCase().replace(/^per\s+/, "").trim() || "month";
}

/**
 * Whether checkout offers to save the card and charge it on each due date:
 * the gym's gateway charges saved cards (its auto-charge is on), it is not
 * Stripe (whose recurring packages renew by themselves), and the package is
 * a membership that falls due again (a pack or a pass does not).
 */
export function offersAutoPay(methods: PaymentMethods | null, pkg: Package | null | undefined): boolean {
  const online = onlineMethod(methods);
  if (!online || online.provider === "stripe" || online.auto_pay_available !== true || !pkg) return false;
  return !pkg.kind || pkg.kind === "membership";
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  packageData,
  onSubmit,
  isSubmitting = false,
  error = null,
  methods,
  methodsError = false,
  onRetryMethods,
  paymentMethod,
  onPaymentMethodChange,
  coupon,
  onCouponChange,
  joiningFeeDue = null,
  autoPay = false,
  onAutoPayChange,
}) => {
  const { siteName } = useSiteSettings();
  const [code, setCode] = useState("");
  const { busy: checking, run } = useAsyncAction();
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
  // Read the typed price exactly as the API does when it charges, so the
  // total shown is the total paid. The old strip-and-parseFloat turned
  // "Rs. 1,200" into 0.12.
  const listPrice = parseAmount(packageData.price) ?? 0;
  // The API charges the joining fee unless a signed-in account has paid here
  // before. Known to be off, it is left out of the total; not known (null),
  // it stays in -- what someone not signed in pays -- with the way to have
  // it taken off.
  const joiningFee = joiningFeeDue === false ? 0 : Number(packageData.joiningFee || 0);
  const discount = coupon ? coupon.discount : 0;
  const total = Math.max(0, listPrice + joiningFee - discount);
  const recurring = packageData.billing?.mode === "recurring";

  const applyCoupon = () => {
    if (!code.trim()) return;
    run(async () => {
      setCouponError(null);
      try {
        const preview = await checkoutService.validateCoupon(code.trim(), packageData._id);
        onCouponChange(preview);
      } catch (e) {
        onCouponChange(null);
        setCouponError(e instanceof Error ? e.message : "That code is not valid");
      }
    });
  };

  // The gym's gateway for online payments (Stripe, Safepay, …), if any.
  const online = onlineMethod(methods);
  const viaStripe = online?.provider === "stripe";
  const gateway = providerName(online?.provider);
  const renewsByItself = !online || viaStripe;
  const noMethods = methods && !online && !methods.bankTransfer;
  // Nothing to charge: the API refuses a free package at checkout, so it is
  // joined at the desk (the packages page links there instead of here).
  const free = !(listPrice > 0);
  const canPay = !free && !noMethods && (paymentMethod === "online" ? !!online : !!methods?.bankTransfer);
  // Why card is off: Stripe's reason, so not for a gym whose gateway is bank transfer and a receipt.
  const cardReason = methods && !online && methods.online?.provider !== "generic" ? methods.cardUnavailable?.reason || "" : "";
  // What a renewal costs: the price, less a discount that carries over.
  const renewalPrice = Math.max(0, listPrice - (coupon?.appliesToRenewals ? discount : 0));
  const term = termOf(packageData);
  const showAutoPay = paymentMethod === "online" && offersAutoPay(methods, packageData);
  const consentText = `I allow ${siteName || "the gym"} to charge my saved card for my membership (${renewalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${(currency || "").toUpperCase()} every ${term}) on each due date. I can turn this off anytime in my account.`;

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
              <p className="text-sm text-gray-600 mt-1">{billingLine(packageData, renewsByItself)}</p>
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
            <button
              type="button"
              onClick={applyCoupon}
              disabled={checking || isSubmitting || !code.trim()}
              aria-busy={checking || undefined}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              {checking && <Spinner />}
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
            <div>
              <div className="flex items-center justify-between">
                <span className="checkout-subtotal-label text-gray-600">{joiningFeeDue ? "Joining fee (one-off)" : "Joining fee (new members only)"}</span>
                <span className="font-medium">{money(joiningFee, currency)}</span>
              </div>
              {!joiningFeeDue && (
                <p className="mt-1 text-xs text-gray-500">
                  Been a member here before?{" "}
                  <Link href={signInUrl()} className="font-semibold underline">
                    Sign in first
                  </Link>
                  , so the joining fee is not charged again.
                </p>
              )}
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
                Then {money(renewalPrice, currency)} {packageData.billing && packageData.billing.intervalCount > 1 ? `every ${packageData.billing.intervalCount} ${packageData.billing.interval}s` : `per ${packageData.billing?.interval}`}.{" "}
                {renewsByItself ? "Cancel any time from your account." : "We send you a payment link before each due date."}
              </p>
            )}
          </div>
        </div>

        {/* Payment method */}
        <div className="pt-2 space-y-3">
          <h3 className="checkout-section-title text-lg font-bold">Payment</h3>
          {free ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              There is nothing to pay online for this package. Ask at the front desk and they will set it up for you.{" "}
              <a href="/contact-us" className="font-semibold underline">
                Contact us
              </a>
            </div>
          ) : !methods && methodsError ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              We couldn&apos;t load the payment options.{" "}
              {onRetryMethods && (
                <button type="button" onClick={onRetryMethods} className="font-semibold underline">
                  Try again
                </button>
              )}
            </div>
          ) : !methods ? (
            <p className="text-sm text-gray-500">Loading payment options…</p>
          ) : noMethods ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              {cardReason ? `${cardReason} ` : "Online payment is not set up yet. "}
              Please pay at reception and we will activate your membership on the spot.
            </div>
          ) : (
            <>
              {cardReason && <p className="text-sm text-gray-600">{cardReason} You can pay by bank transfer instead.</p>}
              {online && !viaStripe && (
                <MethodOption
                  value="online"
                  title={online.label ? `Pay online — ${online.label.charAt(0).toLowerCase()}${online.label.slice(1)}` : "Pay online"}
                  hint={`Securely through ${gateway}, straight to ${siteName || "the gym"}.`}
                />
              )}
              {online && viaStripe && (
                <MethodOption
                  value="online"
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
              {showAutoPay && (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-4">
                  <input
                    type="checkbox"
                    checked={autoPay}
                    onChange={(e) => onAutoPayChange?.(e.target.checked)}
                    disabled={isSubmitting}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="checkout-label block font-medium">
                      Save my card and pay automatically {/^\d/.test(term) ? `every ${term}` : `each ${term}`}
                    </span>
                    <span className="mt-1 block text-xs text-gray-600">{consentText}</span>
                  </span>
                </label>
              )}
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || checking || !canPay}
          aria-busy={isSubmitting || undefined}
          className="checkout-green-bg w-full px-6 py-3 rounded-lg flex items-center justify-center space-x-2 text-black font-semibold hover:opacity-90 transition-opacity duration-200 bg-green-400 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={paymentMethod === "online" ? "Pay now" : "Continue to bank details"}
        >
          {isSubmitting ? (
            <>
              <Spinner />
              <span className="font-semibold">Processing...</span>
            </>
          ) : (
            <>
              <i className={`fas ${paymentMethod === "online" ? "fa-lock" : "fa-university"}`} />
              <span>{paymentMethod === "online" ? `Pay ${money(total, currency)}` : "Continue to bank details"}</span>
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center">
          {paymentMethod !== "online"
            ? "Your membership starts as soon as the transfer is confirmed."
            : renewsByItself
            ? "You will be redirected to Stripe to complete your payment. Card details are never stored on our servers."
            : `You will be taken to ${gateway} to pay. Card and wallet details stay with ${gateway} and are never stored on our servers.`}
        </p>
      </div>
    </div>
  );
};

export default OrderSummary;
