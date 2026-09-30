// What a printed receipt needs besides the sale: the gym's details and how
// it prints. The backend answers both in one call
// (GET /admin/pos/receipt-settings, posController.receiptSettings).

import { API_BASE, apiGet } from "@/app/(routes)/admin/_shared/api";
import { DEFAULT_RECEIPT_SETTINGS, type PaperWidth, type ReceiptBranding, type ReceiptSettings } from "./ThermalReceipt";

export const RECEIPT_SETTINGS_URL = `${API_BASE}/admin/pos/receipt-settings`;

/** The endpoint's `data`, as the backend spells it. */
export interface ReceiptSettingsResponse {
  receipt: { paper_width: PaperWidth; show_logo: boolean; footer_text: string };
  gym: { name: string; logo_url: string; address: string; phone: string; email: string; tax_label: string; tax_number: string; footer_note: string };
}

export interface ReceiptProfile {
  branding: ReceiptBranding;
  settings: ReceiptSettings;
}

export const EMPTY_RECEIPT_PROFILE: ReceiptProfile = { branding: { name: "" }, settings: DEFAULT_RECEIPT_SETTINGS };

export function toReceiptProfile(data: ReceiptSettingsResponse): ReceiptProfile {
  const r = data.receipt || ({} as ReceiptSettingsResponse["receipt"]);
  const g = data.gym || ({} as ReceiptSettingsResponse["gym"]);
  return {
    settings: {
      paperWidth: r.paper_width === "58mm" ? "58mm" : "80mm",
      showLogo: r.show_logo !== false,
      footerText: r.footer_text || "",
    },
    branding: {
      name: g.name || "",
      logoUrl: g.logo_url || "",
      address: g.address || "",
      phone: g.phone || "",
      email: g.email || "",
      taxLabel: g.tax_label || "Tax",
      taxNumber: g.tax_number || "",
      footerNote: g.footer_note || "",
    },
  };
}

/** Loads the receipt profile. `url` lets another screen read it through a route of its own. */
export async function loadReceiptProfile(url: string = RECEIPT_SETTINGS_URL): Promise<ReceiptProfile> {
  const res = await apiGet<{ data: ReceiptSettingsResponse }>(url);
  return toReceiptProfile(res.data);
}
