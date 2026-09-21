"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiBriefcase, FiCalendar, FiDollarSign, FiGlobe, FiUsers } from "react-icons/fi";
import Image from "next/image";
import {
  PageHeader,
  Card,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  TextField,
  TextArea,
  Toggle,
  Badge,
  Spinner,
  Modal,
  Select2,
} from "../_shared/ui";
import { countryOptions, currencyOptions, countryByCode } from "@/data/countries";
import { API_BASE, apiGet, apiJson, authHeaders } from "../_shared/api";
import { THEMES, DEFAULT_THEME_KEY } from "@/theme/themes";
import { setActiveTheme } from "@/components/ThemeProvider";
import MessagingSettings, { type MessagingConfig } from "./MessagingSettings";
import WebsiteSettings from "./WebsiteSettings";
import BillingSettings from "./BillingSettings";

interface StripeConfig {
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  enabled?: boolean;
  secretKeySet?: boolean;
  webhookSecretSet?: boolean;
}

interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  fromName?: string;
  fromEmail?: string;
  passSet?: boolean;
}

interface InvoiceConfig {
  prefix?: string;
  taxLabel?: string;
  taxNumber?: string;
  footerNote?: string;
}

interface MembershipConfig {
  waiver?: { required?: boolean; version?: string; text?: string };
  allowMemberFreeze?: boolean;
  maxFreezeDays?: number;
  allowMemberCancel?: boolean;
}

interface Settings {
  _id?: string;
  siteName?: string;
  currency?: string;
  country?: string;
  taxRate?: number;
  ianaTimezone?: string;
  gymSlug?: string | null;
  stripeWebhookUrl?: string;
  invoice?: InvoiceConfig;
  membership?: MembershipConfig;
  siteDescription?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  theme?: string;
  logoUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  footerLogoUrl?: string;
  footerLogoWidth?: number;
  footerLogoHeight?: number;
  stripe?: StripeConfig;
  smtp?: SmtpConfig;
  messaging?: MessagingConfig;
  seo?: { title?: string; description?: string; keywords?: string; ogImage?: string };
  maps?: { embedUrl?: string; placeUrl?: string; latitude?: number | null; longitude?: number | null };
  openingHours?: { day: string; open: string; close: string; closed: boolean }[];
  locale?: { language?: string; direction?: "ltr" | "rtl" };
  siteUrl?: string;
  booking?: { horizonDays?: number; cutoffMinutes?: number; cancelHours?: number; requireActiveMembership?: boolean; useCredits?: boolean; noShowStrikes?: number; noShowWindowDays?: number; noShowBanDays?: number; autoNoShow?: boolean };
  pt?: { slotMinutes?: number; defaultCommissionPercent?: number; allowMemberBooking?: boolean; requirePack?: boolean; cancelHours?: number; horizonDays?: number };
  rooms?: string[];
}

interface Bank {
  _id: string;
  name: string;
  accountNumber: string;
  accountTitle: string;
  branch?: string;
  iban?: string;
  notes?: string;
  qrCodeUrl?: string;
  isActive?: boolean;
}

const SETTINGS_API = `${API_BASE}/settings`;

// Built once: ~120 countries and ~170 currencies, named by the browser.
const COUNTRY_OPTIONS = countryOptions();
const CURRENCY_OPTIONS = currencyOptions();

/** Uploaded assets are stored as backend-relative /uploads paths (or absolute
 *  blob URLs); bundled /images assets are served by Next itself. */
function absoluteAsset(url: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/uploads")) return `${API_BASE}${url}`;
  return url;
}
const BANKS_API = `${API_BASE}/banks`;

type TabKey = "general" | "logo" | "stripe" | "smtp" | "messaging" | "banks" | "theme" | "billing";

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: "general", label: "General", hint: "Business, money and time, memberships, bookings, website" },
  { key: "logo", label: "Logo", hint: "Header and footer branding" },
  { key: "stripe", label: "Stripe", hint: "Payment gateway credentials" },
  { key: "smtp", label: "SMTP", hint: "Outbound email configuration" },
  { key: "messaging", label: "Messaging", hint: "SMS, WhatsApp, push and automations" },
  { key: "banks", label: "Banks", hint: "Bank accounts and payment barcodes" },
  { key: "theme", label: "Colour Scheme", hint: "Public site palette" },
  { key: "billing", label: "Billing", hint: "Your GymPilot plan and payments" },
];

// The General tab is five screens, not one long one. The active section
// lives in the URL beside the tab (?tab=general&section=money).
type SectionKey = "business" | "money" | "members" | "bookings" | "website";

const GENERAL_SECTIONS: { key: SectionKey; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "business", label: "Business", hint: "Name, contact details, social links", icon: FiBriefcase },
  { key: "money", label: "Money & time", hint: "Country, currency, tax, clock, invoices", icon: FiDollarSign },
  { key: "members", label: "Memberships", hint: "Self-service and the signed agreement", icon: FiUsers },
  { key: "bookings", label: "Bookings & PT", hint: "Class rules, personal training, rooms", icon: FiCalendar },
  { key: "website", label: "Website", hint: "Language, search, map, opening hours", icon: FiGlobe },
];

