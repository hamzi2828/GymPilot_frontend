"use client";

// Settings → Payments, laid out for a gym owner rather than a developer, one
// card per question:
//   1. How members pay online (one option at a time).
//   2. Connect that option: its keys in short numbered steps, or, for bank
//      transfer, the gym's bank accounts.
//   3. When members are reminded to pay.
//   Automatic card payments, only with an option that can charge saved cards.
//
// The options come from the API (GET /settings/payment-gateways) with the
// fields each form needs, so a gateway added there still gets a form here;
// the plain names and hints below are for the ones we know. Everything is
// saved by the page's one Save (PUT /settings), from the bar at the bottom.

import { useCallback, useEffect, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { Check, CreditCard, ExternalLink, Landmark, Smartphone, Store, Wallet } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, TextField, SelectField, Toggle, Badge, useAsyncAction } from "../_shared/ui";
import { API_BASE, ApiError, apiGet, apiJson, isMaskedSecret } from "../_shared/api";
import { CopyButton } from "../users/PasswordDialogs";

export interface GatewayField {
  name: string;
  label: string;
  type?: "text" | "password" | "secret" | "select" | "boolean";
  /** Stored sealed, read back masked; the masked preview sent back keeps it. */
  secret?: boolean;
  required?: boolean;
  options?: (string | { value: string; label: string })[];
  placeholder?: string;
  help?: string;
}

export interface GatewayCapabilities {
  checkout?: boolean;
  /** Members pay by bank transfer and upload the receipt for staff to check (the "generic" gateway). */
  receiptUpload?: boolean;
  paymentLinks?: boolean;
  savedCards?: boolean;
  autoCharge?: boolean;
  wallets?: boolean;
  bankApps?: boolean;
}

/** One gateway as GET /settings/payment-gateways lists it. */
export interface Gateway {
  id: string;
  label: string;
  description?: string;
  countries?: string[];
  capabilities?: GatewayCapabilities;
  config_fields?: GatewayField[];
  configured?: boolean;
  selected?: boolean;
  /** Where its settings live in the settings document; null for one with none (bank transfer). */
  settings_key?: string | null;
  /** The address to register with the gateway for its payment updates. */
  webhook_url?: string | null;
}

export interface BillingConfig {
  reminderDaysBefore?: number[];
  dueDayReminder?: boolean;
  lastDayAfterDue?: number;
  sendVia?: { email?: boolean; sms?: boolean; whatsapp?: boolean; push?: boolean };
  autoCharge?: { enabled?: boolean };
}

export interface PaymentFields {
  onlinePayments?: { provider?: string };
  billing?: BillingConfig;
  stripe?: {
    enabled?: boolean;
    publishableKey?: string;
    secretKey?: string;
    webhookSecret?: string;
    secretKeySet?: boolean;
    webhookSecretSet?: boolean;
  };
  /** Where Stripe sends its payment updates (read-only, from the API). */
  stripeWebhookUrl?: string;
}

/** Whether members can pay online right now, as GET /payment/methods says. */
export interface OnlineStatus {
  card: boolean;
  code: string | null;
  online?: { provider: string; label?: string } | null;
}

type GatewayConfig = Record<string, unknown>;

interface BankRow {
  _id: string;
  name: string;
  accountTitle?: string;
  accountNumber?: string;
  qrCodeUrl?: string;
  isActive?: boolean;
}

const NONE = "none";

const BILLING_DEFAULTS = {
  reminderDaysBefore: [3],
  dueDayReminder: true,
  lastDayAfterDue: 3,
  sendVia: { email: true, sms: false, whatsapp: true, push: true },
};

// What the gym's Stripe endpoint must send. Card sales stay off until its
// signing secret is saved: renewals, abandoned checkouts and cancellations
// only ever reach us this way. Same list as the setup wizard.
const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
];

const BANK_ORDERS_TO_VERIFY = "/admin/package-orders?paymentStatus=processing&paymentMethod=bank_transfer";

/** The plain words for the options we know; the API's own wording for any other. */
interface OptionCopy {
  title: string;
  short: string;
  line: string;
  icon: ComponentType<{ className?: string }>;
  signup?: { url: string; label: string; note?: string };
  fields?: Record<string, { label?: string; hint?: string }>;
  webhookHow?: string;
  webhookEvents?: string[];
}

