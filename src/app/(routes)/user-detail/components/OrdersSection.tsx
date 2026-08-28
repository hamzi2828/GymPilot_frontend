import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Order, OrderStatus } from "../service/userDetailService";

export interface OrdersSectionProps {
  filteredOrders: Order[];
  orderFilter: string;
  setOrderFilter: (v: string) => void;
  statusStyles: Record<OrderStatus, string>;
}

export const OrdersSection: React.FC<OrdersSectionProps> = ({
  filteredOrders,
  orderFilter,
  setOrderFilter,
  statusStyles,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-black">Order History</h2>
        <div className="relative">
          <select
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value)}
            className="appearance-none bg-white border-2 border-gray-200 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:border-primary"
          >
            {["all", "pending", "processing", "shipped", "delivered", "cancelled", "refunded"].map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {filteredOrders.map((order) => (
        <div
          key={order._id}
          className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-primary transition-colors"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-black">#{order.orderNumber}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${statusStyles[order.orderStatus]}`}>
                {order.orderStatus[0].toUpperCase() + order.orderStatus.slice(1)}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              <i className="fas fa-calendar mr-2" />
              {new Date(order.createdAt).toLocaleDateString()}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {order.items.map((item, index) => {
              const product = typeof item.product === 'object' ? item.product : null;
              const productName = product?.name || `Product ${index + 1}`;

              // Try to get variant-specific image first, fallback to general product images
              let productImage = '/images/gym1.svg'; // Default fallback

              if (product?.primaryImageUrl) {
                // Use the variant-specific image set by backend
                productImage = product.primaryImageUrl;
              } else if (product?.thumbnailUrl) {
                // Use product thumbnail
                productImage = product.thumbnailUrl;
              } else if (product?.images?.[0]) {
                // Fallback to first product image
                productImage = product.images[0];
              } else if (product?.bannerUrls?.[0]) {
                // Fallback to first banner
                productImage = product.bannerUrls[0];
              }

              const productId = product?._id;

              return (
                <div key={item._id || index} className="flex items-center gap-3">
                  <Link href={productId ? `/product-detail/${productId}` : "/products"} className="block">
                    <Image
                      src={process.env.NEXT_PUBLIC_BACKEND_URL + productImage}
                      alt={productName}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <Link href={productId ? `/product-detail/${productId}` : "/products"} className="font-semibold text-gray-900 text-sm truncate hover:underline">
                        {productName}
                      </Link>
                      <span className="text-sm font-bold text-black">Rs {item.price.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {item.color} • {item.size} • Qty: {item.quantity}
                    </p>
                
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-left">
              <div className="text-lg font-bold text-black">Total: Rs {order.total.toLocaleString()}</div>
              {!!order.discount && (
                <div className="text-sm text-primary">Saved Rs {order.discount.toLocaleString()}</div>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href={{ pathname: "/order-detail", query: { id: order._id } }}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg hover:border-primary hover:text-primary text-sm"
              >
                <i className="fas fa-eye mr-2" />
                Details
              </Link>
              {order.orderStatus === "delivered" && (
                <Link href="/cart" className="px-3 py-2 bg-primary text-black rounded-lg text-sm hover:opacity-90">
                  <i className="fas fa-redo mr-2" />
                  Reorder
                </Link>
              )}
            </div>
          </div>

          <div className="mt-2 text-sm text-gray-500">
            {order.shippedAt && !order.deliveredAt && (
              <span className="mr-4">
                <i className="fas fa-shipping-fast mr-2" />
                Shipped: {new Date(order.shippedAt).toLocaleDateString()}
              </span>
            )}
            {order.deliveredAt && (
              <span className="text-green-600">
                <i className="fas fa-check mr-2" />
                Delivered: {new Date(order.deliveredAt).toLocaleDateString()}
              </span>
            )}
            {order.trackingNumber && (
              <span className="mr-4">
                <i className="fas fa-route mr-2" />
                Tracking: {order.trackingNumber}
              </span>
            )}
          </div>
        </div>
      ))}

      {filteredOrders.length === 0 && (
        <div className="text-center py-14">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <i className="fas fa-shopping-bag text-4xl text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500 mb-6">
            {orderFilter === "all" ? "You haven't placed any orders yet" : "No orders match your current filter"}
          </p>
          <div className="flex justify-center gap-3">
            {orderFilter !== "all" && (
              <button
                onClick={() => setOrderFilter("all")}
                className="px-5 py-3 border-2 border-primary text-primary rounded-lg hover:bg-primary hover:text-black"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersSection;
