import React from 'react';
import Image from 'next/image';
import { type Package } from '../../packages/services/packageService';

interface OrderSummaryProps {
  packageData?: Package | null;
  onSubmit?: () => void;
  isSubmitting?: boolean;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  packageData,
  onSubmit,
  isSubmitting = false
}) => {

  const isPackageCheckout = !!packageData;



  // Calculate totals based on checkout type
  let subtotalAmount = 0;
  if (isPackageCheckout && packageData) {
    // Remove commas and non-numeric characters except decimal point before parsing
    const cleanPrice = packageData.price.replace(/[^\d.]/g, '');
    subtotalAmount = parseFloat(cleanPrice) || 0;
  }

  const finalSubtotal = subtotalAmount;
  const finalTotal = finalSubtotal;

  if (!isPackageCheckout || !packageData) {
    return (
      <div className="lg:pl-8">
        <div className="sticky top-24 bg-white rounded-lg shadow-sm p-6">
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">
              No package selected
            </div>
            <a href="/packages" className="text-blue-600 hover:text-blue-800">
              Browse packages
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:pl-8">
      <div className="sticky top-24 bg-white rounded-lg shadow-sm p-6 space-y-8">
        {/* Package Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="checkout-product-title font-semibold text-lg">
                    {packageData.name} Package
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {packageData.period}
                  </p>
                </div>
                <div className="checkout-shipping-price font-bold text-lg">
                  {packageData.currency} {packageData.price}
                </div>
              </div>

              {packageData.features && packageData.features.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Package Features:</p>
                  <ul className="space-y-1">
                    {packageData.features.slice(0, 3).map((feature, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                    {packageData.features.length > 3 && (
                      <li className="text-sm text-gray-500 italic">
                        +{packageData.features.length - 3} more features
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>




        </div>

        {/* Order Summary */}
        <div className="space-y-4">
          {/* Subtotal */}
          <div className="flex items-center justify-between">
            <span className="checkout-subtotal-label text-gray-600">
              Package Price
            </span>
            <span className="checkout-shipping-price font-medium">
              {packageData.currency} {subtotalAmount.toLocaleString()}
            </span>
          </div>




          {/* Total */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="checkout-total-label font-bold text-lg">Total</span>
              <span className="checkout-total-price font-bold text-lg">
                {packageData.currency} {finalTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Section */}
          <div className="pt-6 space-y-4">
            <h3 className="checkout-section-title text-lg font-bold">Payment</h3>

            {/* Stripe Payment Option */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex items-center mt-1">
                      <div className="w-4 h-4 rounded-full border-2 border-blue-600 bg-blue-600 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      </div>
                    </div>
                    <div>
                      <p className="checkout-label font-medium">Pay with Credit/Debit Card (Stripe)</p>
                      <p className="checkout-input text-sm text-gray-600">Secure payment via Stripe Checkout</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-6 relative">
                      <Image src="/images/MasterCard.svg" alt="Mastercard" fill style={{ objectFit: "contain" }} />
                    </div>
                    <div className="w-8 h-3 relative">
                      <Image src="/images/Visa.svg" alt="Visa" fill style={{ objectFit: "contain" }} />
                    </div>
                  </div>
                </div>

                {/* Stripe Information */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <i className="fas fa-info-circle mr-2"></i>
                    You will be securely redirected to Stripe to complete your payment.
                    Your card details are never stored on our servers.
                  </p>
                </div>
              </div>
            </div>

            {/* Pay Now Button */}
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="checkout-green-bg w-full px-6 py-3 rounded-lg flex items-center justify-center space-x-2 text-black font-semibold hover:opacity-90 transition-opacity duration-200 bg-green-400 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Pay Now"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                  <span className="font-semibold">Processing...</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">Pay Now</span>
                  <i className="fas fa-arrow-right" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
