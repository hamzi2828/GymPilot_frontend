"use client";

import "@fortawesome/fontawesome-free/css/all.css";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import OrderSuccessCard from "./components/OrderSuccessCard";

function OrderSuccessContent() {
  const params = useSearchParams();
  const orderId = params.get("id") || "CRC-2024-001";
  const email = params.get("email") || "you@example.com";
  const total = Number(params.get("total")) || 25966;
  const eta = params.get("eta") || "3–5 business days";

  // Optional thumbnails to make the card pop
  const items = [
    { src: "/images/gym-2.svg", alt: "Item 1" },
    { src: "/images/gym-3.svg", alt: "Item 2" },
    { src: "/images/gym-4.svg", alt: "Item 3" },
  ];

  return <OrderSuccessCard orderId={orderId} email={email} total={total} eta={eta} items={items} />;
}

export default function OrderSuccessPage() {
  return (
    <main className="pt-24 bg-white">
      <section className="px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20">
        <Suspense fallback={<div className="text-center py-8">Loading order details...</div>}>
          <OrderSuccessContent />
        </Suspense>
      </section>
    </main>
  );
}