"use client";

// Settings → Payments: which gateway takes this gym's online payments (one at
// a time), that gateway's keys, the reminders members get before, on and
// after the day a membership falls due, and automatic card charges.
//
// The gateways come from the API (GET /settings/payment-gateways), each with
// what it supports and the fields its form needs, so a gateway added there
// shows up here without a change to this page. Stripe keeps its own panel
// (the page passes it in): it has more to explain than a list of fields.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, PrimaryButton, SecondaryButton, TextField, SelectField, Toggle, Badge, useAsyncAction } from "../_shared/ui";
import { API_BASE, ApiError, apiGet, apiJson, isMaskedSecret } from "../_shared/api";
import { countryByCode } from "@/data/countries";
import { CopyButton } from "../users/PasswordDialogs";

export interface GatewayField {
  name: string;
  label: string;
  type?: "text" | "password" | "select";
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
  countries?: string[];
  capabilities?: GatewayCapabilities;
  config_fields?: GatewayField[];
  configured?: boolean;
  selected?: boolean;
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
  stripe?: { enabled?: boolean; secretKeySet?: boolean; webhookSecretSet?: boolean };
}

/** Whether members can pay online right now, as GET /payment/methods says. */
export interface OnlineStatus {
  card: boolean;
  code: string | null;
  online?: { provider: string; label?: string } | null;
}

type GatewayConfig = Record<string, unknown>;

const NONE = "none";

const BILLING_DEFAULTS = {
  reminderDaysBefore: [3],
  dueDayReminder: true,
  lastDayAfterDue: 3,
  sendVia: { email: true, sms: false, whatsapp: false, push: true },
};

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
      config_fields: [],
      configured: !!stripe.secretKeySet && !!stripe.webhookSecretSet,
    },
  ];
}

function worldwide(g: Gateway) {
  const list = g.countries || [];
  return !list.length || list.some((c) => c === "*" || /^(world|global|all)/i.test(c));
}

function whereLine(g: Gateway) {
  if (worldwide(g)) return "Worldwide";
  return (g.countries || []).map((c) => countryByCode(c)?.name || c).join(", ");
}

/** A gateway with no checkout of its own: bank transfer, and a receipt staff check. */
function receiptOnly(g: Gateway | null) {
  return !!g && g.capabilities?.checkout === false && !!g.capabilities?.receiptUpload;
}

/** What a gateway lets members do, as short chips. */
function supports(g: Gateway): string[] {
  const c = g.capabilities || {};
  const pk = (g.countries || []).some((x) => x.toUpperCase() === "PK");
  const out: string[] = [];
  if (c.checkout !== false) out.push(worldwide(g) ? "Cards worldwide" : "Cards");
  if (c.receiptUpload) out.push("Bank transfer + receipt");
  if (c.wallets) out.push(...(pk ? ["JazzCash", "Easypaisa"] : ["Mobile wallets"]));
  if (c.bankApps) out.push(pk ? "Any bank app (Raast)" : "Bank apps");
  if (c.paymentLinks) out.push("Payment links");
  if (c.savedCards) out.push("Saved cards");
  if (c.autoCharge) out.push("Automatic charges");
  return out;
}

function optionList(field: GatewayField) {
  return (field.options || []).map((o) => (typeof o === "string" ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) } : o));
}

/** "3, 1" as the days to send a reminder, or null when it cannot be read. */
function parseDays(text: string): number[] | null {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return [];
  const days = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 30)) return null;
  return Array.from(new Set(days)).sort((a, b) => b - a);
}

