// src/app/(routes)/cart/components/CartSummary.tsx
import Link from "next/link";
import ShippingProgress from "./ShippingProgress";
import { PaymentMethods } from "./PaymentMethods";

interface CartSummaryProps {
  cartTotal: number;
  cartSavings: number;
  finalAmount: number;
  remainingForFreeShipping: number;
  shippingProgressPercentage: number;
}

export const CartSummary = ({
  cartTotal,
  cartSavings,
  finalAmount,
  remainingForFreeShipping,
  shippingProgressPercentage,
}: CartSummaryProps) => (
  <div className="gym-cart-summary">
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        <ShippingProgress
          remainingForFreeShipping={remainingForFreeShipping}
          shippingProgressPercentage={shippingProgressPercentage}
        />

        <div className="border-t border-gray-200 my-2" />

        <div className="flex flex-col gap-4">
          <div className="gym-cart-price-row">
            <span className="gym-cart-price-label">Total</span>
            <span className="gym-cart-price-value">
              Rs <span id="cart-total">{cartTotal.toLocaleString()}</span>
            </span>
          </div>
          <div className="gym-cart-price-row">
            <span className="gym-cart-price-label">Saving</span>
            <span className="gym-cart-price-value">
              Rs <span id="cart-savings">{cartSavings.toLocaleString()}</span>
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200 my-2" />

        <div className="gym-cart-price-row">
          <span className="gym-cart-price-label">You pay</span>
          <span className="gym-cart-price-value">
            Rs <span id="final-amount">{finalAmount.toLocaleString()}</span>
          </span>
        </div>

        <Link href="/checkout" className="gym-cart-checkout-btn" aria-label="Proceed to checkout">
          <span className="gym-cart-checkout-text">Check out Securely</span>
          <i className="fas fa-arrow-right" />
        </Link>
      </div>

      <PaymentMethods />

      <Link href="/main" className="gym-cart-continue-btn" aria-label="Continue shopping">
        <span className="gym-cart-continue-text">Continue Shopping</span>
        <i className="fas fa-arrow-right" />
      </Link>
    </div>
  </div>
);