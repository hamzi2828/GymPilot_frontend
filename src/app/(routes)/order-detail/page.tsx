"use client";

import "@fortawesome/fontawesome-free/css/all.css";
import Image from "next/image";
import Link from "next/link";
import { useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

const STATUS_STEPS: OrderStatus[] = ["confirmed", "processing", "shipped", "delivered"];

const statusIndex = (s: OrderStatus) => {
  const i = STATUS_STEPS.indexOf(s);
  return i === -1 ? 0 : i;
};

// quick demo data (fallbacks)
const demoItems = [
  { id: "1", name: "WORDMARK CREW SOCKS 3 PACK", price: 21600, qty: 1, image: "/images/gym-2.svg", color: "Pearl White", size: "S" },
  { id: "2", name: "COMPRESSION LEGGINGS", price: 4299, qty: 1, image: "/images/gym-3.svg", color: "Charcoal Grey", size: "M" },
];

const demoAddress = {
  name: "Sarah Ahmed",
  street: "123 Model Town, Block A",
  city: "Lahore",
  state: "Punjab",
  zip: "54000",
  country: "Pakistan",
};

function OrderDetailContent() {
  const params = useSearchParams();

  const orderId = params.get("id") || "CRC-2024-001";
  const email = params.get("email") || "you@example.com";
  const total = Number(params.get("total")) || 25966;
  const rawStatus = (params.get("status") as OrderStatus) || "shipped";
  const tracking = params.get("tracking") || "TRK123456789";
  const carrier = params.get("carrier") || "DHL";
  const placed = params.get("placed") || "2024-08-10";

  const currentIndex = useMemo(() => statusIndex(rawStatus), [rawStatus]);
  const progressPct = useMemo(() => ((currentIndex + 1) / STATUS_STEPS.length) * 100, [currentIndex]);

  // optional external tracking link examples
  const carrierTrackUrl = useMemo(() => {
    const t = encodeURIComponent(tracking);
    switch (carrier.toLowerCase()) {
      case "dhl":
        return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${t}`;
      case "ups":
        return `https://www.ups.com/track?loc=en_US&tracknum=${t}`;
      case "fedex":
        return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
      default:
        return `https://parcelapp.com/track/${t}`;
    }
  }, [carrier, tracking]);

  const timeline = [
    { label: "Order Confirmed", date: placed, icon: "fas fa-check-circle" },
    { label: "Processing", date: "2024-08-11", icon: "fas fa-cog" },
    { label: "Shipped", date: "2024-08-12", icon: "fas fa-shipping-fast" },
    { label: "Out for Delivery", date: "2024-08-13", icon: "fas fa-truck" },
  ];

  return (
    <main className="pt-24 bg-white">
      <section className="px-4 sm:px-6 lg:px-20 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Track your order</h1>
          <p className="text-gray-600 mt-1">
            Order <span className="font-semibold">{orderId}</span> — placed on {new Date(placed).toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
          {/* Left: status + tracking + timeline */}
          <div className="lg:col-span-2 space-y-8">
            {/* Status stepper */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Status</h2>
              <div className="relative">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-gray-200" />
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-green-400 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
                <div className="relative z-10 grid grid-cols-4 gap-2">
                  {STATUS_STEPS.map((s, idx) => (
                    <div key={s} className="text-center">
                      <div
                        className={`mx-auto w-10 h-10 rounded-full grid place-items-center border ${
                          idx <= currentIndex ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-500 border-gray-300"
                        }`}
                        title={s}
                      >
                        {idx < currentIndex ? <i className="fas fa-check" /> : idx === currentIndex ? <i className="fas fa-circle" /> : <i className="far fa-circle" />}
                      </div>
                      <p className="mt-2 text-[12px] uppercase tracking-wide text-gray-700">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Carrier tracking */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Shipment</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Carrier: <span className="font-semibold">{carrier}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Tracking #: <span className="font-semibold">{tracking}</span>
                  </p>
                </div>
                <a
                  href={carrierTrackUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-green-400 text-black font-semibold hover:opacity-90"
                >
                  Track on {carrier}
                </a>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Activity</h2>
              <ol className="relative border-l border-gray-200 ml-3">
                {timeline.map((t, i) => (
                  <li key={i} className="mb-6 ml-6">
                    <span className="absolute -left-[10px] flex items-center justify-center w-5 h-5 bg-white rounded-full ring-2 ring-green-400">
                      <i className={`${t.icon} text-green-600 text-[10px]`} />
                    </span>
                    <h3 className="font-semibold text-gray-900">{t.label}</h3>
                    <time className="text-xs text-gray-500">{new Date(t.date).toLocaleString()}</time>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Right: order summary / items / address */}
          <aside className="space-y-8">
            {/* Order info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Order summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">Rs {(total - 1500).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">Rs 1,500</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">Rs 0</span>
                </div>
                <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-extrabold text-gray-900">Rs {total.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={{ pathname: "/order-success", query: { id: orderId, total, email } }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-gray-500 font-semibold"
                >
                  <i className="fas fa-receipt" /> View confirmation
                </Link>
                <Link
                  href={`/api/orders/${encodeURIComponent(orderId)}/invoice`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-gray-500 font-semibold"
                >
                  <i className="fas fa-file-download" /> Download invoice
                </Link>
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Items</h2>
              <div className="space-y-4">
                {demoItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-3">
                    <div className="relative w-14 h-14 rounded-md overflow-hidden border">
                      <Image src={it.image} alt={it.name} fill style={{ objectFit: "cover" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{it.name}</p>
                      <p className="text-xs text-gray-500">
                        {it.color} • {it.size} • Qty: {it.qty}
                      </p>
                    </div>
                    <div className="font-semibold text-gray-900 text-sm">Rs {it.price.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Link href="/main" className="text-sm text-blue-600 hover:text-blue-800">
                  Continue shopping →
                </Link>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Shipping address</h2>
              <address className="not-italic text-sm text-gray-700">
                <div className="font-semibold text-gray-900">{demoAddress.name}</div>
                <div>{demoAddress.street}</div>
                <div>
                  {demoAddress.city}, {demoAddress.state} {demoAddress.zip}
                </div>
                <div>{demoAddress.country}</div>
              </address>
              <div className="mt-4">
                <Link href="/contact-us" className="text-sm text-blue-600 hover:text-blue-800">
                  Need to change the address? Contact support
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {/* Back nav */}
        <div className="mt-10 text-center">
          <Link href="/user-detail" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border-2 border-gray-300 hover:border-gray-500 font-semibold">
            <i className="fas fa-user" />
            Go to Account
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<div className="pt-24 px-4 py-12 text-center">Loading order details...</div>}>
      <OrderDetailContent />
    </Suspense>
  );
}