function isSectionKey(v: string | null): v is SectionKey {
  return !!v && GENERAL_SECTIONS.some((s) => s.key === v);
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {hint && <p className="text-xs text-neutral-500 mt-1">{hint}</p>}
    </div>
  );
}

function Notice({
  tone,
  children,
  onDismiss,
}: {
  tone: "ok" | "warn" | "error";
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const styles = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
  }[tone];
  return (
    <div className={`mb-5 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <span className="min-w-0">{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

function isTabKey(v: string | null): v is TabKey {
  return !!v && TABS.some((t) => t.key === v);
}

function SettingsAdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The active tab lives in the URL so it survives a refresh and can be linked
  // to directly (e.g. /admin/settings?tab=smtp).
  const urlTab = searchParams.get("tab");
  const tab: TabKey = isTabKey(urlTab) ? urlTab : "general";

  const setTab = (next: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/admin/settings?${params.toString()}`, { scroll: false });
  };
  const urlSection = searchParams.get("section");
  const section: SectionKey = isSectionKey(urlSection) ? urlSection : "business";
  const setSection = (next: SectionKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "general");
    params.set("section", next);
    router.replace(`/admin/settings?${params.toString()}`, { scroll: false });
  };
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);

  // Banks
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankModal, setBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const emptyBank = { name: "", accountNumber: "", accountTitle: "", branch: "", iban: "", notes: "" };
  const [bankDraft, setBankDraft] = useState<typeof emptyBank>(emptyBank);
  const [bankErr, setBankErr] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState<"logo" | "footerLogo" | null>(null);

  // Logo uploads are multipart, so they bypass the JSON apiJson helper. The
  // browser must set the boundary itself, hence no Content-Type here.
  const uploadLogo = async (which: "logo" | "footerLogo", file: File) => {
    setLogoUploading(which);
    setNotice(null);
    try {
      const form = new FormData();
      form.append(which, file);
      const path = which === "logo" ? "logo" : "footer-logo";
      const res = await fetch(`${SETTINGS_API}/${path}`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Upload failed");
      await load();
      setNotice({ tone: "ok", text: "Logo updated. It is live on the site immediately." });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Logo upload failed" });
    } finally {
      setLogoUploading(null);
    }
  };

  const removeLogo = async (which: "logo" | "footerLogo") => {
    try {
      await apiJson(`${SETTINGS_API}/${which === "logo" ? "logo" : "footer-logo"}`, "DELETE");
      await load();
      setNotice({ tone: "ok", text: "Logo removed." });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not remove the logo" });
    }
  };
  // A barcode can be chosen in the dialog before the bank exists; it is held
  // here and uploaded straight after the account is created.
  const [pendingBarcode, setPendingBarcode] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [savingBank, setSavingBank] = useState(false);

  const choosePendingBarcode = (file: File | null) => {
    setPendingBarcode(file);
    setPendingPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  // A failed read keeps whatever was already on screen and says so. It used
  // to swap in an empty form, and saving that would have written blanks over
  // the gym's real settings.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data?: Settings; settings?: Settings }>(SETTINGS_API);
      setSettings(r.data || r.settings || {});
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBanks = useCallback(async () => {
    setBanksLoading(true);
    try {
      const r = await apiGet<{ data?: Bank[]; banks?: Bank[] }>(BANKS_API);
      setBanks(r.data || r.banks || []);
    } catch {
      setBanks([]);
    } finally {
      setBanksLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "banks") loadBanks();
  }, [tab, loadBanks]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await apiJson<{ warnings?: string[] }>(SETTINGS_API, "PUT", settings);
      await load();
      // The save can succeed while refusing part of it (a secret field whose
      // masked value was edited is kept as it was); say which part.
      const warnings = Array.isArray(res?.warnings) ? res.warnings.filter(Boolean) : [];
      setNotice(
        warnings.length
          ? { tone: "warn", text: `Settings saved, with warnings: ${warnings.join(" ")}` }
          : { tone: "ok", text: "Settings saved." }
      );
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const testSmtp = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await apiJson(`${SETTINGS_API}/test-smtp`, "POST");
      setNotice({ tone: "ok", text: "SMTP connection verified — outgoing email is working." });
    } catch (e) {
      setNotice({
        tone: "error",
        text: `SMTP test failed: ${e instanceof Error ? e.message : "unknown error"}. Save your credentials first, then retry.`,
      });
    } finally {
      setSaving(false);
    }
  };

  // ---- Banks ----
  const openBank = (b?: Bank) => {
    setEditingBank(b || null);
    setBankDraft(
      b
        ? {
            name: b.name,
            accountNumber: b.accountNumber,
            accountTitle: b.accountTitle,
            branch: b.branch || "",
            iban: b.iban || "",
            notes: b.notes || "",
          }
        : emptyBank
    );
    setBankErr(null);
    choosePendingBarcode(null);
    setBankModal(true);
  };

  const saveBank = async () => {
    if (!bankDraft.name.trim() || !bankDraft.accountNumber.trim() || !bankDraft.accountTitle.trim()) {
      setBankErr("Bank name, account number and account title are required.");
      return;
    }
    setSavingBank(true);
    try {
      let bankId = editingBank?._id;
      if (editingBank) {
        await apiJson(`${BANKS_API}/${editingBank._id}`, "PUT", bankDraft);
      } else {
        // The barcode endpoint needs an id, so the account is created first and
        // the chosen image is attached immediately afterwards.
        const created = await apiJson<{ data?: Bank }>(BANKS_API, "POST", bankDraft);
        bankId = created?.data?._id;
      }

      if (pendingBarcode && bankId) {
        try {
          await postBarcode(bankId, pendingBarcode);
        } catch (err) {
          // The account saved fine; only the image failed, so say so rather
          // than implying nothing was saved.
          setNotice({
            tone: "warn",
            text: `Bank saved, but the barcode upload failed: ${
              err instanceof Error ? err.message : "unknown error"
            }. You can retry it from the list.`,
          });
        }
      }

      setBankModal(false);
      choosePendingBarcode(null);
      await loadBanks();
    } catch (e) {
      setBankErr(e instanceof Error ? e.message : "Could not save the bank.");
    } finally {
      setSavingBank(false);
    }
  };

  const deleteBank = async (id: string) => {
    if (!confirm("Delete this bank account?")) return;
    try {
      await apiJson(`${BANKS_API}/${id}`, "DELETE");
      await loadBanks();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Delete failed" });
    }
  };

  // Uses fetch directly: the shared apiJson helper sends JSON, and this is
  // multipart. authHeaders() supplies the bearer token without a Content-Type,
  // which the browser must set itself so the multipart boundary is correct.
  const postBarcode = async (bankId: string, file: File) => {
    const form = new FormData();
    form.append("qrCode", file);
    const res = await fetch(`${BANKS_API}/${bankId}/qr-code`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || "Upload failed");
    return json;
  };

  const uploadBarcode = async (bankId: string, file: File) => {
    setUploadingFor(bankId);
    setNotice(null);
    try {
      await postBarcode(bankId, file);
      await loadBanks();
      setNotice({ tone: "ok", text: "Barcode uploaded." });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Barcode upload failed" });
    } finally {
      setUploadingFor(null);
    }
  };

  const removeBarcode = async (bankId: string) => {
    try {
      await apiJson(`${BANKS_API}/${bankId}/qr-code`, "DELETE");
      await loadBanks();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not remove barcode" });
    }
  };

  const tabStrip = (
    <div className="mb-6 border-b border-neutral-200">
      <div className="flex gap-1 overflow-x-auto -mb-px">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setNotice(null);
              }}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Billing reads its own endpoint, so it neither waits for the settings
  // document nor goes away when that fails to load.
  if (tab === "billing") {
    return (
      <div>
        <PageHeader title="Settings" />
        {tabStrip}
        <BillingSettings />
      </div>
    );
  }

  if (loading) return <Spinner />;

  if (!settings) {
    return (
      <div>
        <PageHeader title="Settings" />
        {tabStrip}
        <Card className="p-6">
          <p className="text-sm font-semibold text-neutral-900">The settings could not be loaded</p>
          <p className="mt-1 text-xs text-neutral-500">{loadError || "Please try again in a moment."}</p>
          <div className="mt-4">
            <SecondaryButton onClick={load}>Try again</SecondaryButton>
          </div>
        </Card>
      </div>
    );
  }

  const stripe = settings.stripe || {};
  const smtp = settings.smtp || {};
  const setStripe = (patch: Partial<StripeConfig>) =>
    setSettings({ ...settings, stripe: { ...stripe, ...patch } });
  const setSmtp = (patch: Partial<SmtpConfig>) =>
    setSettings({ ...settings, smtp: { ...smtp, ...patch } });

  return (
    <div>
      <PageHeader
        title="Settings"
        actions={
          tab === "general" ? (
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </PrimaryButton>
          ) : undefined
        }
      />

      {/* Tabs */}
      {tabStrip}

      {/* The last reload failed: what is on screen is the previous copy. */}
      {loadError && (
        <Notice tone="error" onDismiss={() => setLoadError(null)}>
          Could not reload the settings ({loadError}). What you see may be out of date — refresh the page before saving.
        </Notice>
      )}

      {notice && (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {/* ---------------- General ---------------- */}
      {tab === "general" && (
        <div className="lg:grid lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-8">
          {/* Section navigation: a strip on small screens, a column on large ones. */}
          <nav aria-label="General settings sections" className="mb-5 lg:mb-0">
            <div className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-2 lg:flex-col lg:pb-0">
              {GENERAL_SECTIONS.map((sec) => {
                const active = section === sec.key;
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => setSection(sec.key)}
                    aria-current={active ? "page" : undefined}
                    className={`flex shrink-0 items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-white" : "text-neutral-400"}`} />
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-sm font-medium">{sec.label}</span>
                      <span className={`hidden text-xs lg:block ${active ? "text-neutral-300" : "text-neutral-500"}`}>{sec.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="min-w-0 space-y-6">
            {section === "business" && (
              <>
                <Card className="p-6">
                  <SectionHeading title="Business Information" hint="Shown across the public site, the admin panel and in emails." />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <TextField label="Business Name" value={settings.siteName} onChange={(v) => setSettings({ ...settings, siteName: v })} />
                    <TextField label="Contact Email" type="email" value={settings.contactEmail} onChange={(v) => setSettings({ ...settings, contactEmail: v })} />
                    <TextField label="Contact Phone" value={settings.contactPhone} onChange={(v) => setSettings({ ...settings, contactPhone: v })} />
                    <div className="md:col-span-2 xl:col-span-3">
                      <TextField label="Address" value={settings.address} onChange={(v) => setSettings({ ...settings, address: v })} />
                    </div>
                    <div className="md:col-span-2 xl:col-span-3">
                      <TextArea label="Site Description" value={settings.siteDescription} onChange={(v) => setSettings({ ...settings, siteDescription: v })} />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <SectionHeading title="Social Links" hint="Shown in the website footer. Leave blank to hide a network." />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <TextField label="Facebook" value={settings.facebook} onChange={(v) => setSettings({ ...settings, facebook: v })} />
                    <TextField label="Instagram" value={settings.instagram} onChange={(v) => setSettings({ ...settings, instagram: v })} />
                    <TextField label="Twitter" value={settings.twitter} onChange={(v) => setSettings({ ...settings, twitter: v })} />
                    <TextField label="YouTube" value={settings.youtube} onChange={(v) => setSettings({ ...settings, youtube: v })} />
                    <TextField label="LinkedIn" value={settings.linkedin} onChange={(v) => setSettings({ ...settings, linkedin: v })} />
                  </div>
                </Card>
              </>
            )}

            {section === "money" && (
              <>
                <Card className="p-6">
                  <SectionHeading title="Country, currency, tax & time" hint="Pick your country and the currency and clock fill in. Prices everywhere — memberships, classes, shop, payslips — are shown and charged in this currency. Tax is treated as included in your prices and shown on invoices." />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                      <span className="text-xs font-medium text-neutral-600">Country</span>
                      <div className="mt-1">
                        <Select2
                          ariaLabel="Country"
                          value={settings.country || undefined}
                          onChange={(code) => {
                            const c = countryByCode(code);
                            setSettings({
                              ...settings,
                              country: code,
                              currency: c ? c.currency : settings.currency,
                              ianaTimezone: settings.ianaTimezone && settings.ianaTimezone !== "UTC" ? settings.ianaTimezone : c ? c.timezone : settings.ianaTimezone,
                            });
                          }}
                          options={COUNTRY_OPTIONS}
                          placeholder="Choose your country"
                          searchPlaceholder="Type a country…"
                          allowClear
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-neutral-600">Currency</span>
                      <div className="mt-1">
                        <Select2 ariaLabel="Currency" value={settings.currency || undefined} onChange={(v) => setSettings({ ...settings, currency: v })} options={CURRENCY_OPTIONS} placeholder="Choose a currency" searchPlaceholder="Code or name…" />
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-500">Applies to every price in the gym.</p>
                    </label>
                    <TextField label="Tax rate included in prices (%)" type="number" value={settings.taxRate} onChange={(v) => setSettings({ ...settings, taxRate: Number(v) || 0 })} />
                    <TextField label="Timezone (IANA)" value={settings.ianaTimezone} onChange={(v) => setSettings({ ...settings, ianaTimezone: v })} placeholder="Europe/London" />
                  </div>
                </Card>

                <Card className="p-6">
                  <SectionHeading title="Invoices" hint="Issued automatically when a membership is paid and attached to the confirmation email." />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <TextField label="Number prefix" value={settings.invoice?.prefix ?? "INV"} onChange={(v) => setSettings({ ...settings, invoice: { ...(settings.invoice || {}), prefix: v.toUpperCase() } })} />
                    <TextField label="Tax label" value={settings.invoice?.taxLabel ?? "Tax"} onChange={(v) => setSettings({ ...settings, invoice: { ...(settings.invoice || {}), taxLabel: v } })} placeholder="VAT, GST, Sales tax" />
                    <TextField label="Tax registration number" value={settings.invoice?.taxNumber ?? ""} onChange={(v) => setSettings({ ...settings, invoice: { ...(settings.invoice || {}), taxNumber: v } })} />
                    <div className="md:col-span-3">
                      <TextArea label="Invoice footer note" value={settings.invoice?.footerNote ?? ""} onChange={(v) => setSettings({ ...settings, invoice: { ...(settings.invoice || {}), footerNote: v } })} />
                    </div>
                  </div>
                </Card>
              </>
            )}

            {section === "members" && (
              <>
                <Card className="p-6">
                  <SectionHeading title="Membership self-service" hint="What members may do to their own membership from their account page." />
                  <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
                    <Toggle label="Members can freeze online" checked={settings.membership?.allowMemberFreeze !== false} onChange={(v) => setSettings({ ...settings, membership: { ...(settings.membership || {}), allowMemberFreeze: v } })} />
                    <TextField label="Max freeze days per request" type="number" value={settings.membership?.maxFreezeDays ?? 30} onChange={(v) => setSettings({ ...settings, membership: { ...(settings.membership || {}), maxFreezeDays: Number(v) || 30 } })} />
                    <Toggle label="Members can cancel online" checked={settings.membership?.allowMemberCancel !== false} onChange={(v) => setSettings({ ...settings, membership: { ...(settings.membership || {}), allowMemberCancel: v } })} />
                  </div>
                </Card>

                <Card className="p-6">
                  <SectionHeading title="Membership agreement (waiver)" hint="Members sign it by typing their name in their profile; staff can record a paper signature from Users → Profile. Change the version to ask everyone to sign again." />
                  <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
                    <Toggle label="Members must sign before training" checked={!!settings.membership?.waiver?.required} onChange={(v) => setSettings({ ...settings, membership: { ...(settings.membership || {}), waiver: { ...(settings.membership?.waiver || {}), required: v } } })} />
                    <TextField label="Agreement version" value={settings.membership?.waiver?.version ?? "1.0"} onChange={(v) => setSettings({ ...settings, membership: { ...(settings.membership || {}), waiver: { ...(settings.membership?.waiver || {}), version: v } } })} />
                    <div className="md:col-span-3">
                      <TextArea label="Agreement text" value={settings.membership?.waiver?.text ?? ""} onChange={(v) => setSettings({ ...settings, membership: { ...(settings.membership || {}), waiver: { ...(settings.membership?.waiver || {}), text: v } } })} placeholder="I understand that exercise carries risks…" />
                    </div>
                  </div>
                </Card>
              </>
            )}

            {section === "bookings" && (
              <>
                <Card className="p-6">
                  <SectionHeading title="Class booking rules" hint="How far ahead members can book, when booking closes, cancellations and no-shows. Leave as they are to keep today's behaviour." />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <TextField label="Book up to (days ahead)" type="number" value={settings.booking?.horizonDays ?? 30} onChange={(v) => setSettings({ ...settings, booking: { ...(settings.booking || {}), horizonDays: Number(v) || 30 } })} />
                    <TextField label="Booking closes (minutes before start)" type="number" value={settings.booking?.cutoffMinutes ?? 15} onChange={(v) => setSettings({ ...settings, booking: { ...(settings.booking || {}), cutoffMinutes: Number(v) || 0 } })} />
                    <TextField label="Cancel-by window (hours before; later = credit lost)" type="number" value={settings.booking?.cancelHours ?? 2} onChange={(v) => setSettings({ ...settings, booking: { ...(settings.booking || {}), cancelHours: Number(v) || 0 } })} />
                    <TextField label="No-shows before booking is paused (0 = never)" type="number" value={settings.booking?.noShowStrikes ?? 0} onChange={(v) => setSettings({ ...settings, booking: { ...(settings.booking || {}), noShowStrikes: Number(v) || 0 } })} />
                    <TextField label="…counted over (days)" type="number" value={settings.booking?.noShowWindowDays ?? 30} onChange={(v) => setSettings({ ...settings, booking: { ...(settings.booking || {}), noShowWindowDays: Number(v) || 30 } })} />
                    <TextField label="…paused for (days)" type="number" value={settings.booking?.noShowBanDays ?? 7} onChange={(v) => setSettings({ ...settings, booking: { ...(settings.booking || {}), noShowBanDays: Number(v) || 7 } })} />
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 border-t border-neutral-100 pt-5 md:grid-cols-3">
                    <Toggle label="Only members with a live membership can book" checked={!!settings.booking?.requireActiveMembership} onChange={(v) => setSettings({ ...settings, booking: { ...(settings.booking || {}), requireActiveMembership: v } })} />
                    <Toggle label="Class packs: a booking uses one session credit" checked={settings.booking?.useCredits !== false} onChange={(v) => setSettings({ ...settings, booking: { ...(settings.booking || {}), useCredits: v } })} />
                    <Toggle label="Mark unattended bookings as no-shows the next day" checked={!!settings.booking?.autoNoShow} onChange={(v) => setSettings({ ...settings, booking: { ...(settings.booking || {}), autoNoShow: v } })} />
                  </div>
                </Card>

                <Card className="p-6">
                  <SectionHeading title="Personal training" hint="Trainers' availability comes from the Trainers screen; sessions are booked in the member portal or under Fitness → Personal Training." />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TextField label="Session length (minutes)" type="number" value={settings.pt?.slotMinutes ?? 60} onChange={(v) => setSettings({ ...settings, pt: { ...(settings.pt || {}), slotMinutes: Number(v) || 60 } })} />
                    <TextField label="Default trainer commission (%)" type="number" value={settings.pt?.defaultCommissionPercent ?? 0} onChange={(v) => setSettings({ ...settings, pt: { ...(settings.pt || {}), defaultCommissionPercent: Number(v) || 0 } })} />
                    <TextField label="Cancel-by window (hours before)" type="number" value={settings.pt?.cancelHours ?? 12} onChange={(v) => setSettings({ ...settings, pt: { ...(settings.pt || {}), cancelHours: Number(v) || 0 } })} />
                    <TextField label="Book up to (days ahead)" type="number" value={settings.pt?.horizonDays ?? 30} onChange={(v) => setSettings({ ...settings, pt: { ...(settings.pt || {}), horizonDays: Number(v) || 30 } })} />
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 border-t border-neutral-100 pt-5 md:grid-cols-2">
                    <Toggle label="Members can book sessions online" checked={settings.pt?.allowMemberBooking !== false} onChange={(v) => setSettings({ ...settings, pt: { ...(settings.pt || {}), allowMemberBooking: v } })} />
                    <Toggle label="A PT pack is required to book" checked={!!settings.pt?.requirePack} onChange={(v) => setSettings({ ...settings, pt: { ...(settings.pt || {}), requirePack: v } })} />
                  </div>
                </Card>

                <Card className="p-6">
                  <SectionHeading title="Rooms / studios" hint="Where classes happen. Each class picks one of these; the timetable shows it." />
                  <TextField label="Rooms / studios (comma separated)" value={(settings.rooms || []).join(", ")} onChange={(v) => setSettings({ ...settings, rooms: v.split(",").map((r) => r.trim()).filter(Boolean) })} placeholder="Studio A, Studio B, Spin room" />
                </Card>
              </>
            )}

            {section === "website" && <WebsiteSettings settings={settings} setSettings={setSettings} />}

            <p className="text-xs text-neutral-500">One save (top right) covers every section of General.</p>
          </div>
        </div>
      )}

      {/* ---------------- Logo ---------------- */}
      {tab === "logo" && (
        <Card className="p-6">
          <SectionHeading
            title="Branding"
            hint="Uploaded logos appear in the site header and footer straight away — no redeploy needed."
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {([
            {
              key: "logo" as const,
              title: "Header Logo",
              hint: "Shown in the top navigation on every page.",
              url: settings.logoUrl,
              w: settings.logoWidth,
              h: settings.logoHeight,
              wKey: "logoWidth" as const,
              hKey: "logoHeight" as const,
            },
            {
              key: "footerLogo" as const,
              title: "Footer Logo",
              hint: "Optional. Falls back to the header logo when empty.",
              url: settings.footerLogoUrl,
              w: settings.footerLogoWidth,
              h: settings.footerLogoHeight,
              wKey: "footerLogoWidth" as const,
              hKey: "footerLogoHeight" as const,
            },
          ]).map((slot, idx) => (
            <div key={slot.key} className={idx > 0 ? "border-t border-neutral-200 pt-6 xl:border-t-0 xl:pt-0" : ""}>
              <h3 className="text-sm font-semibold text-neutral-900">{slot.title}</h3>
              <p className="mb-3 mt-0.5 text-xs text-neutral-500">{slot.hint}</p>

              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 p-4">
                {/* Checkerboard reveals transparent PNG edges. */}
                <div
                  className="flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg,#f3f4f6 25%,transparent 25%),linear-gradient(-45deg,#f3f4f6 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f3f4f6 75%),linear-gradient(-45deg,transparent 75%,#f3f4f6 75%)",
                    backgroundSize: "12px 12px",
                    backgroundPosition: "0 0,0 6px,6px -6px,-6px 0px",
                  }}
                >
                  {slot.url ? (
                    <Image
                      src={absoluteAsset(slot.url)}
                      alt={`${slot.title} preview`}
                      width={160}
                      height={80}
                      className="max-h-full max-w-full object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="text-[11px] text-neutral-400">No logo set</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50">
                      {logoUploading === slot.key ? "Uploading…" : slot.url ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        disabled={logoUploading === slot.key}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (f.size > 5 * 1024 * 1024) {
                              setNotice({ tone: "error", text: "Logo must be 5MB or smaller." });
                            } else {
                              uploadLogo(slot.key, f);
                            }
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {slot.url && <SecondaryButton onClick={() => removeLogo(slot.key)}>Remove</SecondaryButton>}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <TextField
                      label="Width (px)"
                      type="number"
                      value={slot.w}
                      onChange={(v) => setSettings({ ...settings, [slot.wKey]: Number(v) })}
                    />
                    <TextField
                      label="Height (px)"
                      type="number"
                      value={slot.h}
                      onChange={(v) => setSettings({ ...settings, [slot.hKey]: Number(v) })}
                    />
                  </div>

                  <p className="mt-2 text-xs text-neutral-500">PNG, JPG, WebP or SVG. Up to 5MB.</p>
                </div>
              </div>
            </div>
          ))}
          </div>

          <div className="mt-6 flex justify-end">
            <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Logo Sizes"}</PrimaryButton>
          </div>
        </Card>
      )}

      {/* ---------------- Stripe ---------------- */}
      {tab === "stripe" && (
        <Card className="p-6">
          <SectionHeading
            title="Stripe Credentials"
            hint="Stored securely on the server. Saved secrets are shown masked — leave a masked field untouched to keep the existing value."
          />

          <div className="mb-5">
            <Toggle
              label="Enable Stripe payments"
              checked={!!stripe.enabled}
              onChange={(v) => setStripe({ enabled: v })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TextField
              label="Publishable Key"
              value={stripe.publishableKey}
              onChange={(v) => setStripe({ publishableKey: v })}
              placeholder="pk_live_..."
            />
            <div>
              <TextField
                label="Secret Key"
                value={stripe.secretKey}
                onChange={(v) => setStripe({ secretKey: v })}
                placeholder="sk_live_..."
              />
              {stripe.secretKeySet && (
                <p className="text-xs text-neutral-500 mt-1">A secret key is saved. Type a new one to replace it.</p>
              )}
            </div>
            <div>
              <TextField
                label="Webhook Signing Secret"
                value={stripe.webhookSecret}
                onChange={(v) => setStripe({ webhookSecret: v })}
                placeholder="whsec_..."
              />
              {stripe.webhookSecretSet && (
                <p className="text-xs text-neutral-500 mt-1">A webhook secret is saved. Type a new one to replace it.</p>
              )}
            </div>
          </div>

          {settings.stripeWebhookUrl && (
            <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-semibold text-neutral-700">Your webhook endpoint</p>
              <p className="mt-1 break-all font-mono text-xs text-neutral-800">{settings.stripeWebhookUrl}</p>
              <p className="mt-2 text-xs text-neutral-500">
                In your Stripe dashboard add this URL under Developers → Webhooks with the events{" "}
                <span className="font-mono">checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted, payment_intent.succeeded, payment_intent.payment_failed</span>
                , then paste its signing secret above. Recurring packages, card updates and automatic renewals depend on it.
              </p>
            </div>
          )}

          <p className="mt-5 text-xs text-neutral-500 leading-relaxed">
            Only the publishable key is ever sent to the browser. The secret and webhook values stay
            on the server and are never returned in full, even here. Payments go to <strong>this gym&apos;s</strong> Stripe account.
          </p>

          <div className="flex justify-end mt-6">
            <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Stripe Settings"}</PrimaryButton>
          </div>
        </Card>
      )}

      {/* ---------------- SMTP ---------------- */}
      {tab === "smtp" && (
        <Card className="p-6">
          <SectionHeading
            title="Outgoing Mail (SMTP)"
            hint="Used for member credential emails and order notifications. Overrides the server environment variables once set."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TextField label="Host" value={smtp.host} onChange={(v) => setSmtp({ host: v })} placeholder="smtp.gmail.com" />
            <TextField label="Port" type="number" value={smtp.port} onChange={(v) => setSmtp({ port: Number(v) })} placeholder="587" />
            <TextField label="Username" value={smtp.user} onChange={(v) => setSmtp({ user: v })} />
            <div>
              <TextField label="Password" type="password" value={smtp.pass} onChange={(v) => setSmtp({ pass: v })} />
              {smtp.passSet && (
                <p className="text-xs text-neutral-500 mt-1">A password is saved. Type a new one to replace it.</p>
              )}
            </div>
            <TextField label="From Name" value={smtp.fromName} onChange={(v) => setSmtp({ fromName: v })} placeholder="Your gym name" />
            <TextField label="From Email" type="email" value={smtp.fromEmail} onChange={(v) => setSmtp({ fromEmail: v })} placeholder="no-reply@yourgym.com" />
          </div>

          <div className="mt-5">
            <Toggle
              label="Use TLS/SSL (port 465)"
              checked={!!smtp.secure}
              onChange={(v) => setSmtp({ secure: v })}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <SecondaryButton onClick={testSmtp} disabled={saving}>Test Connection</SecondaryButton>
            <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Save SMTP Settings"}</PrimaryButton>
          </div>
        </Card>
      )}

      {/* ---------------- Messaging ---------------- */}
      {tab === "messaging" && (
        <MessagingSettings
          value={settings.messaging || {}}
          onChange={(next) => setSettings({ ...settings, messaging: next })}
          onSave={save}
          onReload={load}
          saving={saving}
          onNotice={(tone, text) => setNotice({ tone, text })}
        />
      )}

      {/* ---------------- Banks ---------------- */}
      {tab === "banks" && (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Bank Accounts</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Accounts members can pay into. Attach a scannable barcode or QR image to each one.
              </p>
            </div>
            <PrimaryButton onClick={() => openBank()}>Add Bank</PrimaryButton>
          </div>

          {banksLoading ? (
            <Spinner />
          ) : banks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center">
              <p className="text-sm font-medium text-neutral-900">No bank accounts yet</p>
              <p className="text-xs text-neutral-500 mt-1">Add one so members know where to send payment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {banks.map((b) => (
                <div key={b._id} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden">
                      {b.qrCodeUrl ? (
                        <Image
                          src={b.qrCodeUrl}
                          alt={`${b.name} payment barcode`}
                          width={96}
                          height={96}
                          className="h-full w-full object-contain"
                          unoptimized
                        />
                      ) : (
                        <span className="text-[10px] text-neutral-400 text-center px-2">No barcode</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-neutral-900 truncate">{b.name}</h3>
                        <Badge color={b.isActive === false ? "neutral" : "green"}>
                          {b.isActive === false ? "inactive" : "active"}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-600 mt-1">{b.accountTitle}</p>
                      <p className="text-xs font-mono text-neutral-500 mt-0.5">{b.accountNumber}</p>
                      {b.iban && <p className="text-xs font-mono text-neutral-400 mt-0.5 truncate">{b.iban}</p>}
                      {b.branch && <p className="text-xs text-neutral-400 mt-0.5">{b.branch}</p>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <SecondaryButton onClick={() => openBank(b)}>Edit</SecondaryButton>

                    <label className="inline-flex cursor-pointer items-center h-9 px-3 text-sm font-medium rounded-md border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 transition-colors">
                      {uploadingFor === b._id ? "Uploading..." : b.qrCodeUrl ? "Replace Barcode" : "Upload Barcode"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                        className="hidden"
                        disabled={uploadingFor === b._id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadBarcode(b._id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>

                    {b.qrCodeUrl && <SecondaryButton onClick={() => removeBarcode(b._id)}>Remove Barcode</SecondaryButton>}
                    <DangerButton onClick={() => deleteBank(b._id)}>Delete</DangerButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ---------------- Colour Scheme ---------------- */}
      {tab === "theme" && (
        <Card className="p-6">
          <SectionHeading
            title="Colour Scheme"
            hint="Applies across the whole public site — header, buttons, links and footer. Selecting previews it instantly; Save makes it live for everyone."
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {THEMES.map((t) => {
              const active = (settings.theme || DEFAULT_THEME_KEY) === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setSettings({ ...settings, theme: t.key });
                    setActiveTheme(t.key);
                  }}
                  aria-pressed={active}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    active
                      ? "border-neutral-900 ring-2 ring-neutral-900/10 bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black/10"
                      style={{ background: t.tokens.base }}
                    >
                      <span className="h-5 w-5 rounded-full" style={{ background: t.tokens.accent }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900 truncate">{t.name}</span>
                        {active && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-neutral-900 rounded px-1.5 py-0.5">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{t.description}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-1.5">
                    {[t.tokens.accent, t.tokens.accentDark, t.tokens.accentSoft, t.tokens.surface, t.tokens.base].map(
                      (c) => (
                        <span
                          key={c}
                          title={c}
                          className="h-5 flex-1 rounded border border-black/10"
                          style={{ background: c }}
                        />
                      )
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end mt-6">
            <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Colour Scheme"}</PrimaryButton>
          </div>
        </Card>
      )}

      {/* Bank editor */}
      <Modal open={bankModal} onClose={() => setBankModal(false)} title={editingBank ? "Edit Bank" : "Add Bank"} size="sm">
        <div className="space-y-4">
          <TextField label="Bank Name" value={bankDraft.name} onChange={(v) => setBankDraft({ ...bankDraft, name: v })} required />
          <TextField label="Account Title" value={bankDraft.accountTitle} onChange={(v) => setBankDraft({ ...bankDraft, accountTitle: v })} required />
          <TextField label="Account Number" value={bankDraft.accountNumber} onChange={(v) => setBankDraft({ ...bankDraft, accountNumber: v })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Branch" value={bankDraft.branch} onChange={(v) => setBankDraft({ ...bankDraft, branch: v })} />
            <TextField label="IBAN" value={bankDraft.iban} onChange={(v) => setBankDraft({ ...bankDraft, iban: v })} />
          </div>
          <TextArea label="Notes" value={bankDraft.notes} onChange={(v) => setBankDraft({ ...bankDraft, notes: v })} />

          {/* Payment barcode */}
          <div>
            <span className="text-xs font-semibold text-neutral-700">Payment Barcode</span>
            <div className="mt-1 flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                {pendingPreview ? (
                  // Object URL of a local file — next/image cannot optimise it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pendingPreview} alt="Selected barcode preview" className="h-full w-full object-contain" />
                ) : editingBank?.qrCodeUrl ? (
                  <Image
                    src={editingBank.qrCodeUrl}
                    alt="Current barcode"
                    width={80}
                    height={80}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="px-2 text-center text-[10px] text-neutral-400">No barcode</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50">
                    {pendingBarcode || editingBank?.qrCodeUrl ? "Choose Different" : "Choose Image"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (f && f.size > 5 * 1024 * 1024) {
                          setBankErr("Barcode image must be 5MB or smaller.");
                          e.target.value = "";
                          return;
                        }
                        setBankErr(null);
                        choosePendingBarcode(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {pendingBarcode && (
                    <SecondaryButton onClick={() => choosePendingBarcode(null)}>Clear</SecondaryButton>
                  )}
                </div>
                <p className="mt-2 truncate text-xs text-neutral-500">
                  {pendingBarcode
                    ? `${pendingBarcode.name} — uploads when you save`
                    : "PNG, JPG, GIF, WebP or SVG. Up to 5MB."}
                </p>
              </div>
            </div>
          </div>

          {bankErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{bankErr}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={() => setBankModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={saveBank} disabled={savingBank}>
              {savingBank ? "Saving..." : editingBank ? "Save Changes" : "Add Bank"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function SettingsAdminPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <SettingsAdminPageInner />
    </Suspense>
  );
}
