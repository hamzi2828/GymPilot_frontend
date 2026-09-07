"use client";

// Provisioning a gym: platform record, its own database, system roles,
// settings, homepage, legal pages and the owner's administrator account --
// one form, one request.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card, PrimaryButton, SecondaryButton, TextField, TextArea } from "../../../admin/_shared/ui";
import { platformFetch, type Plan, type Gym } from "../../_shared/api";

const COMMON_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Manila",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
];

export default function NewGymPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    domains: "",
    ownerFirstName: "",
    ownerLastName: "",
    ownerEmail: "",
    ownerPhone: "",
    ownerPassword: "",
    planId: "",
    timezone: "UTC",
    currency: "USD",
    country: "",
    notes: "",
  });

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    platformFetch<{ data: Plan[] }>("/plans")
      .then((res) => setPlans(res.data.filter((p) => p.isActive)))
      .catch(() => setPlans([]));
  }, []);

  const suggestedSlug = form.slug || form.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await platformFetch<{ data: Gym }>("/gyms", {
        method: "POST",
        body: {
          name: form.name,
          slug: suggestedSlug,
          domains: form.domains
            .split(/[\s,]+/)
            .map((d) => d.trim())
            .filter(Boolean),
          owner: {
            firstName: form.ownerFirstName,
            lastName: form.ownerLastName,
            email: form.ownerEmail,
            phone: form.ownerPhone,
            password: form.ownerPassword,
          },
          planId: form.planId || undefined,
          locale: { timezone: form.timezone, currency: form.currency, country: form.country },
          notes: form.notes,
        },
      });
      router.replace(`/super-admin/gyms/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the gym");
      setBusy(false);
    }
  };

  const select = "mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm";

  return (
    <>
      <PageHeader eyebrow="Platform" title="New gym" />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Gym</h2>
            <p className="mt-1 text-xs text-neutral-500">
              The slug names the gym&apos;s database and can be used as <span className="font-mono">slug.yourplatform.com</span>. It cannot be changed later.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField label="Gym name" value={form.name} onChange={set("name")} required placeholder="Iron Works Fitness" />
              <TextField label="Slug" value={form.slug} onChange={set("slug")} placeholder={suggestedSlug || "iron-works"} />
            </div>
            <div className="mt-4">
              <TextArea
                label="Domains (one per line or comma separated)"
                value={form.domains}
                onChange={set("domains")}
                placeholder={"ironworks.com\nwww.ironworks.com"}
              />
              <p className="mt-1 text-xs text-neutral-500">
                The first is the primary. Point each domain at the website deployment; the gym is served there as soon as it is saved here.
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Owner account</h2>
            <p className="mt-1 text-xs text-neutral-500">Created as an administrator inside the gym. Share the password with them; it is not emailed.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField label="First name" value={form.ownerFirstName} onChange={set("ownerFirstName")} />
              <TextField label="Last name" value={form.ownerLastName} onChange={set("ownerLastName")} />
              <TextField label="Email" type="email" value={form.ownerEmail} onChange={set("ownerEmail")} required />
              <TextField label="Phone" value={form.ownerPhone} onChange={set("ownerPhone")} />
              <TextField label="Password (min 8 characters)" type="password" value={form.ownerPassword} onChange={set("ownerPassword")} required />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-neutral-900">Plan &amp; locale</h2>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-neutral-700">Platform plan</span>
              <select value={form.planId} onChange={(e) => set("planId")(e.target.value)} className={select}>
                <option value="">No plan (unlimited, no billing)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price.currency} {p.price.monthly}/mo
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">With a plan the gym starts on its trial period.</p>
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-neutral-700">Timezone</span>
              <input list="tz-list" value={form.timezone} onChange={(e) => set("timezone")(e.target.value)} className={select} />
              <datalist id="tz-list">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-neutral-500">IANA name. Attendance, timetables and reminders run on this clock.</p>
            </label>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField label="Currency" value={form.currency} onChange={(v) => set("currency")(v.toUpperCase())} placeholder="USD" />
              <TextField label="Country" value={form.country} onChange={set("country")} placeholder="GB" />
            </div>
          </Card>

          <Card className="p-6">
            <TextArea label="Internal notes" value={form.notes} onChange={set("notes")} placeholder="Contract details, contacts…" />
          </Card>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="flex gap-2">
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create gym"}
            </PrimaryButton>
            <SecondaryButton onClick={() => router.push("/super-admin/gyms")} disabled={busy}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      </form>
    </>
  );
}