const COPY: Record<string, OptionCopy> = {
  generic: {
    title: "Bank transfer + receipt",
    short: "bank transfer",
    line: "Members upload a receipt, you approve. No fees.",
    icon: Landmark,
  },
  safepay: {
    title: "Safepay (Pakistan)",
    short: "Safepay",
    line: "Card, JazzCash, Easypaisa. Marked paid automatically.",
    icon: Smartphone,
    signup: { url: "https://getsafepay.pk", label: "Open getsafepay.pk", note: "You'll need your CNIC, NTN and a bank account certificate." },
    fields: {
      publicKey: { label: "Public key", hint: "Safepay → Developer → API" },
      secretKey: { label: "Secret key", hint: "Safepay → Developer → API" },
      webhookSecret: { label: "Webhook secret", hint: "Safepay → Developer → Endpoints → View shared secret" },
    },
    webhookHow: "In Safepay, open Developer → Endpoints → Add an endpoint and paste this.",
  },
  stripe: {
    title: "Stripe (international)",
    short: "Stripe",
    line: "Card payments worldwide.",
    icon: CreditCard,
    signup: { url: "https://dashboard.stripe.com/register", label: "Open stripe.com" },
    fields: {
      publishableKey: { label: "Publishable key", hint: "Stripe → Developers → API keys" },
      secretKey: { label: "Secret key", hint: "Stripe → Developers → API keys" },
      webhookSecret: { label: "Signing secret", hint: "Stripe → Developers → Webhooks → your endpoint" },
    },
    webhookHow: "In Stripe, open Developers → Webhooks → Add endpoint and paste this.",
    webhookEvents: STRIPE_WEBHOOK_EVENTS,
  },
  [NONE]: {
    title: "No online payments",
    short: "no online payments",
    line: "Members pay at the front desk.",
    icon: Store,
  },
};

// Bank transfer first: it needs no account with anyone.
const ORDER: Record<string, number> = { generic: 0, safepay: 1, stripe: 2 };

function copyFor(g: Gateway): OptionCopy {
  return COPY[g.id] || { title: g.label, short: g.label, line: g.description || "", icon: Wallet };
}

// Used only while the API cannot list its gateways (an older API, which has
// none but these two), with the fields the spec gives them.
function builtInGateways(settings: PaymentFields & Record<string, unknown>): Gateway[] {
  const safepay = (settings.safepay || {}) as GatewayConfig;
  const stripe = settings.stripe || {};
  return [
    {
      id: "safepay",
      label: "Safepay",
      countries: ["PK"],
      capabilities: { checkout: true, paymentLinks: true, savedCards: true, autoCharge: true, wallets: true, bankApps: true },
      config_fields: [
        { name: "environment", label: "Environment", type: "select", options: [{ value: "sandbox", label: "Sandbox (testing)" }, { value: "production", label: "Production (real payments)" }], required: true },
        { name: "publicKey", label: "Public key (API key)", type: "text", required: true },
        { name: "secretKey", label: "Secret key", type: "password", secret: true, required: true },
        { name: "webhookSecret", label: "Webhook secret", type: "password", secret: true, required: true },
      ],
      configured:
        !!safepay.publicKey &&
        (safepay.secretKeySet === true || isMaskedSecret(safepay.secretKey)) &&
        (safepay.webhookSecretSet === true || isMaskedSecret(safepay.webhookSecret)),
    },
    {
      id: "stripe",
      label: "Stripe",
      countries: ["*"],
      capabilities: { checkout: true, savedCards: true },
      config_fields: [
        { name: "publishableKey", label: "Publishable key", type: "text", required: true, placeholder: "pk_live_..." },
        { name: "secretKey", label: "Secret key", type: "secret", secret: true, required: true, placeholder: "sk_live_..." },
        { name: "webhookSecret", label: "Webhook signing secret", type: "secret", secret: true, required: true, placeholder: "whsec_..." },
      ],
      configured: !!stripe.secretKeySet && !!stripe.webhookSecretSet,
    },
  ];
}

/** A gateway with no checkout of its own: bank transfer, and a receipt staff check. */
function receiptOnly(g: Gateway | null) {
  return !!g && g.capabilities?.checkout === false && !!g.capabilities?.receiptUpload;
}

function optionList(field: GatewayField) {
  return (field.options || []).map((o) => (typeof o === "string" ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) } : o));
}

const TEST_MODE = /^(sandbox|test)$/i;
const LIVE_MODE = /^(production|live)$/i;

