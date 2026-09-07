"use client";

// The member's locker and their recent shop receipts. Rendered only when
// there is something to show.

import React, { useEffect, useState } from "react";
import { getAuthHeader } from "@/helper/helper";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface Locker { id: string; number: string; zone: string; until: string | null; overdue: boolean; fee: number; currency: string }
interface Sale { id: string; receipt_number: string; items: { name: string; quantity: number }[]; total: number; currency: string; status: string; paid_at: string }

export const ShopSection: React.FC = () => {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    const get = (path: string) => fetch(`${API_BASE}${path}`, { headers: getAuthHeader() }).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] }));
    get("/user/locker").then((j) => setLockers(j.data || []));
    get("/user/purchases").then((j) => setSales(j.data || []));
  }, []);

  if (!lockers.length && !sales.length) return null;

  return (
    <section className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-6">
      <h2 className="text-xl font-bold text-black">Locker &amp; purchases</h2>
      {lockers.map((l) => (
        <p key={l.id} className="mt-2 text-sm text-gray-800">
          Your locker: <strong>{l.zone ? `${l.zone}-` : ""}{l.number}</strong>
          {l.until ? ` until ${l.until}` : ""}
          {l.overdue && <span className="ml-1 font-semibold text-red-600">— rental overdue, please see reception</span>}
        </p>
      ))}
      {sales.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {sales.slice(0, 10).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-mono text-xs text-gray-500">{s.receipt_number}</span> · {s.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
              </span>
              <span className="text-gray-700">
                {s.currency} {s.total.toLocaleString()} {s.status === "refunded" ? <span className="text-red-600">(refunded)</span> : null}
                <span className="ml-2 text-xs text-gray-400">{new Date(s.paid_at).toLocaleDateString()}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ShopSection;
