// src/app/(routes)/checkout/services/checkoutService.ts
//
// Buying a package. Two ways to pay: card through the gym's Stripe account
// (redirect to Stripe Checkout) and bank transfer (an order the member then
// attaches a receipt to, confirmed by staff).

import { getAuthToken } from "../../../../helper/helper";

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

export type PaymentMethodKey = "stripe" | "bank_transfer";

export interface BankAccount {
  _id: string;
  name: string;
  accountTitle: string;
  accountNumber: string;
  branch?: string;
  iban?: string;
  notes?: string;
  qrCodeUrl?: string;
}

export interface PaymentMethods {
  card: boolean;
  /** Why card is off, when it is (e.g. the gym has not finished connecting Stripe). */
  cardUnavailable?: { code: string | null; reason: string } | null;
  bankTransfer: boolean;
  banks: BankAccount[];
  currency: string;
}

export interface CouponPreview {
  code: string;
  description: string;
  type: "percent" | "amount";
  value: number;
  discount: number;
  total: number;
  currency: string;
  appliesToRenewals: boolean;
}

export interface BankOrder {
  _id: string;
  orderNumber: string;
  status: string;
  packageDetails: { name: string; period: string; currency: string; price: string };
  payment: {
    amount: number;
    subtotal?: number;
    discountAmount?: number;
    couponCode?: string;
    currency: string;
    status: string;
    method: string;
    proof?: { url?: string; reference?: string; note?: string; uploadedAt?: string; rejectionReason?: string };
  };
  subscription?: { startDate?: string; endDate?: string };
  createdAt: string;
}

class CheckoutService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  }

  private getAuthHeaders(json = true): Record<string, string> {
    const token = getAuthToken();
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async parse<T>(response: Response, fallback: string): Promise<T> {
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.success === false) throw new Error(json?.message || fallback);
    return json as T;
  }

  private formatCustomer(customerInfo: ShippingAddress) {
    return {
      fullName: customerInfo.fullName || `${customerInfo.firstName} ${customerInfo.lastName}`,
      email: customerInfo.email,
      phone: customerInfo.phone || customerInfo.phoneNumber,
      address: customerInfo.address || "",
      city: customerInfo.city || "",
      state: customerInfo.state || "",
      zipCode: customerInfo.zipCode || customerInfo.postalCode || "",
      country: customerInfo.country || "",
    };
  }

  /** Which ways of paying this gym offers right now. */
  async getPaymentMethods(): Promise<PaymentMethods> {
    const res = await fetch(`${this.baseUrl}/api/gymfolio/payment/methods`, { headers: this.getAuthHeaders(false) });
    const json = await this.parse<{ data: PaymentMethods }>(res, "Could not load payment methods");
    return json.data;
  }

  /**
   * Whether checkout will add the package's joining fee for the signed-in
   * account: it is charged only with a member's first membership. null when
   * the API does not know who is asking (signed out, or a stale session).
   */
  async getJoiningFeeDue(): Promise<boolean | null> {
    if (!getAuthToken()) return null;
    const res = await fetch(`${this.baseUrl}/api/gymfolio/membership/joining-fee-due`, { headers: this.getAuthHeaders(false) });
    const json = await this.parse<{ data: { due: boolean | null } }>(res, "Could not check the joining fee");
    return typeof json.data?.due === "boolean" ? json.data.due : null;
  }

  /** Checks a discount code against a package before paying. */
  async validateCoupon(code: string, packageId: string): Promise<CouponPreview> {
    const res = await fetch(`${this.baseUrl}/api/gymfolio/coupons/validate`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ code, packageId }),
    });
    const json = await this.parse<{ data: CouponPreview }>(res, "That code is not valid");
    return json.data;
  }

  /** Card: opens Stripe Checkout (redirects the browser). */
  async createPackageStripeCheckout(packageId: string, customerInfo: ShippingAddress, couponCode?: string) {
    const response = await fetch(`${this.baseUrl}/api/gymfolio/payment/create-package-checkout-session`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ packageId, customerInfo: this.formatCustomer(customerInfo), couponCode: couponCode || undefined }),
    });
    const result = await this.parse<{ url?: string }>(response, "Failed to create package checkout session");
    if (result.url) {
      window.location.href = result.url;
      return;
    }
    throw new Error("Failed to create package checkout session");
  }

  /** Bank transfer: records the order and returns it with the bank details to pay into. */
  async createBankTransferOrder(packageId: string, customerInfo: ShippingAddress, couponCode?: string): Promise<{ order: BankOrder; banks: BankAccount[] }> {
    const response = await fetch(`${this.baseUrl}/api/gymfolio/payment/bank-transfer`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ packageId, customerInfo: this.formatCustomer(customerInfo), couponCode: couponCode || undefined }),
    });
    const json = await this.parse<{ data: BankOrder; banks: BankAccount[] }>(response, "Could not create the order");
    return { order: json.data, banks: json.banks || [] };
  }

  async getBanks(): Promise<BankAccount[]> {
    const res = await fetch(`${this.baseUrl}/api/gymfolio/payment/banks`);
    const json = await this.parse<{ data: BankAccount[] }>(res, "Could not load bank details");
    return json.data || [];
  }

  async getOrder(orderId: string): Promise<BankOrder> {
    const res = await fetch(`${this.baseUrl}/api/gymfolio/package-orders/${orderId}`, { headers: this.getAuthHeaders() });
    const json = await this.parse<{ data: BankOrder }>(res, "Could not load the order");
    return json.data;
  }

  /** Attaches the transfer receipt (and/or reference) to a bank-transfer order. */
  async submitTransferProof(orderId: string, { file, reference, note }: { file?: File | null; reference?: string; note?: string }): Promise<string> {
    const form = new FormData();
    if (file) form.append("proof", file);
    if (reference) form.append("reference", reference);
    if (note) form.append("note", note);
    const res = await fetch(`${this.baseUrl}/api/gymfolio/package-orders/${orderId}/proof`, {
      method: "POST",
      headers: this.getAuthHeaders(false),
      body: form,
    });
    const json = await this.parse<{ message?: string }>(res, "Could not send the receipt");
    return json.message || "Receipt sent";
  }

  async verifyPayment(sessionId: string) {
    const response = await fetch(`${this.baseUrl}/api/gymfolio/payment/verify/${sessionId}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
    });
    return response.json();
  }

  async getStripePublicKey() {
    try {
      const response = await fetch(`${this.baseUrl}/api/gymfolio/payment/stripe-public-key`);
      const data = await response.json();
      return data.publicKey;
    } catch (error) {
      console.error("❌ Error getting Stripe public key:", error);
      return null;
    }
  }

  validateShippingAddress(address: ShippingAddress): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!address.email) {
      errors.push("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      errors.push("Please enter a valid email address");
    }
    if (!address.firstName?.trim()) errors.push("First name is required");
    if (!address.lastName?.trim()) errors.push("Last name is required");
    if (!address.country?.trim()) errors.push("Country is required");
    if (!address.phoneNumber?.trim()) errors.push("Phone number is required");
    return { valid: errors.length === 0, errors };
  }
}

export const checkoutService = new CheckoutService();
export default checkoutService;
