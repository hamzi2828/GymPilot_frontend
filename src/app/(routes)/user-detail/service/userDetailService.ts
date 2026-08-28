// src/app/(routes)/user-detail/service/userDetailService.ts
import { getAuthHeader } from "@/helper/helper";

export interface Address {
  id: string;
  type: "home" | "work" | "other";
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  profileImage: string;
  joinedDate: string;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
}

export interface OrderItem {
  _id?: string;
  id?: string;
  product: {
    _id: string;
    name: string;
    images: string[];
    price: number;
    discountedPrice?: number;
    thumbnail?: string;
    thumbnailUrl?: string;
    bannerUrls?: string[];
    primaryImageUrl?: string; // Set by backend for variant-specific images
    colorMedia?: unknown;
    variants?: unknown[];
    description?: string;
  } | string;
  variantId: string;
  sku: string;
  quantity: number;
  price: number;
  size: string;
  color: string;
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface Order {
  _id: string;
  id?: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  orderStatus: OrderStatus;
  paymentStatus: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  shippingAddress: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  billingAddress: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
}

export const statusStyles: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  processing: "bg-purple-100 text-purple-800 border-purple-200",
  shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  refunded: "bg-gray-100 text-gray-800 border-gray-200",
};

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface UpdateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
}

export async function updateUser( payload: UpdateUserPayload) {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }
  const res = await fetch(`${API_BASE_URL}/update/user`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "Update failed";
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function getUserDetailForProfile() {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }
  const res = await fetch(`${API_BASE_URL}/userDetailForProfile`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    let msg = "Get user detail failed";
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export interface GetOrdersParams {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

export interface OrdersResponse {
  success: boolean;
  orders: Order[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

export async function getUserOrders(params?: GetOrdersParams): Promise<OrdersResponse> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const searchParams = new URLSearchParams();
  if (params?.status) {
    searchParams.append('status', params.status);
  }
  if (params?.page) {
    searchParams.append('page', params.page.toString());
  }
  if (params?.limit) {
    searchParams.append('limit', params.limit.toString());
  }

  const url = `${API_BASE_URL}/api/gymfolio/package-orders/me${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    let msg = "Failed to fetch orders";
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const json = await res.json();
  // Adapt gymfolio package orders into Order shape so OrdersSection renders safely
  const raw: Array<Record<string, unknown>> = json?.data || json?.orders || [];
  const orders: Order[] = raw.map((o) => {
    const pkg = (o.packageDetails as Record<string, unknown>) || {};
    const customer = (o.customerInfo as Record<string, unknown>) || {};
    const payment = (o.payment as Record<string, unknown>) || {};
    return {
      _id: String(o._id),
      orderNumber: String(o.orderNumber || ""),
      createdAt: String(o.createdAt || new Date().toISOString()),
      updatedAt: String(o.updatedAt || new Date().toISOString()),
      orderStatus: (o.status as OrderStatus) || "pending",
      paymentStatus: String(payment.status || ""),
      items: [
        {
          product: {
            _id: String(o.packageId || ""),
            name: String(pkg.name || "Package"),
            images: [],
            price: Number(payment.amount || 0),
          },
          variantId: "",
          sku: "",
          quantity: 1,
          price: Number(payment.amount || 0),
          size: String(pkg.period || ""),
          color: "",
        },
      ],
      subtotal: Number(payment.amount || 0),
      shippingCost: 0,
      tax: 0,
      discount: 0,
      total: Number(payment.amount || 0),
      shippingAddress: {
        fullName: String(customer.fullName || ""),
        email: String(customer.email || ""),
        phone: String(customer.phone || ""),
        address: String(customer.address || ""),
        city: String(customer.city || ""),
        state: String(customer.state || ""),
        zipCode: String(customer.zipCode || ""),
        country: String(customer.country || ""),
      },
      billingAddress: {
        fullName: String(customer.fullName || ""),
        email: String(customer.email || ""),
        phone: String(customer.phone || ""),
        address: String(customer.address || ""),
        city: String(customer.city || ""),
        state: String(customer.state || ""),
        zipCode: String(customer.zipCode || ""),
        country: String(customer.country || ""),
      },
    };
  });

  return {
    success: true,
    orders,
    pagination: {
      total: orders.length,
      page: 1,
      pages: 1,
      limit: orders.length,
    },
  };
}

export async function getOrderById(orderId: string) {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
  }

  const res = await fetch(`${API_BASE_URL}/api/payment/orders/${orderId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    let msg = "Failed to fetch order details";
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}
