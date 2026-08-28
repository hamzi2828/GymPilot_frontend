"use client";

import React, { useState, useEffect, useCallback } from "react";
import "@fortawesome/fontawesome-free/css/all.css";
import { checkoutService, type ShippingAddress } from "../services/checkoutService";
import { getCurrentUser } from "../../../../helper/helper";
import { type Package } from "../../packages/services/packageService";

export interface OrderData {
  orderId: string;
  shippingAddress: ShippingAddress;
  packageId?: string;
  totalAmount: number;
}

interface CheckoutFormProps {
  onOrderCreate?: (orderData: OrderData) => void;
  discountCode?: string;
  discountAmount?: number;
  packageData?: Package | null;
  onSubmitChange?: (handler: () => void, isSubmitting: boolean) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ packageData, onSubmitChange }) => {
  const [paymentMethod] = useState("stripe");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPackageCheckout = !!packageData;

  // Form data states
  const [shippingData, setShippingData] = useState<ShippingAddress>({
    email: '',
    country: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    phoneNumber: ''
  });

  // Update shipping data
  const updateShippingData = (field: keyof ShippingAddress, value: string) => {
    setShippingData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Auto-fill user data if logged in
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setShippingData(prev => ({
        ...prev,
        email: currentUser.email || prev.email,
        firstName: currentUser.firstName || prev.firstName,
        lastName: currentUser.lastName || prev.lastName
      }));
    }
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      // Check if package exists (only for package checkout)
      if (isPackageCheckout && !packageData) {
        alert('Package not found. Please select a valid package.');
        setIsSubmitting(false);
        return;
      }

      // Validate shipping address
      const shippingValidation = checkoutService.validateShippingAddress(shippingData);
      if (!shippingValidation.valid) {
        const newErrors: Record<string, string> = {};
        shippingValidation.errors.forEach(error => {
          if (error.includes('Email')) newErrors.email = error;
          if (error.includes('First name')) newErrors.firstName = error;
          if (error.includes('Last name')) newErrors.lastName = error;
          if (error.includes('Country')) newErrors.country = error;
          if (error.includes('Phone')) newErrors.phoneNumber = error;
        });
        setErrors(newErrors);
        alert('Please fix the form errors');
        setIsSubmitting(false);
        return;
      }

      // If payment method is Stripe, create checkout session
      if (paymentMethod === 'stripe') {
        try {
          // Handle package checkout
          if (isPackageCheckout && packageData) {
            await checkoutService.createPackageStripeCheckout(
              packageData._id,
              shippingData
            );
            return;
          } else {
            alert('Cart checkout not yet implemented for packages');
            setIsSubmitting(false);
          }
        } catch (error: unknown) {
          console.error('Stripe checkout error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to initialize payment. Please try again.';
          alert(errorMessage);
          setIsSubmitting(false);
        }
        return;
      }
    } catch (error) {
      console.error('Order creation error:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isPackageCheckout, packageData, shippingData, paymentMethod]);

  // Expose submit handler to parent
  useEffect(() => {
    if (onSubmitChange) {
      onSubmitChange(handleSubmit, isSubmitting);
    }
  }, [handleSubmit, isSubmitting, onSubmitChange]);

  return (
    <div className="space-y-12">
      <div className="text-center lg:text-left">
        <h1 className="checkout-section-title text-2xl font-bold">
          {isPackageCheckout ? 'Package Subscription Checkout' : 'Checkout Form'}
        </h1>
        {isPackageCheckout && packageData && (
          <p className="text-gray-600 mt-2">Subscribing to: {packageData.name}</p>
        )}
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Email Section */}
        <div className="space-y-2">
          <label className="checkout-label block font-medium">
            Email
            {getCurrentUser() && (
              <span className="text-sm text-green-600 font-normal ml-2">
                <i className="fas fa-check-circle mr-1"></i>
                Auto-filled from your account
              </span>
            )}
          </label>
          <input
            type="email"
            placeholder="Enter your email"
            value={shippingData.email}
            onChange={(e) => updateShippingData('email', e.target.value)}
            className={`checkout-input w-full px-4 py-3 bg-white border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          />
          {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
        </div>

        {/* Delivery Section */}
        <div className="space-y-6">
          <h2 className="checkout-section-title text-xl font-bold">Contact Information</h2>

          {/* Country */}
          <div className="space-y-2">
            <label className="checkout-label block font-medium">Country</label>
            <div className="relative">
              <select
                value={shippingData.country}
                onChange={(e) => updateShippingData('country', e.target.value)}
                className={`checkout-input w-full px-4 py-3 bg-white border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none transition-all duration-200 ${
                  errors.country ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              >
                <option value="">Select your country</option>
                <option value="Pakistan">Pakistan</option>
                <option value="India">India</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
              </select>
              <i className="fas fa-chevron-down absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {errors.country && <p className="text-red-500 text-sm">{errors.country}</p>}
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="checkout-label block font-medium">
                First Name
                {getCurrentUser()?.firstName && (
                  <span className="text-sm text-green-600 font-normal ml-2">
                    <i className="fas fa-check-circle mr-1"></i>
                    Auto-filled
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="First Name"
                value={shippingData.firstName}
                onChange={(e) => updateShippingData('firstName', e.target.value)}
                className={`checkout-input w-full px-4 py-3 bg-white border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                  errors.firstName ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <label className="checkout-label block font-medium">
                Last Name
                {getCurrentUser()?.lastName && (
                  <span className="text-sm text-green-600 font-normal ml-2">
                    <i className="fas fa-check-circle mr-1"></i>
                    Auto-filled
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="Last Name"
                value={shippingData.lastName}
                onChange={(e) => updateShippingData('lastName', e.target.value)}
                className={`checkout-input w-full px-4 py-3 bg-white border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                  errors.lastName ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName}</p>}
            </div>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label className="checkout-label block font-medium">Phone Number</label>
            <input
              type="tel"
              placeholder="+92 987382 8967"
              value={shippingData.phoneNumber}
              onChange={(e) => updateShippingData('phoneNumber', e.target.value)}
              className={`checkout-input w-full px-4 py-3 bg-white border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {errors.phoneNumber && <p className="text-red-500 text-sm">{errors.phoneNumber}</p>}
          </div>
        </div>
      </form>
    </div>
  );
};

export default CheckoutForm;
