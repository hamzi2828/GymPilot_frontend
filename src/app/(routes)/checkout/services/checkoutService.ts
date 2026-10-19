// src/app/(routes)/checkout/services/checkoutService.ts
//
// Buying a package. Two ways to pay: online through the gym's own payment
// gateway (Stripe, or Safepay in Pakistan: a redirect to its payment page)
// and bank transfer (an order the member then attaches a receipt to,
// confirmed by staff).

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

export type PaymentMethodKey = "online" | "bank_transfer";

/**
 * The gateway that takes this gym's online payments, as GET /payment/methods
 * names it: its id ("stripe", "safepay", …) and what members can pay with
 * through it ("Card, JazzCash, Easypaisa or any bank app").
 */
export interface OnlineMethod {
  provider: string;
  label: string;
  /** The gym charges saved cards on the due date, so checkout may offer to save one. */
  auto_pay_available?: boolean;
}

/** What each gateway is called on screen; one not listed is "our payment partner". */
const PROVIDER_NAMES: Record<string, string> = { stripe: "Stripe", safepay: "Safepay" };

export function providerName(provider?: string | null): string {
  return (provider && PROVIDER_NAMES[provider]) || "our payment partner";
}

/**
 * How this gym takes online payments right now, or null when it does not.
 * An API from before gateways could be chosen sends no `online`; its `card`
 * then means Stripe. Stripe also still needs `card`, which says it is fully
 * connected (its webhook secret included).
 */
export function onlineMethod(methods: PaymentMethods | null | undefined): OnlineMethod | null {
  if (!methods) return null;
  if (methods.online === undefined) return methods.card ? { provider: "stripe", label: "Card" } : null;
  if (!methods.online || !methods.online.provider) return null;
  if (methods.online.provider === "stripe" && !methods.card) return null;
  return methods.online;
}

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
  /** The gym's Stripe is connected (its old meaning; see `online`). */
  card: boolean;
  /** Why card is off, when it is (e.g. the gym has not finished connecting Stripe). */
  cardUnavailable?: { code: string | null; reason: string } | null;
  bankTransfer: boolean;
  banks: BankAccount[];
  currency: string;
  /** The gateway for online payments, or null when there is none (absent from older APIs). */
  online?: OnlineMethod | null;
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

/** What the success page is told about a paid order (nothing about the payer). */
export interface VerifiedOrder {
  orderNumber?: string;
  packageId?: string;
  packageName?: string;
  amount?: number;
  currency?: string;
  status?: string;
}

/**
 * A refused checkout request, with the API's sentence as `message`, the HTTP
 * status and the API's `code` when it gave one -- so a page can tell "no
 * such order" (404 ORDER_NOT_FOUND) or "this order is closed" (409) from a
 * failure worth trying again.
 */
export class CheckoutRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "CheckoutRequestError";
    this.status = status;
    this.code = code;
  }
}

/** The 24-character id the API gives an order. Anything else is no order of ours. */
export const isOrderId = (value: string | null | undefined): value is string => !!value && /^[a-f\d]{24}$/i.test(value);

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
    if (!response.ok || json?.success === false) {
      throw new CheckoutRequestError(json?.message || fallback, response.status, typeof json?.code === "string" ? json.code : undefined);
    }
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
   * Whether checkout will add the package's joining fee: it is left off only
   * for a signed-in account that has paid here before. Anyone the API does
   * not recognise (signed out, or a session that has lapsed) is a new member
   * to it and pays the fee, so it answers true for them. null only when
   * nobody is signed in on this device.
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

  /**
   * Online: opens the gym's gateway's payment page (redirects the browser).
   * `autoPay` is the member's ticked consent to save the card and be charged
   * on each due date; it is only sent when given.
   */
  async createOnlineCheckout(packageId: string, customerInfo: ShippingAddress, couponCode?: string, autoPay = false) {
    const response = await fetch(`${this.baseUrl}/api/gymfolio/payment/create-package-checkout-session`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        packageId,
        customerInfo: this.formatCustomer(customerInfo),
        couponCode: couponCode || undefined,
        ...(autoPay ? { saveCard: true, autoPayConsent: true } : {}),
      }),
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
    const res = await fetch(`${this.baseUrl}/api/gymfolio/package-orders/${encodeURIComponent(orderId)}`, { headers: this.getAuthHeaders() });
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

  /**
   * Asks whether an online checkout has been paid: a Stripe one by its
   * session id, any other gateway's by the order id, named with `provider`.
   *
   * Resolves only when the API gave a proper answer: `paid` true or false,
   * or `notFound` when it has no order for this payment at all (404
   * ORDER_NOT_FOUND), which asking again will not change. Throws when it
   * gave none -- offline, a server error, a rate limit -- which says nothing
   * either way about the payment, so the caller must not read it as "not
   * paid".
   */
  async verifyPayment(sessionId: string, provider?: string | null): Promise<{ paid: boolean; order: VerifiedOrder | null; notFound?: boolean }> {
    const query = provider && provider !== "stripe" ? `?provider=${encodeURIComponent(provider)}` : "";
    const response = await fetch(`${this.baseUrl}/api/gymfolio/payment/verify/${encodeURIComponent(sessionId)}${query}`, {
      method: "GET",
      headers: this.getAuthHeaders(),
    });
    const json = await response.json().catch(() => null);
    if (response.status === 404 && json && json.code === "ORDER_NOT_FOUND") return { paid: false, order: null, notFound: true };
    if (!response.ok || !json || typeof json !== "object") {
      throw new Error((json && json.message) || "Could not verify the payment");
    }
    return { paid: !!(json.success && json.paid), order: json.order || null };
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
