"use client";

// The member's check-in QR code. Freshly signed each time this opens and
// valid for two days, so the code on their phone quietly rotates; the
// member number underneath is the fallback for a kiosk without a camera.

import React, { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { getAuthHeader } from "@/helper/helper";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface QrPayload {
  token: string;
  expires_at: string;
  person_type: string;
  code: string;
  name: string;
}

export const CheckInSection: React.FC = () => {
  const [data, setData] = useState<QrPayload | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/attendance/me/qr`, { headers: getAuthHeader() });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Could not load your check-in code");
      setData(json.data);
      setImage(await QRCode.toDataURL(json.data.token, { width: 320, margin: 1, errorCorrectionLevel: "M" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your check-in code");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border-2 border-gray-200 bg-white p-6 sm:p-8">
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
          <div className="mx-auto">
            {loading ? (
              <div className="flex h-[320px] w-[320px] items-center justify-center rounded-2xl bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="Your check-in QR code" className="h-[320px] w-[320px] rounded-2xl border border-gray-200" />
            ) : (
              <div className="flex h-[320px] w-[320px] items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-500">{error || "No code"}</div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Check in at the door</p>
            <h2 className="mt-1 text-2xl font-bold text-black">Show this at the kiosk</h2>
            <p className="mt-2 text-sm text-gray-600">
              Hold the code in front of the camera at reception to check in and out. No camera? Type your member number instead.
            </p>
            {data && (
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Member number</dt>
                  <dd className="mt-1 text-2xl font-bold tracking-wider text-primary">{data.code || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Code refreshes</dt>
                  <dd className="mt-1 text-sm font-semibold text-black">{new Date(data.expires_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</dd>
                </div>
              </dl>
            )}
            {error && !loading && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <button type="button" onClick={load} className="mt-6 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <i className="fas fa-rotate mr-2" />Refresh code
            </button>
          </div>
        </div>
      </section>
      <p className="text-xs text-gray-500">The code is tied to your account and expires within two days; a screenshot will stop working after that.</p>
    </div>
  );
};

export default CheckInSection;
