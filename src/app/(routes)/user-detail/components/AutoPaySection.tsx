"use client";

// "Automatic payments": the card a member saved when paying online, charged
// on each due date with their consent. Only a reference to the card is kept
// (the gateway holds the card itself). Turning it off removes the card and
// stops the charges at once; the member then pays from the payment link each
// reminder carries. Hidden when the gym's API has no saved cards, and for a
// member who never saved one.

import React, { useCallback, useEffect, useRef, useState } from "react";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";
import { SessionEndedError, getSavedMethods, removeSavedMethod, type SavedMethod } from "../service/userDetailService";

const btn = "inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50";

function brandName(brand: string) {
  const b = (brand || "").trim();
  if (!b) return "Card";
  const known: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", unionpay: "UnionPay", paypak: "PayPak" };
  return known[b.toLowerCase()] || b.charAt(0).toUpperCase() + b.slice(1);
}

function expiry(m: SavedMethod) {
  if (!m.exp_month || !m.exp_year) return null;
  return `${String(m.exp_month).padStart(2, "0")}/${String(m.exp_year).slice(-2)}`;
}

function dateLabel(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export const AutoPaySection: React.FC<{ onSessionEnded?: () => void }> = ({ onSessionEnded }) => {
  // null: not known yet, or this gym has no saved cards at all.
  const [methods, setMethods] = useState<SavedMethod[] | null>(null);
  const [offered, setOffered] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const { busyKey: busy, run } = useAsyncAction();
  // Held, not depended on: the page hands a new function every render.
  const sessionEnded = useRef(onSessionEnded);
  useEffect(() => {
    sessionEnded.current = onSessionEnded;
  }, [onSessionEnded]);

  const load = useCallback(async () => {
    try {
      const list = await getSavedMethods();
      setOffered(list !== null);
      setMethods(list || []);
      setLoadError(null);
    } catch (e) {
      if (e instanceof SessionEndedError) {
        sessionEnded.current?.();
        return;
      }
      setLoadError(e instanceof Error ? e.message : "We could not load your saved card.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = (m: SavedMethod) =>
    run(async () => {
      setNotice(null);
      try {
        const message = await removeSavedMethod(m.id);
        setConfirming(null);
        setNotice({ tone: "ok", text: message });
        await load();
      } catch (e) {
        if (e instanceof SessionEndedError) {
          sessionEnded.current?.();
          return;
        }
        setNotice({ tone: "error", text: e instanceof Error ? e.message : "We could not remove your card. Please try again." });
      }
    }, `remove-${m.id}`);

  // Nothing to show: no saved cards at this gym, or none saved and nothing
  // just done. A first load that failed shows nothing either: most members
  // never saved a card, and the membership above says when the server is out
  // of reach.
  if (!offered || !methods || (!methods.length && !notice && !loadError)) return null;

  return (
    <section className="mt-10 rounded-2xl border-2 border-gray-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-bold text-black">Automatic payments</h2>
      <p className="mt-1 text-sm text-gray-600">Your saved card is charged on each due date. The card itself is kept by the payment company, never by the gym.</p>

      {notice && <p className={`mt-4 rounded-lg px-4 py-2 text-sm ${notice.tone === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{notice.text}</p>}

      {loadError && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{loadError}</span>
          <button type="button" disabled={busy === "reload"} aria-busy={busy === "reload" || undefined} onClick={() => run(load, "reload")} className="inline-flex items-center gap-2 font-semibold underline underline-offset-2 disabled:opacity-50">
            {busy === "reload" && <Spinner />}
            Try again
          </button>
        </div>
      )}

      {methods && methods.length === 0 && notice?.tone === "ok" && (
        <p className="mt-4 text-sm text-gray-600">No card is saved. Before each due date you get a payment link to pay online or by bank transfer.</p>
      )}

      <div className="mt-2 divide-y divide-gray-100">
        {(methods || []).map((m) => {
          const exp = expiry(m);
          const agreed = dateLabel(m.consent_at);
          return (
            <div key={m.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600">
                    <i className="fas fa-credit-card" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-black">
                      {brandName(m.brand)} •••• {m.last4 || "----"}
                      {exp && <span className="ml-2 font-normal text-gray-500">Expires {exp}</span>}
                    </p>
                    <p className="text-sm text-gray-600">
                      Automatic payments: <strong className={m.auto_pay ? "text-green-700" : "text-gray-700"}>{m.auto_pay ? "On" : "Off"}</strong>
                      {agreed && ` · you agreed on ${agreed}`}
                    </p>
                  </div>
                </div>
                <button type="button" disabled={!!busy || confirming === m.id} className={btn} onClick={() => { setNotice(null); setConfirming(m.id); }}>
                  {m.auto_pay ? "Turn off" : "Remove card"}
                </button>
              </div>

              {confirming === m.id && (
                <div className="mt-4 rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">{m.auto_pay ? "Turn off automatic payments and remove this card?" : "Remove this card?"}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Nothing more is charged to it, starting now. Before each due date you get a payment link to pay online or by bank transfer instead.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!busy}
                      aria-busy={busy === `remove-${m.id}` || undefined}
                      onClick={() => remove(m)}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === `remove-${m.id}` && <Spinner />}
                      {busy === `remove-${m.id}` ? "Removing…" : m.auto_pay ? "Turn off and remove card" : "Remove card"}
                    </button>
                    <button type="button" disabled={busy === `remove-${m.id}`} className={btn} onClick={() => setConfirming(null)}>
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default AutoPaySection;