/** A choice between test and real payments (Safepay's environment): shown as a Test / Live switch. */
function isModeField(field: GatewayField) {
  if (field.type !== "select") return false;
  const values = optionList(field).map((o) => o.value);
  return values.some((v) => TEST_MODE.test(v)) && values.some((v) => LIVE_MODE.test(v));
}

function isSecretField(field: GatewayField) {
  return !!field.secret || field.type === "password" || field.type === "secret";
}

/** "3, 1" as the days to send a reminder, or null when it cannot be read. */
function parseDays(text: string): number[] | null {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return [];
  const days = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 30)) return null;
  return Array.from(new Set(days)).sort((a, b) => b - a);
}

/** "Example: expires on 16 Oct → reminders on 13 Oct, 16 Oct and 19 Oct." */
function exampleLine(daysBefore: number[], onTheDay: boolean, daysAfter: number) {
  const now = new Date();
  const expires = new Date(now.getFullYear(), now.getMonth(), 16);
  const offsets = new Set<number>(daysBefore.map((d) => -d));
  if (onTheDay) offsets.add(0);
  if (daysAfter > 0) offsets.add(daysAfter);
  const day = (offset: number) => {
    const d = new Date(expires);
    d.setDate(expires.getDate() + offset);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const dates = Array.from(offsets)
    .sort((a, b) => a - b)
    .map(day);
  if (!dates.length) return "No reminders are sent.";
  const joined = dates.length === 1 ? dates[0] : `${dates.slice(0, -1).join(", ")} and ${dates[dates.length - 1]}`;
  return `Example: expires on ${day(0)} → reminder${dates.length === 1 ? "" : "s"} on ${joined}.`;
}

const linkButton =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300";

const smallInput =
  "h-9 w-16 rounded-lg border border-neutral-200 bg-white px-2 text-center text-base sm:text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]";

/** A card's header: its number, a title and one short line. */
function CardHead({ step, title, line, aside }: { step?: ReactNode; title: string; line?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        {step !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-xs font-bold text-white" aria-hidden="true">
            {step}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-7 text-neutral-900">{title}</h3>
          {line && <p className="text-sm text-neutral-500">{line}</p>}
        </div>
      </div>
      {aside && <div className="flex shrink-0 items-center pt-1">{aside}</div>}
    </div>
  );
}

/** One numbered step inside a card, with what it needs right under it. */
function Step({ n, title, done, last, children }: { n: number; title: string; done?: boolean; last?: boolean; children?: ReactNode }) {
  return (
    <li className="flex gap-3 sm:gap-4">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
            done ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300 bg-white text-neutral-700"
          }`}
        >
          {done ? <Check className="h-4 w-4" aria-label="Done" /> : n}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-neutral-200" aria-hidden="true" />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "" : "pb-7"}`}>
        <p className="text-sm font-semibold leading-7 text-neutral-900">{title}</p>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}

export default function PaymentsSettings<T extends PaymentFields>({
  settings,
  saved,
  setSettings,
  onSave,
  saving,
  saveBusy,
  status,
  onReloadStatus,
  secretError,
}: {
  settings: T;
  saved: T | null;
  setSettings: (next: T) => void;
  /** The page's Save: the whole settings document. */
  onSave: () => Promise<unknown>;
  saving: boolean;
  saveBusy: boolean;
  status: OnlineStatus | null;
  onReloadStatus: () => Promise<unknown> | void;
  /** A secret the API asked to be typed again (SECRET_REQUIRED, "safepay.secretKey"), said beside its box. */
  secretError?: { field: string; message: string } | null;
}) {
  const all = settings as unknown as PaymentFields & Record<string, unknown>;
  const was = saved as unknown as (PaymentFields & Record<string, unknown>) | null;

  const [gateways, setGateways] = useState<Gateway[] | null>(null);
  const loadGateways = useCallback(async () => {
    try {
      const r = await apiGet<{ data?: Gateway[] }>(`${API_BASE}/settings/payment-gateways`);
      setGateways(Array.isArray(r.data) ? r.data : []);
    } catch {
      setGateways(null);
    }
  }, []);
  useEffect(() => {
    loadGateways();
  }, [loadGateways]);
  const list = (gateways && gateways.length ? gateways : builtInGateways(all))
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (ORDER[a.g.id] ?? 9) - (ORDER[b.g.id] ?? 9) || a.i - b.i)
    .map(({ g }) => g);

  const configOf = (id: string): GatewayConfig => ((all[id] as GatewayConfig) || {}) as GatewayConfig;
  const savedConfigOf = (id: string): GatewayConfig => ((was?.[id] as GatewayConfig) || {}) as GatewayConfig;

  // The chosen option: as edited, else as the API derives it for a gym that
  // never chose (Stripe when it is switched on, otherwise none).
  const selectedId = all.onlinePayments?.provider || list.find((g) => g.selected)?.id || (all.stripe?.enabled ? "stripe" : NONE);
  const selected = list.find((g) => g.id === selectedId) || null;
  const selectedCopy = selected ? copyFor(selected) : COPY[NONE];

  const choose = (id: string) => {
    const next: Record<string, unknown> = { ...all, onlinePayments: { ...(all.onlinePayments || {}), provider: id } };
    // The chosen gateway takes every new online payment (the server goes by
    // onlinePayments.provider), so choosing it switches it on. The others are
    // left as they are rather than switched off: members still on a Stripe
    // subscription renew through Stripe's webhook, which stops being recorded
    // once Stripe is off. Bank transfer has no settings of its own to switch.
    const g = list.find((x) => x.id === id);
    if (g && g.settings_key !== null && configOf(id).enabled !== true) next[id] = { ...configOf(id), enabled: true };
    setSettings(next as unknown as T);
  };

  const setField = (id: string, name: string, value: unknown) =>
    setSettings({ ...all, [id]: { ...configOf(id), [name]: value } } as unknown as T);

  // ---- The option tiles: a radio group, arrow keys move the choice ----
  const options = [
    ...list.map((g) => {
      const c = copyFor(g);
      const bank = receiptOnly(g);
      return {
        id: g.id,
        title: c.title,
        line: c.line,
        icon: c.icon,
        badge: bank
          ? g.configured
            ? { color: "green" as const, text: "Ready" }
            : { color: "amber" as const, text: "Add a bank account" }
          : g.configured
          ? { color: "green" as const, text: "Ready" }
          : { color: "neutral" as const, text: "Needs setup" },
      };
    }),
    { id: NONE, title: COPY[NONE].title, line: COPY[NONE].line, icon: COPY[NONE].icon, badge: null },
  ];
  const tileRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onTileKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const move = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!move) return;
    e.preventDefault();
    const next = options[(index + move + options.length) % options.length];
    choose(next.id);
    tileRefs.current[next.id]?.focus();
  };

  // ---- Bank transfer: the gym's bank accounts ----
  const bankOption = receiptOnly(selected);
  const [banks, setBanks] = useState<BankRow[] | null>(null);
  const [banksFailed, setBanksFailed] = useState(false);
  const loadBanks = useCallback(async () => {
    try {
      const r = await apiGet<{ data?: BankRow[]; banks?: BankRow[] }>(`${API_BASE}/banks`);
      setBanks((r.data || r.banks || []).filter((b) => b.isActive !== false));
      setBanksFailed(false);
    } catch {
      setBanksFailed(true);
    }
  }, []);
  useEffect(() => {
    if (bankOption) loadBanks();
  }, [bankOption, loadBanks]);
  const banksRetry = useAsyncAction();

  // ---- Reminders ----
  const billing: BillingConfig = all.billing || {};
  const sendVia = { ...BILLING_DEFAULTS.sendVia, ...(billing.sendVia || {}) };
  const [daysText, setDaysText] = useState(() => (billing.reminderDaysBefore ?? BILLING_DEFAULTS.reminderDaysBefore).join(", "));
  // A reload after a save brings the stored list back: shown as stored. Not on
  // first showing, which keeps an edit made before a look at another tab.
  const storedDays = (was?.billing?.reminderDaysBefore ?? BILLING_DEFAULTS.reminderDaysBefore).join(", ");
  const shownStored = useRef(storedDays);
  useEffect(() => {
    if (shownStored.current === storedDays) return;
    shownStored.current = storedDays;
    setDaysText(storedDays);
  }, [storedDays]);
  const parsedDays = parseDays(daysText);
  const setBilling = (patch: Partial<BillingConfig>) => setSettings({ ...all, billing: { ...billing, ...patch } } as unknown as T);
  const lastDay = billing.lastDayAfterDue ?? BILLING_DEFAULTS.lastDayAfterDue;
  const lastDayBad = !Number.isInteger(lastDay) || lastDay < 0 || lastDay > 60;
  const onTheDay = billing.dueDayReminder ?? BILLING_DEFAULTS.dueDayReminder;
  const noChannel = !sendVia.email && !sendVia.sms && !sendVia.whatsapp && !sendVia.push;

  // ---- Test connection ----
  const tester = useAsyncAction();
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setTestResult(null), [selectedId]);
  const unsavedKeys = !!selected && JSON.stringify(configOf(selected.id)) !== JSON.stringify(savedConfigOf(selected.id));
  const test = (id: string, name: string) =>
    tester.run(async () => {
      setTestResult(null);
      try {
        const r = await apiJson<{ success?: boolean; message?: string }>(`${API_BASE}/settings/${encodeURIComponent(id)}/test`, "POST");
        setTestResult(r.success === false ? { ok: false, text: r.message || "The keys did not work." } : { ok: true, text: `Connected — ${name} accepted your keys.` });
      } catch (e) {
        setTestResult({
          ok: false,
          text: e instanceof ApiError && e.status === 404 ? "This option can't be tested from here yet." : e instanceof Error ? e.message : "The test could not run.",
        });
      }
    });

  // ---- Save ----
  // What Save sends for this tab, to tell whether anything is unsaved.
  const snapshot = (s: (PaymentFields & Record<string, unknown>) | null) =>
    JSON.stringify([s?.onlinePayments?.provider ?? null, s?.billing ?? null, s?.stripe ?? null, ...list.map((g) => s?.[g.id] ?? null)]);
  const dirty = !!was && snapshot(all) !== snapshot(was);
  // The last Save pressed, as it was: still unsaved and unchanged since means it failed.
  const [attempt, setAttempt] = useState<string | null>(null);
  const saveFailed = dirty && attempt === snapshot(all);
  const remindersBad = parsedDays === null || lastDayBad;
  const save = async () => {
    if (remindersBad) return;
    setAttempt(snapshot(all));
    await onSave();
    await Promise.all([loadGateways(), onReloadStatus(), bankOption ? loadBanks() : null]);
  };

  const live = !!status && (status.online?.provider === selectedId || (selectedId === "stripe" && status.card));
  const autoChargeOn = !!billing.autoCharge?.enabled;
  const canAutoCharge = !!selected?.capabilities?.autoCharge;
  const autoChargeWith = list.filter((g) => g.capabilities?.autoCharge).map((g) => copyFor(g).short);

  const showConnect = !!selected;
  const remindersStep = showConnect ? 3 : 2;

  // ---- The keys form (Safepay, Stripe, or any gateway the API adds) ----
  const keysForm = (g: Gateway) => {
    const c = copyFor(g);
    const cfg = configOf(g.id);
    const fields = (g.config_fields || []).filter((f) => !(f.type === "boolean" && f.name === "enabled"));
    const modeField = fields.find(isModeField);
    const webhookFields = fields.filter((f) => f !== modeField && /webhook/i.test(f.name));
    const keyFields = fields.filter((f) => f !== modeField && !webhookFields.includes(f));
    const webhookUrl = String(cfg.webhook_url || (g.id === "stripe" ? all.stripeWebhookUrl : "") || g.webhook_url || "");
    const hasValue = (f: GatewayField) => {
      const v = cfg[f.name];
      if (isSecretField(f)) return isMaskedSecret(v) || cfg[`${f.name}Set`] === true || (typeof v === "string" && v.trim() !== "");
      return typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null;
    };
    const textKeys = keyFields.filter((f) => f.type !== "boolean");
    const keysDone = textKeys.length > 0 && textKeys.every(hasValue);
    const webhookDone = webhookFields.length > 0 && webhookFields.every(hasValue);
    const hasAccount = [...textKeys, ...webhookFields].some(hasValue);

    const field = (f: GatewayField) => {
      const label = c.fields?.[f.name]?.label || f.label;
      const hint = c.fields?.[f.name]?.hint || f.help;
      const value = cfg[f.name];
      if (f.type === "boolean") {
        return (
          <div key={f.name} className="sm:col-span-2">
            <Toggle label={label} checked={value === true || value === "true"} onChange={(v) => setField(g.id, f.name, v)} />
            {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
          </div>
        );
      }
      if (f.type === "select") {
        return (
          <SelectField
            key={f.name}
            label={label}
            value={typeof value === "string" ? value : undefined}
            onChange={(v) => setField(g.id, f.name, v)}
            options={optionList(f)}
            placeholder="Choose…"
            allowClear={false}
          />
        );
      }
      const secret = isSecretField(f);
      const secretSaved = secret && (isMaskedSecret(value) || cfg[`${f.name}Set`] === true);
      return (
        <div key={f.name}>
          <TextField
            label={label}
            type={secret ? "password" : "text"}
            value={typeof value === "string" || typeof value === "number" ? value : ""}
            onChange={(v) => setField(g.id, f.name, v)}
            placeholder={f.placeholder}
          />
          {secretError?.field === `${g.id}.${f.name}` ? (
            <p role="alert" className="mt-1 text-xs text-rose-700">
              {secretError.message}
            </p>
          ) : secretSaved ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Saved. Type a new one to replace it.
            </p>
          ) : hint ? (
            <p className="mt-1 text-xs text-neutral-500">{hint}</p>
          ) : null}
        </div>
      );
    };

    const modeOptions = modeField ? optionList(modeField) : [];
    const modeValue = modeField ? (typeof cfg[modeField.name] === "string" && cfg[modeField.name] !== "" ? String(cfg[modeField.name]) : modeOptions.find((o) => TEST_MODE.test(o.value))?.value) : undefined;

    const steps: { title: string; done?: boolean; body?: ReactNode }[] = [];
    if (c.signup) {
      steps.push({
        title: `Create your ${c.short} account`,
        done: hasAccount,
        body: hasAccount ? null : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <a href={c.signup.url} target="_blank" rel="noopener noreferrer" className={linkButton}>
              {c.signup.label}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            {c.signup.note && <p className="text-xs text-neutral-500">{c.signup.note}</p>}
          </div>
        ),
      });
    }
    if (modeField || keyFields.length) {
      steps.push({
        title: "Paste your keys",
        done: keysDone,
        body: (
          <div className="space-y-4">
            {modeField && (
              <div role="radiogroup" aria-label="Test or live payments" className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
                {modeOptions.map((o) => {
                  const on = modeValue === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setField(g.id, modeField.name, o.value)}
                      className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 ${
                        on ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200" : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      {TEST_MODE.test(o.value) ? "Test mode" : LIVE_MODE.test(o.value) ? "Live mode" : o.label}
                    </button>
                  );
                })}
              </div>
            )}
            {keyFields.length > 0 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{keyFields.map(field)}</div>}
          </div>
        ),
      });
    }
    if (webhookUrl || webhookFields.length) {
      steps.push({
        title: "Turn on payment updates",
        done: webhookDone,
        body: (
          <div className="space-y-4">
            {webhookUrl && (
              <div>
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-3 pr-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs text-neutral-800">{webhookUrl}</code>
                  <CopyButton text={webhookUrl} />
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">{c.webhookHow || `In ${c.short}, add this as your webhook endpoint.`}</p>
                {c.webhookEvents && (
                  <details className="mt-1.5 text-xs text-neutral-500">
                    <summary className="cursor-pointer font-medium text-neutral-700">Events to pick ({c.webhookEvents.length})</summary>
                    <p className="mt-1 break-words font-mono">{c.webhookEvents.join(", ")}</p>
                  </details>
                )}
              </div>
            )}
            {webhookFields.length > 0 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{webhookFields.map(field)}</div>}
          </div>
        ),
      });
    }

    return (
      <>
        <div className="px-4 py-5 sm:px-6">
          <ol>
            {steps.map((s, i) => (
              <Step key={s.title} n={i + 1} title={s.title} done={s.done} last={i === steps.length - 1}>
                {s.body}
              </Step>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-b-xl border-t border-neutral-100 bg-neutral-50/70 px-4 py-4 sm:px-6">
          <SecondaryButton onClick={() => test(g.id, c.short)} loading={tester.busy} disabled={saving || unsavedKeys}>
            Test connection
          </SecondaryButton>
          {testResult ? (
            <p role={testResult.ok ? "status" : "alert"} className={`text-sm font-medium ${testResult.ok ? "text-emerald-700" : "text-rose-700"}`}>
              {testResult.text}
            </p>
          ) : (
            unsavedKeys && <p className="text-xs text-neutral-500">Save first, then test.</p>
          )}
        </div>
      </>
    );
  };

  // ---- The bank accounts (bank transfer + receipt) ----
  const banksReady = banks ? banks.length > 0 : !!selected?.configured;
  const bankPanel = (
    <>
      <div className="px-4 py-5 sm:px-6">
        {banks === null && banksFailed ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-rose-700">Your bank accounts could not be loaded.</p>
            <SecondaryButton onClick={() => banksRetry.run(loadBanks)} loading={banksRetry.busy}>
              Try again
            </SecondaryButton>
          </div>
        ) : banks === null ? (
          <p className="text-sm text-neutral-500">Loading your bank accounts…</p>
        ) : banks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-5 text-center">
            <p className="text-sm font-medium text-neutral-900">No bank account yet</p>
            <p className="mt-0.5 text-xs text-neutral-500">Add one so members know where to pay.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {banks.map((b) => (
              <li key={b._id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                  <Landmark className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{b.name}</p>
                  <p className="truncate text-xs text-neutral-500">{[b.accountTitle, b.accountNumber].filter(Boolean).join(" · ")}</p>
                </div>
                {b.qrCodeUrl && <Badge color="blue">QR code</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-b-xl border-t border-neutral-100 bg-neutral-50/70 px-4 py-4 sm:px-6">
        <Link href="/admin/settings?tab=banks" className={linkButton}>
          {banks && banks.length === 0 ? "Add a bank account" : "Manage bank accounts"}
        </Link>
        <Link href={BANK_ORDERS_TO_VERIFY} className="text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline">
          Payments to verify →
        </Link>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Payments</h2>
        <p className="mt-0.5 text-sm text-neutral-500">Choose how members pay you online and when they are reminded.</p>
      </div>

      {/* ---- 1. How members pay online ---- */}
      <Card>
        <CardHead step={1} title="How members pay online" line="Pick one. Only one option is used at a time." />
        <div className="px-4 py-5 sm:px-6">
          <div role="radiogroup" aria-label="How members pay online" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {options.map((o, index) => {
              const active = o.id === selectedId;
              const Icon = o.icon;
              return (
                <button
                  key={o.id}
                  ref={(el) => {
                    tileRefs.current[o.id] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => choose(o.id)}
                  onKeyDown={(e) => onTileKey(e, index)}
                  className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 ${
                    active ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 bg-white hover:border-neutral-400"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}
                    aria-hidden="true"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[15px] font-semibold leading-5 text-neutral-900">{o.title}</span>
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-neutral-900" : "border-neutral-300"}`}
                        aria-hidden="true"
                      >
                        {active && <span className="h-2.5 w-2.5 rounded-full bg-neutral-900" />}
                      </span>
                    </span>
                    {o.line && <span className="mt-1 block text-sm text-neutral-500">{o.line}</span>}
                    {o.badge && (
                      <span className="mt-2 block">
                        <Badge color={o.badge.color}>{o.badge.text}</Badge>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ---- 2. Connect the chosen option ---- */}
      {selected && (
        <Card>
          {bankOption ? (
            <CardHead
              step={2}
              title="Your bank accounts"
              line="Members see these and your QR code when they pay."
              aside={<Badge color={banksReady ? "green" : "amber"}>{banksReady ? "Ready" : "Add a bank account"}</Badge>}
            />
          ) : (
            <CardHead
              step={2}
              title={`Connect ${selectedCopy.short}`}
              line="Follow the steps, then press Save."
              aside={status ? <Badge color={live ? "green" : "amber"}>{live ? "Live" : "Not live yet"}</Badge> : null}
            />
          )}
          {bankOption ? bankPanel : keysForm(selected)}
        </Card>
      )}

      {/* ---- 3. Payment reminders ---- */}
      <Card>
        <CardHead step={remindersStep} title="Payment reminders" line="When members are reminded to pay." />
        <div className="space-y-5 px-4 py-5 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-800">
              <span>Send a reminder</span>
              <input
                type="text"
                value={daysText}
                onChange={(e) => {
                  // What is typed stays as typed (commas and all); the list is
                  // stored once it reads as one.
                  const v = e.target.value;
                  setDaysText(v);
                  const days = parseDays(v);
                  if (days) setBilling({ reminderDaysBefore: days });
                }}
                placeholder="3"
                aria-label="Days before the membership expires"
                title="One or more days, separated by commas (for example 7, 3)"
                aria-invalid={parsedDays === null || undefined}
                className={`${smallInput} ${parsedDays === null ? "border-rose-400" : ""}`}
              />
              <span>days before the membership expires</span>
            </div>
            {parsedDays === null && (
              <p role="alert" className="mt-1 text-xs text-rose-700">
                Use whole days from 0 to 30, like 7, 3.
              </p>
            )}
          </div>

          <Toggle label="Also on the day it expires" checked={onTheDay} onChange={(v) => setBilling({ dueDayReminder: v })} />

          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-800">
              <span>Final reminder</span>
              <input
                type="number"
                min={0}
                max={60}
                value={lastDay}
                onChange={(e) => setBilling({ lastDayAfterDue: e.target.value.trim() === "" ? 0 : Number(e.target.value) })}
                aria-label="Days after the membership expires"
                aria-invalid={lastDayBad || undefined}
                className={`${smallInput} ${lastDayBad ? "border-rose-400" : ""}`}
              />
              <span>days after it expires</span>
              <span className="text-xs text-neutral-400">(0 = off)</span>
            </div>
            {lastDayBad && (
              <p role="alert" className="mt-1 text-xs text-rose-700">
                Use a whole number from 0 to 60.
              </p>
            )}
          </div>

          <div className="border-t border-neutral-100 pt-5">
            <p className="text-sm font-medium text-neutral-800">Send by</p>
            <div role="group" aria-label="Send reminders by" className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["email", "Email"],
                  ["whatsapp", "WhatsApp"],
                  ["sms", "SMS"],
                  ["push", "App notification"],
                ] as const
              ).map(([key, label]) => {
                const on = !!sendVia[key];
                return (
                  <label
                    key={key}
                    className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-neutral-400 focus-within:ring-offset-1 ${
                      on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={on} onChange={(e) => setBilling({ sendVia: { ...sendVia, [key]: e.target.checked } })} />
                    {on ? <Check className="h-4 w-4" aria-hidden="true" /> : <span className="h-3.5 w-3.5 rounded-full border border-neutral-300" aria-hidden="true" />}
                    {label}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              WhatsApp and SMS go from your own account in the{" "}
              <Link href="/admin/settings?tab=messaging" className="font-medium text-neutral-700 underline underline-offset-2">
                Messaging tab
              </Link>
              .
            </p>
          </div>

          <p className={`rounded-lg px-3 py-2.5 text-sm ${noChannel ? "bg-amber-50 text-amber-900" : "bg-neutral-50 text-neutral-700"}`}>
            {noChannel
              ? "Pick at least one way to send, or no reminders go out."
              : exampleLine(parsedDays ?? billing.reminderDaysBefore ?? BILLING_DEFAULTS.reminderDaysBefore, onTheDay, lastDayBad ? 0 : lastDay)}
          </p>
        </div>
      </Card>

      {/* ---- Automatic card payments (optional) ---- */}
      <Card>
        <CardHead
          step={remindersStep + 1}
          title="Automatic card payments"
          line={
            canAutoCharge || autoChargeOn
              ? "Members who save their card are charged on the due date."
              : autoChargeWith.length
              ? `Available with ${autoChargeWith.join(" or ")}.`
              : "Not available with these options."
          }
          aside={<Badge>Optional</Badge>}
        />
        {(canAutoCharge || autoChargeOn) && (
          <div className="space-y-2 px-4 py-5 sm:px-6">
            <Toggle label="Charge saved cards automatically" checked={autoChargeOn} onChange={(v) => setBilling({ autoCharge: { ...(billing.autoCharge || {}), enabled: v } })} />
            {canAutoCharge ? (
              <p className="text-xs text-amber-800">Turn on only after {selectedCopy.short} confirms automatic charges for your account.</p>
            ) : (
              <p className="text-xs text-rose-700">
                {selected ? `${selectedCopy.short} can't charge saved cards, so nothing is charged.` : "Nothing is charged without online payments."} Turn this off.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ---- Save: the page's one Save, for everything on this tab ---- */}
      <div className="sticky bottom-0 z-10 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(16,24,40,0.08)] backdrop-blur sm:px-5">
          <p className={`text-sm ${remindersBad || saveFailed ? "text-rose-700" : dirty ? "font-medium text-amber-700" : "text-neutral-500"}`} role="status">
            {remindersBad
              ? "Fix the reminder days to save."
              : saveFailed
              ? "Not saved. See the message at the top of the page."
              : dirty
              ? "You have unsaved changes."
              : "All changes saved."}
          </p>
          <PrimaryButton onClick={save} loading={saveBusy} disabled={saving || remindersBad}>
            Save payment settings
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
