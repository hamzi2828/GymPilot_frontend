"use client";

import { useSyncExternalStore } from "react";
import { useSiteSettings } from "@/components/ThemeProvider";

// The gym's currency, as the admin pages label prices and fees with it.
//
// The site-wide settings (ThemeProvider) are read once, when the site first
// loads, so after the currency was changed in Settings the admin pages went on
// labelling fees in the old one until a reload. Settings and the setup wizard
// hand the currency the server now holds to setGymCurrency() whenever they
// read or save it; every page reading useGymCurrency() follows at once, and a
// page opened later in the same visit starts from it.
//
// It is the public settings' currency underneath, so a role without the
// Settings tab still gets it.

let latest = "";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The currency the server holds now, after Settings has read or saved it. */
export function setGymCurrency(code: string | null | undefined) {
  const next = String(code || "").trim().toUpperCase();
  if (!next || next === latest) return;
  latest = next;
  listeners.forEach((listener) => listener());
}

/** The gym's currency code, "" until it is known. */
export function useGymCurrency(): string {
  const { currency } = useSiteSettings();
  const saved = useSyncExternalStore(
    subscribe,
    () => latest,
    () => ""
  );
  return saved || currency;
}
