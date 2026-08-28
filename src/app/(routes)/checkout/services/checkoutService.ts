import { getAuthToken } from "../../../../helper/helper";
import { loadStripe } from '@stripe/stripe-js';

export interface ShippingAddress {
  email: string;
  country: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  address: string;
  city: string;
  state?: string;
  postalCode?: string;
  zipCode?: string;
  phoneNumber: string;
  phone?: string;
}

export interface PaymentMethod {
  type: 'card' | 'cod' | 'other';
  cardNumber?: string;
  expirationDate?: string;
  securityCode?: string;
  cardHolderName?: string;
  useShippingAddress?: boolean;
}

class CheckoutService {
  private baseUrl: string;
  private stripePromise: ReturnType<typeof loadStripe> | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  }

  private async getStripe() {
    if (!this.stripePromise) {
      const response = await fetch(`${this.baseUrl}/api/gymfolio/payment/stripe-public-key`);
      const data = await response.json();
      if (data.success && data.publicKey) {
        this.stripePromise = loadStripe(data.publicKey);
      }
    }
    return this.stripePromise;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  // Create Stripe checkout session for package subscription
  async createPackageStripeCheckout(packageId: string, customerInfo: ShippingAddress) {
    try {
      console.log('💳 Creating Package Stripe checkout session...');

      // Format customer info
      const formattedCustomer = {
        fullName: customerInfo.fullName || `${customerInfo.firstName} ${customerInfo.lastName}`,
        email: customerInfo.email,
        phone: customerInfo.phone || customerInfo.phoneNumber,
        address: customerInfo.address || '',
        city: customerInfo.city || '',
        state: customerInfo.state || '',
        zipCode: customerInfo.zipCode || customerInfo.postalCode || '',
        country: customerInfo.country || 'United States'
      };

      const response = await fetch(`${this.baseUrl}/api/gymfolio/payment/create-package-checkout-session`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          packageId,
          customerInfo: formattedCustomer
        }),
      });

      const result = await response.json();
      console.log('- Package checkout session result:', result);

      if (result.success && result.url) {
        // Redirect to Stripe checkout URL
        // Using direct URL redirect instead of deprecated stripe.redirectToCheckout()
        window.location.href = result.url;
        return;
      }

      throw new Error(result.message || 'Failed to create package checkout session');
    } catch (error) {
      console.error('❌ Error creating Package Stripe checkout:', error);
      throw error;
    }
  }

  // Verify payment after redirect from Stripe
  async verifyPayment(sessionId: string) {
    try {
      console.log('✅ Verifying payment for session:', sessionId);

      const response = await fetch(`${this.baseUrl}/api/gymfolio/payment/verify/${sessionId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();
      console.log('- Verification result:', result);

      return result;
    } catch (error) {
      console.error('❌ Error verifying payment:', error);
      throw error;
    }
  }

  // Get Stripe public key
  async getStripePublicKey() {
    try {
      const response = await fetch(`${this.baseUrl}/api/gymfolio/payment/stripe-public-key`);
      const data = await response.json();
      return data.publicKey;
    } catch (error) {
      console.error('❌ Error getting Stripe public key:', error);
      return null;
    }
  }

  // Validate shipping address
  validateShippingAddress(address: ShippingAddress): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!address.email) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      errors.push('Please enter a valid email address');
    }

    if (!address.firstName?.trim()) errors.push('First name is required');
    if (!address.lastName?.trim()) errors.push('Last name is required');
    if (!address.country?.trim()) errors.push('Country is required');
    if (!address.phoneNumber?.trim()) errors.push('Phone number is required');

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const checkoutService = new CheckoutService();
