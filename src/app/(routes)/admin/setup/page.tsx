"use client";

// First-run setup for a new gym: the handful of things that have to exist
// before the website and the desk make sense -- name and contact details,
// currency and clock, a first package, a way to get paid, and the first
// staff account. Each step saves through the same endpoints the full
// settings screens use, so nothing here is a second way of doing things.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card, PrimaryButton, SecondaryButton, TextField, TextArea, Toggle, UpgradePlanLink } from "../_shared/ui";
import { API_BASE, GYMFOLIO_API, apiGet, apiJson, apiForm, isPlanLimitError } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";

const STEPS = ["Your gym", "Money & time", "First package", "Getting paid", "Your team", "Done"] as const;

const COMMON_TIMEZONES = ["UTC", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Riyadh", "Asia/Karachi", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney", "Africa/Lagos", "Africa/Johannesburg", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto"];

interface SettingsShape {
  siteName?: string;
  siteUrl?: string;
  mobileNumber?: string;
  address?: string;
  currency?: string;
  taxRate?: number;
  ianaTimezone?: string;
  stripe?: { enabled?: boolean; publishableKey?: string; secretKey?: string; webhookSecret?: string; secretKeySet?: boolean };
  stripeWebhookUrl?: string;
  setupCompletedAt?: string | null;
}

export default function SetupWizardPage() {
  const router = useRouter();
  const { reload } = usePermissions();
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<SettingsShape>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when a step was refused by the gym's platform plan (e.g. the staff
  // limit), so the error can link straight to Billing.
  const [planLimit, setPlanLimit] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [pkg, setPkg] = useState({ name: "Monthly", price: "", period: "month", features: "Full gym access\nAll classes", recurring: false });
  const [packageCreated, setPackageCreated] = useState<string | null>(null);
  const [payment, setPayment] = useState({ useStripe: false, publishableKey: "", secretKey: "", webhookSecret: "", useBank: false, bankName: "", accountTitle: "", accountNumber: "", iban: "" });
  const [staff, setStaff] = useState({ firstName: "", lastName: "", email: "", role: "receptionist" });
  const [staffCreated, setStaffCreated] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ data: SettingsShape }>(`${API_BASE}/settings`);
      setSettings(r.data || {});
      setPayment((p) => ({ ...p, useStripe: !!r.data?.stripe?.enabled, publishableKey: r.data?.stripe?.publishableKey || "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<void>, next = true) => {
    setBusy(true);
    setError(null);
    setPlanLimit(false);
    setNotice(null);
    try {
      await fn();
      if (next) setStep((s) => Math.min(STEPS.length - 1, s + 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPlanLimit(isPlanLimitError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveGym = () =>
    run(async () => {
      if (!settings.siteName?.trim()) throw new Error("Give your gym a name");
      await apiJson(`${API_BASE}/settings`, "PUT", { siteName: settings.siteName, mobileNumber: settings.mobileNumber || "", address: settings.address || "", siteUrl: settings.siteUrl || "" });
      if (logoFile) {
        const form = new FormData();
        form.append("logo", logoFile);
        try {
          await apiForm(`${API_BASE}/settings/logo`, "POST", form);
        } catch (e) {
          // The shared helper says why (too large, server down); this says
          // what to do about it.
          const why = e instanceof Error ? e.message : "The logo could not be uploaded.";
          throw new Error(`${why} You can add the logo later under Settings → Logo.`);
        }
      }
    });

  const saveMoney = () =>
    run(async () => {
      await apiJson(`${API_BASE}/settings`, "PUT", { currency: settings.currency || "USD", taxRate: Number(settings.taxRate) || 0, ianaTimezone: settings.ianaTimezone || "UTC" });
    });

  const savePackage = () =>
    run(async () => {
      if (!pkg.name.trim() || !pkg.price.trim()) throw new Error("Give the package a name and a price");
      const r = await apiJson<{ data?: { name?: string } }>(`${GYMFOLIO_API}/packages`, "POST", {
        name: pkg.name,
        price: pkg.price,
        currency: settings.currency || "USD",
        period: pkg.recurring ? "month" : pkg.period,
        features: pkg.features.split("\n").map((s) => s.trim()).filter(Boolean),
        kind: "membership",
        billing: pkg.recurring ? { mode: "recurring", interval: "month", intervalCount: 1, trialDays: 0 } : { mode: "one_time" },
      });
      setPackageCreated(r.data?.name || pkg.name);
    });

  const savePayment = () =>
    run(async () => {
      if (payment.useStripe) {
        if (!payment.publishableKey.trim() || (!payment.secretKey.trim() && !settings.stripe?.secretKeySet)) throw new Error("Enter your Stripe publishable and secret keys");
        await apiJson(`${API_BASE}/settings`, "PUT", { stripe: { enabled: true, publishableKey: payment.publishableKey, ...(payment.secretKey ? { secretKey: payment.secretKey } : {}), ...(payment.webhookSecret ? { webhookSecret: payment.webhookSecret } : {}) } });
      }
      if (payment.useBank) {
        if (!payment.bankName.trim() || !payment.accountTitle.trim() || !payment.accountNumber.trim()) throw new Error("Enter the bank name, account title and number");
        await apiJson(`${API_BASE}/banks`, "POST", { name: payment.bankName, accountTitle: payment.accountTitle, accountNumber: payment.accountNumber, iban: payment.iban });
      }
    });

  const saveStaff = () =>
    run(async () => {
      if (!staff.email.trim()) return;
      const r = await apiJson<{ message: string }>(`${API_BASE}/staff`, "POST", { firstName: staff.firstName, lastName: staff.lastName, email: staff.email, role: staff.role });
      setStaffCreated(r.message || `${staff.email} invited`);
    });

  const finish = () =>
    run(async () => {
      await apiJson(`${API_BASE}/settings`, "PUT", { setupCompleted: true });
      await reload();
      router.replace("/admin");
    }, false);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  const input = "mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Welcome" title="Set up your gym" />

      <ol className="mb-8 flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li key={label} className={`rounded-full px-3 py-1 ${i === step ? "bg-neutral-900 text-white" : i < step ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && (
        <p className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
          {planLimit && <UpgradePlanLink />}
        </p>
      )}
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</p>}

      <Card className="p-6">
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">These show on your website, in emails and on invoices.</p>
            <TextField label="Gym name" required value={settings.siteName} onChange={(v) => setSettings({ ...settings, siteName: v })} />
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Phone" value={settings.mobileNumber} onChange={(v) => setSettings({ ...settings, mobileNumber: v })} />
              <TextField label="Website address" value={settings.siteUrl} onChange={(v) => setSettings({ ...settings, siteUrl: v })} placeholder="https://yourgym.com" />
            </div>
            <TextArea label="Address" value={settings.address} onChange={(v) => setSettings({ ...settings, address: v })} />
            <label className="block text-sm">
              <span className="text-xs font-semibold text-neutral-700">Logo (optional)</span>
              <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="mt-1 block text-sm" />
            </label>
            <div className="flex justify-end">
              <PrimaryButton onClick={saveGym} disabled={busy}>{busy ? "Saving…" : "Save and continue"}</PrimaryButton>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Prices are shown and charged in this currency. Attendance, timetables and reminders run on this clock.</p>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Currency (ISO code)" value={settings.currency} onChange={(v) => setSettings({ ...settings, currency: v.toUpperCase() })} placeholder="USD" />
              <TextField label="Tax included in prices (%)" type="number" value={settings.taxRate} onChange={(v) => setSettings({ ...settings, taxRate: Number(v) || 0 })} />
              <label className="block">
                <span className="text-xs font-semibold text-neutral-700">Timezone</span>
                <input list="tz" value={settings.ianaTimezone || ""} onChange={(e) => setSettings({ ...settings, ianaTimezone: e.target.value })} className={input} />
                <datalist id="tz">{COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz} />)}</datalist>
              </label>
            </div>
            <div className="flex justify-between">
              <SecondaryButton onClick={() => setStep(0)}>Back</SecondaryButton>
              <PrimaryButton onClick={saveMoney} disabled={busy}>{busy ? "Saving…" : "Save and continue"}</PrimaryButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Your first membership package. You can add more, session packs and day passes later under Packages.</p>
            {packageCreated && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{packageCreated} created.</p>}
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Name" value={pkg.name} onChange={(v) => setPkg({ ...pkg, name: v })} />
              <TextField label={`Price (${settings.currency || "USD"})`} value={pkg.price} onChange={(v) => setPkg({ ...pkg, price: v })} placeholder="40" />
              <TextField label="Period" value={pkg.period} onChange={(v) => setPkg({ ...pkg, period: v })} placeholder="month" />
            </div>
            <TextArea label="What is included (one per line)" value={pkg.features} onChange={(v) => setPkg({ ...pkg, features: v })} />
            <Toggle label="Charge the card automatically every month (needs Stripe, next step)" checked={pkg.recurring} onChange={(v) => setPkg({ ...pkg, recurring: v })} />
            <div className="flex justify-between">
              <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
              <div className="flex gap-2">
                <SecondaryButton onClick={() => setStep(3)}>Skip</SecondaryButton>
                <PrimaryButton onClick={savePackage} disabled={busy}>{busy ? "Saving…" : "Create and continue"}</PrimaryButton>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-neutral-600">How members pay online. You can offer both.</p>
            <div className="rounded-lg border border-neutral-200 p-4">
              <Toggle label="Card payments through my Stripe account" checked={payment.useStripe} onChange={(v) => setPayment({ ...payment, useStripe: v })} />
              {payment.useStripe && (
                <div className="mt-3 grid gap-3">
                  <TextField label="Publishable key" value={payment.publishableKey} onChange={(v) => setPayment({ ...payment, publishableKey: v })} placeholder="pk_live_…" />
                  <TextField label={settings.stripe?.secretKeySet ? "Secret key (saved — type to replace)" : "Secret key"} type="password" value={payment.secretKey} onChange={(v) => setPayment({ ...payment, secretKey: v })} placeholder="sk_live_…" />
                  <TextField label="Webhook signing secret (for automatic renewals)" type="password" value={payment.webhookSecret} onChange={(v) => setPayment({ ...payment, webhookSecret: v })} placeholder="whsec_…" />
                  {settings.stripeWebhookUrl && <p className="text-xs text-neutral-500">Add this webhook URL in Stripe: <span className="font-mono">{settings.stripeWebhookUrl}</span></p>}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-neutral-200 p-4">
              <Toggle label="Bank transfer (members send money, you confirm it)" checked={payment.useBank} onChange={(v) => setPayment({ ...payment, useBank: v })} />
              {payment.useBank && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <TextField label="Bank" value={payment.bankName} onChange={(v) => setPayment({ ...payment, bankName: v })} />
                  <TextField label="Account title" value={payment.accountTitle} onChange={(v) => setPayment({ ...payment, accountTitle: v })} />
                  <TextField label="Account number" value={payment.accountNumber} onChange={(v) => setPayment({ ...payment, accountNumber: v })} />
                  <TextField label="IBAN (optional)" value={payment.iban} onChange={(v) => setPayment({ ...payment, iban: v })} />
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <SecondaryButton onClick={() => setStep(2)}>Back</SecondaryButton>
              <div className="flex gap-2">
                <SecondaryButton onClick={() => setStep(4)}>Skip for now</SecondaryButton>
                <PrimaryButton onClick={savePayment} disabled={busy}>{busy ? "Saving…" : "Save and continue"}</PrimaryButton>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Invite the person at the front desk. They get an email with a temporary password; you can add more under Staff.</p>
            {staffCreated && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{staffCreated}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="First name" value={staff.firstName} onChange={(v) => setStaff({ ...staff, firstName: v })} />
              <TextField label="Last name" value={staff.lastName} onChange={(v) => setStaff({ ...staff, lastName: v })} />
              <TextField label="Email" type="email" value={staff.email} onChange={(v) => setStaff({ ...staff, email: v })} />
              <label className="block">
                <span className="text-xs font-semibold text-neutral-700">Role</span>
                <select value={staff.role} onChange={(e) => setStaff({ ...staff, role: e.target.value })} className={input}>
                  <option value="receptionist">Receptionist</option>
                  <option value="manager">Manager</option>
                  <option value="trainer">Trainer</option>
                  <option value="accountant">Accountant</option>
                </select>
              </label>
            </div>
            <div className="flex justify-between">
              <SecondaryButton onClick={() => setStep(3)}>Back</SecondaryButton>
              <div className="flex gap-2">
                <SecondaryButton onClick={() => setStep(5)}>Skip</SecondaryButton>
                <PrimaryButton onClick={saveStaff} disabled={busy}>{busy ? "Saving…" : "Invite and continue"}</PrimaryButton>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-900">You&apos;re set.</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600">
              <li>Members can sign up on your website and buy a package.</li>
              <li>The front desk checks people in with the web kiosk at <span className="font-mono">/kiosk</span>, or the Windows attendance app.</li>
              <li>Import your existing members from a spreadsheet under Users → Import CSV.</li>
              <li>Everything else — classes, trainers, homepage, emails — lives in the menu on the left.</li>
            </ul>
            <div className="flex justify-between">
              <SecondaryButton onClick={() => setStep(4)}>Back</SecondaryButton>
              <PrimaryButton onClick={finish} disabled={busy}>{busy ? "Finishing…" : "Go to the dashboard"}</PrimaryButton>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