function Heading({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
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
  stripePanel,
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
  /** The Stripe form, shown when Stripe is the chosen gateway. */
  stripePanel: React.ReactNode;
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
  const list = gateways && gateways.length ? gateways : builtInGateways(all);

  const configOf = (id: string): GatewayConfig => ((all[id] as GatewayConfig) || {}) as GatewayConfig;
  const savedConfigOf = (id: string): GatewayConfig => ((was?.[id] as GatewayConfig) || {}) as GatewayConfig;

  // The chosen gateway: as edited, else as the API derives it for a gym that
  // never chose (Stripe when it is switched on, otherwise none).
  const selectedId = all.onlinePayments?.provider || list.find((g) => g.selected)?.id || (all.stripe?.enabled ? "stripe" : NONE);
  const selected = list.find((g) => g.id === selectedId) || null;

  const choose = (id: string) => {
    const next: Record<string, unknown> = { ...all, onlinePayments: { ...(all.onlinePayments || {}), provider: id } };
    // The chosen gateway takes every new online payment (the server goes by
    // onlinePayments.provider). The others are left as they are rather than
    // switched off: members still on a Stripe subscription renew through
    // Stripe's webhook, which stops being recorded once Stripe is off.
    if (list.some((g) => g.id === id)) next[id] = { ...configOf(id), enabled: true };
    setSettings(next as unknown as T);
  };

  const setField = (id: string, name: string, value: unknown) =>
    setSettings({ ...all, [id]: { ...configOf(id), [name]: value } } as unknown as T);

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

  // ---- Test connection ----
  const tester = useAsyncAction();
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setTestResult(null), [selectedId]);
  const unsavedKeys = !!selected && JSON.stringify(configOf(selected.id)) !== JSON.stringify(savedConfigOf(selected.id));
  const test = (id: string) =>
    tester.run(async () => {
      setTestResult(null);
      try {
        const r = await apiJson<{ success?: boolean; message?: string }>(`${API_BASE}/settings/${encodeURIComponent(id)}/test`, "POST");
        setTestResult(
          r.success === false
            ? { ok: false, text: r.message || "The keys did not work." }
            : { ok: true, text: r.message || "Connected: the keys work." }
        );
      } catch (e) {
        setTestResult({
          ok: false,
          text: e instanceof ApiError && e.status === 404 ? "This gateway cannot be tested from here yet." : e instanceof Error ? e.message : "The test could not run.",
        });
      }
    });

  const save = async () => {
    if (parsedDays === null || lastDayBad) return;
    await onSave();
    await Promise.all([loadGateways(), onReloadStatus()]);
  };

  const live = !!status?.online && status.online.provider === selectedId;
  const autoChargeOn = !!billing.autoCharge?.enabled;
  const canAutoCharge = !!selected?.capabilities?.autoCharge;

  return (
    <div className="space-y-6">
      {/* ---- The gateway ---- */}
      <Card className="p-6">
        <Heading
          title="Choose your payment gateway"
          hint="How your members pay you online, straight into your own account. Only one gateway handles online payments at a time."
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => {
            const active = g.id === selectedId;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => choose(g.id)}
                aria-pressed={active}
                className={`rounded-xl border p-4 text-left transition-all ${
                  active ? "border-neutral-900 bg-neutral-50 ring-2 ring-neutral-900/10" : "border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{g.label}</p>
                    <p className="text-xs text-neutral-500">{whereLine(g)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {active && <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Selected</span>}
                    <Badge color={g.configured ? "green" : "neutral"}>
                      {receiptOnly(g) ? (g.configured ? "Bank account ready" : "No bank account yet") : g.configured ? "Keys saved" : "Not set up"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {supports(g).map((s) => (
                    <span key={s} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                      {s}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => choose(NONE)}
            aria-pressed={selectedId === NONE}
            className={`rounded-xl border p-4 text-left transition-all ${
              selectedId === NONE ? "border-neutral-900 bg-neutral-50 ring-2 ring-neutral-900/10" : "border-neutral-200 hover:border-neutral-400"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-neutral-900">No online payments</p>
              {selectedId === NONE && <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Selected</span>}
            </div>
            <p className="mt-1 text-xs text-neutral-500">Members pay at the desk, or by bank transfer when you have bank accounts set up.</p>
          </button>
        </div>
        {selectedId !== (was?.onlinePayments?.provider || list.find((g) => g.selected)?.id || (was?.stripe?.enabled ? "stripe" : NONE)) && (
          <p className="mt-4 text-xs font-medium text-amber-700">Not saved yet: press Save payment settings below to switch.</p>
        )}
      </Card>

      {/* ---- The chosen gateway's own form ---- */}
      {selected?.id === "stripe" && stripePanel}

      {selected && receiptOnly(selected) && (
        <Card className="p-6">
          <Heading title="Bank transfer with receipt" hint="No gateway account and no card fees: members pay straight into your own bank accounts, and your staff confirm each payment." />

          <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${selected.configured ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {selected.configured ? (
              "Ready: payment links show your bank accounts, and members can upload their receipts."
            ) : (
              <>
                Add at least one bank account, with its QR code if you have one, so members know where to pay.{" "}
                <Link href="/admin/settings?tab=banks" className="font-semibold underline">
                  Go to Banks
                </Link>
              </>
            )}
          </div>

          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-neutral-700">
            <li>Before the due date, members get a payment link by email and WhatsApp with the package, the amount, the due date and the last day to pay.</li>
            <li>
              The link shows the bank accounts and QR codes you keep under{" "}
              <Link href="/admin/settings?tab=banks" className="font-semibold underline">
                Banks
              </Link>
              .
            </li>
            <li>The member transfers the money from any bank app and uploads a screenshot of the receipt on the same page.</li>
            <li>
              Your staff check it under{" "}
              <Link href="/admin/package-orders?paymentStatus=processing&paymentMethod=bank_transfer" className="font-semibold underline">
                Package Orders → Payments to verify
              </Link>
              : approving renews the membership and sends a receipt; rejecting, with a reason, lets the member upload a new one.
            </li>
          </ol>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <SecondaryButton onClick={() => test(selected.id)} loading={tester.busy} disabled={saving}>
              Check bank accounts
            </SecondaryButton>
          </div>
          {testResult && (
            <p role={testResult.ok ? "status" : "alert"} className={`mt-3 rounded-lg px-3 py-2 text-sm ${testResult.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
              {testResult.text}
            </p>
          )}
        </Card>
      )}

      {selected && selected.id !== "stripe" && !receiptOnly(selected) && (
        <Card className="p-6">
          <Heading
            title={`${selected.label} settings`}
            hint="Stored securely on the server. Saved secrets are shown masked — leave a masked field untouched to keep the existing value."
          />

          {status && (
            <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${live ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              {live
                ? `Online payments are live on your website through ${selected.label}${status.online?.label ? `: ${status.online.label.charAt(0).toLowerCase()}${status.online.label.slice(1)}` : ""}.`
                : `Online payments are off on your website until ${selected.label} is chosen, its keys are saved and the webhook secret is in place.`}
            </div>
          )}

          {selected.id === "safepay" && (
            <div className="mb-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-semibold text-neutral-700">Before you start: what Safepay asks for</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-neutral-700">
                <li>The owner&apos;s CNIC.</li>
                <li>Your NTN (National Tax Number) from FBR.</li>
                <li>A bank account certificate, issued in the last 3 months, for the account the money should go to.</li>
                <li>
                  A Safepay merchant account: sign up at{" "}
                  <a href="https://getsafepay.pk" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                    getsafepay.pk
                  </a>
                  .
                </li>
                <li>Then copy your keys from the Safepay dashboard and paste them below.</li>
              </ol>
              <p className="mt-2 text-xs text-neutral-500">
                Members then pay by card, JazzCash, Easypaisa or any bank app, straight into your own bank account. GymsPilotPro never holds the money.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(selected.config_fields || []).map((field) => {
              const cfg = configOf(selected.id);
              const value = cfg[field.name];
              const secretSaved = isMaskedSecret(value) || cfg[`${field.name}Set`] === true;
              if (field.type === "select") {
                return (
                  <SelectField
                    key={field.name}
                    label={`${field.label}${field.required ? " *" : ""}`}
                    value={typeof value === "string" ? value : undefined}
                    onChange={(v) => setField(selected.id, field.name, v)}
                    options={optionList(field)}
                    placeholder="Choose…"
                    allowClear={false}
                  />
                );
              }
              const secret = field.secret || field.type === "password";
              return (
                <div key={field.name}>
                  <TextField
                    label={field.label}
                    type={secret ? "password" : "text"}
                    required={field.required}
                    value={typeof value === "string" || typeof value === "number" ? value : ""}
                    onChange={(v) => setField(selected.id, field.name, v)}
                    placeholder={field.placeholder}
                  />
                  {secretError?.field === `${selected.id}.${field.name}` ? (
                    <p role="alert" className="mt-1 text-xs text-rose-700">{secretError.message}</p>
                  ) : secret && secretSaved ? (
                    <p className="mt-1 text-xs text-neutral-500">Saved. Type a new one to replace it.</p>
                  ) : field.help ? (
                    <p className="mt-1 text-xs text-neutral-500">{field.help}</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {typeof configOf(selected.id).webhook_url === "string" && configOf(selected.id).webhook_url !== "" && (
            <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-semibold text-neutral-700">Your webhook address</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 break-all font-mono text-xs text-neutral-800">{String(configOf(selected.id).webhook_url)}</p>
                <CopyButton text={String(configOf(selected.id).webhook_url)} />
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                In your {selected.label} dashboard, add this address as your webhook endpoint and paste the webhook secret it gives you above. Payments are confirmed
                to your members&apos; records through it, so online payments stay off until the secret is saved.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <SecondaryButton onClick={() => test(selected.id)} loading={tester.busy} disabled={saving || unsavedKeys}>
              Test connection
            </SecondaryButton>
            <span className="text-xs text-neutral-500">{unsavedKeys ? "Save first: the test checks the saved keys." : `Checks the saved keys with ${selected.label}. Nothing is charged.`}</span>
          </div>
          {testResult && (
            <p role={testResult.ok ? "status" : "alert"} className={`mt-3 rounded-lg px-3 py-2 text-sm ${testResult.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
              {testResult.text}
            </p>
          )}
        </Card>
      )}

      {/* ---- Reminders ---- */}
      <Card className="p-6">
        <Heading
          title="Payment reminders"
          hint={
            receiptOnly(selected)
              ? "Before a membership falls due, on the day and on the last day to pay, members get a message with a link to your bank details, where they upload their receipt."
              : selected?.capabilities?.paymentLinks
              ? `Before a membership falls due, on the day and on the last day to pay, members get a message with a link to pay online through ${selected.label}. The link also offers your bank accounts for a transfer, when you have them set up.`
              : "Before a membership falls due, on the day and on the last day to pay, members get a reminder. A payment link is added once your gateway supports payment links."
          }
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <TextField
              label="Remind this many days before the due date"
              value={daysText}
              onChange={(v) => {
                // What is typed stays as typed (commas and all); the list is
                // stored once it reads as one.
                setDaysText(v);
                const days = parseDays(v);
                if (days) setBilling({ reminderDaysBefore: days });
              }}
              placeholder="3"
            />
            {parsedDays === null ? (
              <p role="alert" className="mt-1 text-xs text-rose-700">Whole days from 0 to 30, separated by commas (for example 7, 3).</p>
            ) : (
              <p className="mt-1 text-xs text-neutral-500">One or more, separated by commas: 7, 3 sends two reminders. Leave empty for none.</p>
            )}
          </div>
          <div>
            <TextField
              label="Last day to pay (days after the due date)"
              type="number"
              value={lastDay}
              onChange={(v) => setBilling({ lastDayAfterDue: v.trim() === "" ? 0 : Number(v) })}
            />
            {lastDayBad ? (
              <p role="alert" className="mt-1 text-xs text-rose-700">A whole number of days from 0 to 60.</p>
            ) : (
              <p className="mt-1 text-xs text-neutral-500">{lastDay === 0 ? "No last-day message." : `A final reminder ${lastDay} day${lastDay === 1 ? "" : "s"} after the due date. After that the membership simply lapses.`}</p>
            )}
          </div>
          <div className="flex items-end pb-1">
            <Toggle label="Remind on the due date" checked={billing.dueDayReminder ?? BILLING_DEFAULTS.dueDayReminder} onChange={(v) => setBilling({ dueDayReminder: v })} />
          </div>
        </div>
        <div className="mt-5 border-t border-neutral-100 pt-5">
          <p className="text-xs font-semibold text-neutral-700">Send by</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Toggle label="Email" checked={sendVia.email} onChange={(v) => setBilling({ sendVia: { ...sendVia, email: v } })} />
            <Toggle label="SMS" checked={sendVia.sms} onChange={(v) => setBilling({ sendVia: { ...sendVia, sms: v } })} />
            <Toggle label="WhatsApp" checked={sendVia.whatsapp} onChange={(v) => setBilling({ sendVia: { ...sendVia, whatsapp: v } })} />
            <Toggle label="Push notification" checked={sendVia.push} onChange={(v) => setBilling({ sendVia: { ...sendVia, push: v } })} />
          </div>
          <p className="mt-2 text-xs text-neutral-500">SMS and WhatsApp go through the providers set up under Messaging. Members who switched a channel off in their account are not sent it.</p>
        </div>
      </Card>

      {/* ---- Automatic charges ---- */}
      <Card className="p-6">
        <Heading
          title="Automatic card payments"
          hint="Members who tick “Save my card and pay automatically” when they pay online are charged on each due date. If the charge fails, they get the payment link instead. They can turn it off in their account at any time."
        />
        {canAutoCharge || autoChargeOn ? (
          <>
            <Toggle
              label="Charge saved cards automatically on the due date"
              checked={autoChargeOn}
              onChange={(v) => setBilling({ autoCharge: { ...(billing.autoCharge || {}), enabled: v } })}
            />
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              Switch on only after {selected?.label || "your gateway"} confirms automatic (merchant-initiated) charges for your account.
            </p>
            {autoChargeOn && !canAutoCharge && (
              <p className="mt-2 text-xs text-rose-700">{selected ? "The chosen gateway cannot charge saved cards, so nothing is charged automatically." : "No gateway is chosen, so nothing is charged automatically."}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-600">
            {receiptOnly(selected)
              ? "Members paying by bank transfer pay each time from their payment link."
              : selected
              ? `${selected.label} does not offer automatic charges of saved cards here.`
              : "Choose a gateway that supports saved cards to offer this."}
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {(parsedDays === null || lastDayBad) && <span className="text-xs text-rose-700">Fix the reminder days above to save.</span>}
        <PrimaryButton onClick={save} loading={saveBusy} disabled={saving || parsedDays === null || lastDayBad}>
          Save payment settings
        </PrimaryButton>
      </div>
    </div>
  );
}
