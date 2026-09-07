"use client";

// How the member wants to hear from the gym: which channels, whether they
// want offers, and push notifications on this device.

import React, { useCallback, useEffect, useState } from "react";
import { getAuthHeader } from "@/helper/helper";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface Prefs { email: boolean; sms: boolean; whatsapp: boolean; push: boolean; marketing: boolean }
interface Info { preferences: Prefs; phone: string; channels: Record<"email" | "sms" | "whatsapp" | "push", boolean>; push_public_key: string; push_devices: number }

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.message || "Request failed");
  return json;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export const NotificationsSection: React.FC = () => {
  const [info, setInfo] = useState<Info | null>(null);
  const [thisDevice, setThisDevice] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await call("/user/notification-preferences", "GET");
      setInfo(res.data);
      setThisDevice(!!(await currentSubscription()));
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setNotice(null);
    try {
      const message = await fn();
      if (message) setNotice({ tone: "ok", text: message });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  };

  const toggle = (key: keyof Prefs) => run(key, async () => {
    await call("/user/notification-preferences", "PUT", { [key]: !info?.preferences[key] });
    return "Saved.";
  });

  const enablePush = () => run("push-on", async () => {
    if (!info?.push_public_key) throw new Error("The gym has not switched push notifications on yet");
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser does not support push notifications");
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notifications were not allowed in the browser");
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(info.push_public_key) });
    await call("/user/push-subscriptions", "POST", { subscription: sub.toJSON() });
    return "This device will now receive notifications.";
  });

  const disablePush = () => run("push-off", async () => {
    const sub = await currentSubscription();
    if (sub) {
      await call("/user/push-subscriptions", "DELETE", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    return "Notifications are off on this device.";
  });

  if (!info) return null;

  const Row = ({ title, hint, action }: { title: string; hint: string; action: React.ReactNode }) => (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="max-w-xl">
        <p className="text-sm font-semibold text-black">{title}</p>
        <p className="text-sm text-gray-600">{hint}</p>
      </div>
      {action}
    </div>
  );
  const Switch = ({ on, k }: { on: boolean; k: keyof Prefs }) => (
    <button type="button" role="switch" aria-checked={on} disabled={busy === k} onClick={() => toggle(k)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${on ? "bg-black" : "bg-gray-300"}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
  const btn = "rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50";
  const p = info.preferences;

  return (
    <section className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-6" id="notifications">
      <h2 className="text-xl font-bold text-black">Notifications</h2>
      {notice && <p className={`mt-3 rounded-lg px-4 py-2 text-sm ${notice.tone === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{notice.text}</p>}
      <div className="mt-2 divide-y divide-gray-100">
        <Row title="Email" hint="Booking confirmations, receipts and reminders by email." action={<Switch on={p.email} k="email" />} />
        {info.channels.sms && <Row title="SMS" hint={info.phone ? `Texts to ${info.phone}.` : "Add a phone number to your profile to receive texts."} action={<Switch on={p.sms} k="sms" />} />}
        {info.channels.whatsapp && <Row title="WhatsApp" hint={info.phone ? `Messages to ${info.phone} on WhatsApp.` : "Add a phone number to your profile to receive WhatsApp messages."} action={<Switch on={p.whatsapp} k="whatsapp" />} />}
        {info.push_public_key && (
          <Row
            title="Push notifications"
            hint={thisDevice ? "On for this device. You can also switch push off for every device below." : `Get reminders on this phone or computer even when the site is closed.${info.push_devices ? ` Currently on for ${info.push_devices} device(s).` : ""}`}
            action={
              <div className="flex items-center gap-3">
                <Switch on={p.push} k="push" />
                {thisDevice ? (
                  <button type="button" disabled={busy === "push-off"} className={btn} onClick={disablePush}>Turn off here</button>
                ) : (
                  <button type="button" disabled={busy === "push-on"} className={btn} onClick={enablePush}>Enable on this device</button>
                )}
              </div>
            }
          />
        )}
        <Row title="Offers and news" hint="Occasional promotions, new classes and newsletters. Turning this off never affects booking or payment notices." action={<Switch on={p.marketing} k="marketing" />} />
      </div>
    </section>
  );
};

export default NotificationsSection;
