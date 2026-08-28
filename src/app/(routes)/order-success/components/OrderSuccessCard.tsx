"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type ItemThumb = { src: string; alt?: string };

type Props = {
  orderId: string;
  email: string;
  total: number;
  eta: string;
  items?: ItemThumb[]; // optional thumbnails to display
  showConfetti?: boolean;
};

export default function OrderSuccessCard({
  orderId,
  email,
  total,
  eta,
  items = [],
  showConfetti = true,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const steps = [
    { key: "placed", label: "Order placed", icon: "fas fa-check-circle" },
    { key: "processing", label: "Processing", icon: "fas fa-sync" },
    { key: "shipped", label: "Shipped", icon: "fas fa-shipping-fast" },
    { key: "delivered", label: "Delivered", icon: "fas fa-box-open" },
  ];

  return (
    <article className="relative">
      {/* Card shell */}
      <div className="relative max-w-4xl mx-auto rounded-3xl border border-gray-200 shadow-sm overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-sky-50">
        {/* Top accent */}
        <div className="absolute inset-x-0 -top-[1px] h-1 bg-gradient-to-r from-emerald-400 via-emerald-300 to-sky-300" />

        {/* Confetti */}
        {showConfetti && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <span className="confetti c1" />
            <span className="confetti c2" />
            <span className="confetti c3" />
            <span className="confetti c4" />
            <span className="confetti c5" />
          </div>
        )}

        {/* Body */}
        <div className="relative p-6 sm:p-10">
          {/* Success badge */}
          <div className="mx-auto mb-5 sm:mb-7 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500/10 ring-8 ring-green-100 flex items-center justify-center">
            <i className="fas fa-check text-green-600 text-2xl sm:text-3xl" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 text-center">
            Order Confirmed — Thank you!
          </h1>
          <p className="text-center text-gray-600 mt-3">
            A confirmation was sent to <span className="font-semibold">{email}</span>.
          </p>

          {/* Thumbnails (optional) */}
          {!!items.length && (
            <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
              {items.slice(0, 5).map((it, i) => (
                <div
                  key={i}
                  className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-gray-200 bg-white shadow"
                  title={it.alt || "Ordered item"}
                >
                  <Image src={it.src} alt={it.alt || "Ordered item"} fill style={{ objectFit: "cover" }} />
                </div>
              ))}
              {items.length > 5 && (
                <span className="text-xs sm:text-sm text-gray-500">+{items.length - 5} more</span>
              )}
            </div>
          )}

          {/* Summary grid */}
          <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Order Number</p>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-gray-900 truncate">{orderId}</p>
                <button
                  onClick={copyOrderId}
                  className="px-2 py-1 rounded border text-xs border-gray-300 hover:bg-gray-50"
                  aria-label="Copy order number"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Total Paid</p>
              <p className="font-semibold text-gray-900">Rs {total.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Estimated Delivery</p>
              <p className="font-semibold text-gray-900">{eta}</p>
            </div>
          </div>

          {/* Step tracker */}
          <div className="mt-6 sm:mt-8">
            <div className="relative">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-gray-200" />
              <div className="relative z-10 grid grid-cols-4 gap-2">
                {steps.map((s) => (
                  <div className="text-center" key={s.key}>
                    <div className="mx-auto w-8 h-8 rounded-full bg-green-500 text-white grid place-items-center shadow">
                      <i className={`${s.icon} text-[13px]`} />
                    </div>
                    <p className="mt-2 text-[11px] sm:text-xs text-gray-700">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-7 sm:mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={{ pathname: "/order-detail", query: { id: orderId } }}
              className="px-5 py-3 rounded-lg bg-green-400 text-black font-semibold hover:opacity-90 shadow"
            >
              <i className="fas fa-route mr-2" />
              Track / View Order
            </Link>

            <Link
              href="/main"
              className="px-5 py-3 rounded-lg border-2 border-gray-300 text-gray-900 font-semibold hover:border-gray-500 bg-white"
            >
              <i className="fas fa-shopping-bag mr-2" />
              Continue Shopping
            </Link>

            <Link
              href={`/api/orders/${encodeURIComponent(orderId)}/invoice`}
              className="px-5 py-3 rounded-lg border-2 border-gray-300 text-gray-900 font-semibold hover:border-gray-500 bg-white"
            >
              <i className="fas fa-file-download mr-2" />
              Download Receipt
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            Need help?{" "}
            <Link href="/contact-us" className="underline">
              Contact support
            </Link>
          </p>
        </div>
      </div>

      {/* Component-scoped animations */}
      <style jsx>{`
        .confetti {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          opacity: 0.85;
          animation: confetti-fall 3.2s ease-in-out infinite;
        }
        .confetti.c1 {
          background: #34d399;
          top: 10%;
          left: 12%;
          animation-delay: 0s;
        }
        .confetti.c2 {
          background: #60a5fa;
          top: 16%;
          left: 78%;
          animation-delay: 0.2s;
        }
        .confetti.c3 {
          background: #fbbf24;
          top: 4%;
          left: 50%;
          animation-delay: 0.35s;
        }
        .confetti.c4 {
          background: #f87171;
          top: 20%;
          left: 30%;
          animation-delay: 0.5s;
        }
        .confetti.c5 {
          background: #a78bfa;
          top: 8%;
          left: 64%;
          animation-delay: 0.7s;
        }
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          100% {
            transform: translateY(120px) rotate(180deg);
          }
        }
      `}</style>
    </article>
  );
}