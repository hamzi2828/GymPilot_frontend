// src/app/(routes)/cart/components/ShippingProgress.tsx
type ShippingProgressProps = {
  remainingForFreeShipping: number;
  shippingProgressPercentage: number;
};

export default function ShippingProgress({
  remainingForFreeShipping,
  shippingProgressPercentage,
}: ShippingProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="gym-cart-shipping-title">Shipping</h3>
      <p className="gym-cart-shipping-text">
        Spend PKR{" "}
        <span id="remaining-amount">
          {remainingForFreeShipping.toLocaleString()}
        </span>{" "}
        to get free shipping
      </p>

      <div className="gym-cart-progress-track">
        <div
          className="gym-cart-progress-indicator"
          style={{ width: `${shippingProgressPercentage}%` }}
          id="shipping-progress"
        />
      </div>

      <p className="gym-cart-shipping-text">Free shipping</p>
    </div>
  );
}