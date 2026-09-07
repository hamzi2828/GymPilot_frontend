"use client";

// One gym: what it is, what it is on, whether it is being served, and the
// numbers from inside its own database.

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, Modal, PrimaryButton, SecondaryButton, DangerButton, TextField, TextArea, Spinner, Badge } from "../../../admin/_shared/ui";
import { platformFetch, formatDate, formatMoney, SUBSCRIPTION_STATUSES, BILLING_CYCLES, type Gym, type GymStats, type Plan } from "../../_shared/api";
import { SubscriptionBadge } from "../GymsTable";

type Detail = Gym & { plan: Plan | null; stats: GymStats };
type Admin = { id: string; name: string; email: string; is_active: boolean; last_login: string | null };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-800">{children}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

export default function GymDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [gym, setGym] = useState<Detail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // What the website host said when domains were saved: added to Vercel,
  // or the DNS record the owner has to create.
  const [hosting, setHosting] = useState<{ connected: boolean; added: { host: string; added: boolean; verified?: boolean; error?: string; skipped?: string; verification?: { type: string; domain: string; value: string }[]; dns: { type: string; name: string; value: string; note: string } }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  // Editors
  const [details, setDetails] = useState({ name: "", ownerFirstName: "", ownerLastName: "", ownerEmail: "", ownerPhone: "", timezone: "", currency: "", country: "", notes: "" });
  const [domainsText, setDomainsText] = useState("");
  const [sub, setSub] = useState({ planId: "", status: "trialing", billingCycle: "monthly", amount: "", currency: "", currentPeriodEnd: "", notes: "" });
  const [resetOpen, setResetOpen] = useState(false);
  const [reset, setReset] = useState({ email: "", password: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [dropDatabase, setDropDatabase] = useState(false);

  const hydrate = useCallback((g: Detail) => {
    setGym(g);
    setDetails({
      name: g.name,
      ownerFirstName: g.owner.firstName || "",
      ownerLastName: g.owner.lastName || "",
      ownerEmail: g.owner.email || "",
      ownerPhone: g.owner.phone || "",
      timezone: g.locale.timezone || "UTC",
      currency: g.locale.currency || "USD",
      country: g.locale.country || "",
      notes: g.notes || "",
    });
    setDomainsText(g.domains.map((d) => d.host).join("\n"));
    setSub({
      planId: g.plan ? g.plan.id || g.plan._id || "" : "",
      status: g.subscription.status,
      billingCycle: g.subscription.billingCycle,
      amount: String(g.subscription.amount ?? ""),
      currency: g.subscription.currency || "USD",
      currentPeriodEnd: g.subscription.currentPeriodEnd ? String(g.subscription.currentPeriodEnd).slice(0, 10) : "",
      notes: g.subscription.notes || "",
    });
    setReset((r) => ({ ...r, email: g.owner.email || "" }));
  }, []);

  const load = useCallback(async () => {
    try {
      const [detail, planList] = await Promise.all([
        platformFetch<{ data: Detail }>(`/gyms/${id}`),
        platformFetch<{ data: Plan[] }>("/plans"),
      ]);
      hydrate(detail.data);
      setPlans(planList.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this gym");
    }
  }, [id, hydrate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    platformFetch<{ data: Admin[] }>(`/gyms/${id}/admins`)
      .then((res) => setAdmins(res.data))
      .catch(() => setAdmins([]));
  }, [id, gym?.updatedAt]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
      setNotice(label);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  if (error && !gym) return <p className="text-sm text-rose-600">{error}</p>;
  if (!gym) return <Spinner />;

  const stats = gym.stats || {};
  const input = "mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm";

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/super-admin/gyms" className="hover:underline">Gyms</Link> as unknown as string}
        title={gym.name}
        actions={
          <>
            <SubscriptionBadge status={gym.subscription.status} />
            {gym.status === "suspended" ? (
              <PrimaryButton disabled={busy} onClick={() => run("Gym reactivated", () => platformFetch(`/gyms/${id}/status`, { method: "PATCH", body: { status: "active" } }))}>
                Reactivate
              </PrimaryButton>
            ) : (
              <DangerButton disabled={busy} onClick={() => run("Gym suspended", () => platformFetch(`/gyms/${id}/status`, { method: "PATCH", body: { status: "suspended" } }))}>
                Suspend
              </DangerButton>
            )}
          </>
        }
      />

      {gym.access_block && (
        <p className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
          Not being served: {gym.access_block.message}
        </p>
      )}
      {error && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</p>}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Members" value={stats.members ?? "—"} />
        <Stat label="Active memberships" value={stats.active_memberships ?? "—"} />
        <Stat label="Staff" value={stats.staff ?? "—"} />
        <Stat label="Trainers" value={stats.trainers ?? "—"} />
        <Stat label="Classes" value={stats.classes ?? "—"} />
        <Stat
          label="Revenue this month"
          value={
            stats.revenue_this_month && stats.revenue_this_month.length
              ? stats.revenue_this_month.map((r) => formatMoney(r.total, r.currency)).join(" · ")
              : "—"
          }
        />
      </div>
      {stats.error && <p className="mt-2 text-xs text-rose-600">Could not read the gym&apos;s database: {stats.error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Identity */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Gym &amp; owner</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Slug">
              <span className="font-mono">{gym.slug}</span>
            </Field>
            <Field label="Database">
              <span className="font-mono">{gym.database.name}</span>
            </Field>
            <Field label="Created">{formatDate(gym.createdAt)}</Field>
            <Field label="Last login inside gym">{formatDate(stats.last_login_at)}</Field>
          </dl>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextField label="Gym name" value={details.name} onChange={(v) => setDetails((d) => ({ ...d, name: v }))} />
            <TextField label="Owner email" type="email" value={details.ownerEmail} onChange={(v) => setDetails((d) => ({ ...d, ownerEmail: v }))} />
            <TextField label="Owner first name" value={details.ownerFirstName} onChange={(v) => setDetails((d) => ({ ...d, ownerFirstName: v }))} />
            <TextField label="Owner last name" value={details.ownerLastName} onChange={(v) => setDetails((d) => ({ ...d, ownerLastName: v }))} />
            <TextField label="Owner phone" value={details.ownerPhone} onChange={(v) => setDetails((d) => ({ ...d, ownerPhone: v }))} />
            <TextField label="Timezone (IANA)" value={details.timezone} onChange={(v) => setDetails((d) => ({ ...d, timezone: v }))} />
            <TextField label="Currency" value={details.currency} onChange={(v) => setDetails((d) => ({ ...d, currency: v.toUpperCase() }))} />
            <TextField label="Country" value={details.country} onChange={(v) => setDetails((d) => ({ ...d, country: v }))} />
          </div>
          <div className="mt-4">
            <TextArea label="Internal notes" value={details.notes} onChange={(v) => setDetails((d) => ({ ...d, notes: v }))} />
          </div>
          <div className="mt-4 flex justify-end">
            <PrimaryButton
              disabled={busy}
              onClick={() =>
                run("Details saved", () =>
                  platformFetch(`/gyms/${id}`, {
                    method: "PUT",
                    body: {
                      name: details.name,
                      owner: { firstName: details.ownerFirstName, lastName: details.ownerLastName, email: details.ownerEmail, phone: details.ownerPhone },
                      locale: { timezone: details.timezone, currency: details.currency, country: details.country },
                      notes: details.notes,
                    },
                  })
                )
              }
            >
              Save details
            </PrimaryButton>
          </div>
        </Card>

        {/* Domains */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Domains</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Every domain that should show this gym&apos;s website. The first line is the primary, used in emails and redirects. Point each one at the website deployment.
          </p>
          <div className="mt-4">
            <TextArea label="One domain per line" value={domainsText} onChange={setDomainsText} placeholder={"ironworks.com\nwww.ironworks.com"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {gym.domains.map((d) => (
              <Badge key={d.host} color={d.isPrimary ? "green" : "neutral"}>
                {d.host}
                {d.isPrimary ? " · primary" : ""}
              </Badge>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <PrimaryButton
              disabled={busy}
              onClick={() =>
                run("Domains saved", async () => {
                  const res = await platformFetch<{ hosting?: typeof hosting }>(`/gyms/${id}/domains`, {
                    method: "PUT",
                    body: {
                      domains: domainsText
                        .split(/[\s,]+/)
                        .map((h) => h.trim())
                        .filter(Boolean)
                        .map((host, i) => ({ host, isPrimary: i === 0 })),
                    },
                  });
                  setHosting(res.hosting || null);
                })
              }
            >
              Save domains
            </PrimaryButton>
          </div>
          {hosting && hosting.added.length > 0 && (
            <div className="mt-4 space-y-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-700">
              {hosting.added.map((h) => (
                <div key={h.host}>
                  <p className="font-semibold text-neutral-900">
                    {h.host} — {h.added ? (h.verified === false ? "added to Vercel, awaiting verification" : "added to the website host") : h.skipped ? "not added automatically" : `could not be added (${h.error})`}
                  </p>
                  <p>
                    DNS: add a <span className="font-mono">{h.dns.type}</span> record for <span className="font-mono">{h.dns.name}</span> pointing to <span className="font-mono">{h.dns.value}</span>. {h.dns.note}
                  </p>
                  {(h.verification || []).map((v, i) => (
                    <p key={i}>
                      Verification: <span className="font-mono">{v.type}</span> record <span className="font-mono">{v.domain}</span> = <span className="font-mono">{v.value}</span>
                    </p>
                  ))}
                </div>
              ))}
              {!hosting.connected && <p className="text-neutral-500">Connect Vercel on the API (VERCEL_TOKEN, VERCEL_PROJECT_ID) to add domains to the website project automatically.</p>}
            </div>
          )}
        </Card>

        {/* Subscription */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Plan &amp; subscription</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Renewals are recorded here. When the period end passes the gym goes past due, and after the grace period it stops being served.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-neutral-700">Plan</span>
              <select value={sub.planId} onChange={(e) => setSub((s) => ({ ...s, planId: e.target.value }))} className={input}>
                <option value="">No plan (unlimited)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price.currency} {p.price.monthly}/mo
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-neutral-700">Status</span>
              <select value={sub.status} onChange={(e) => setSub((s) => ({ ...s, status: e.target.value }))} className={input}>
                {SUBSCRIPTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-neutral-700">Billing cycle</span>
              <select value={sub.billingCycle} onChange={(e) => setSub((s) => ({ ...s, billingCycle: e.target.value }))} className={input}>
                {BILLING_CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Period ends" type="date" value={sub.currentPeriodEnd} onChange={(v) => setSub((s) => ({ ...s, currentPeriodEnd: v }))} />
            <TextField label="Amount per cycle" type="number" value={sub.amount} onChange={(v) => setSub((s) => ({ ...s, amount: v }))} />
            <TextField label="Currency" value={sub.currency} onChange={(v) => setSub((s) => ({ ...s, currency: v.toUpperCase() }))} />
          </div>
          <div className="mt-4">
            <TextArea label="Billing notes" value={sub.notes} onChange={(v) => setSub((s) => ({ ...s, notes: v }))} />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              Currently {gym.subscription.status.replace("_", " ")}
              {gym.subscription.currentPeriodEnd ? ` until ${formatDate(gym.subscription.currentPeriodEnd)}` : ""} ·{" "}
              {formatMoney(gym.subscription.amount, gym.subscription.currency)} / {gym.subscription.billingCycle}
            </p>
            <PrimaryButton
              disabled={busy}
              onClick={() =>
                run("Subscription saved", () =>
                  platformFetch(`/gyms/${id}/subscription`, {
                    method: "PUT",
                    body: {
                      planId: sub.planId,
                      status: sub.status,
                      billingCycle: sub.billingCycle,
                      amount: sub.amount === "" ? undefined : Number(sub.amount),
                      currency: sub.currency,
                      currentPeriodEnd: sub.currentPeriodEnd || null,
                      notes: sub.notes,
                    },
                  })
                )
              }
            >
              Save subscription
            </PrimaryButton>
          </div>
        </Card>

        {/* Administrators */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Administrators inside the gym</h2>
            <SecondaryButton onClick={() => setResetOpen(true)}>Reset owner password</SecondaryButton>
          </div>
          {admins === null ? (
            <p className="mt-4 text-xs text-neutral-500">Loading…</p>
          ) : !admins.length ? (
            <p className="mt-4 text-xs text-neutral-500">No administrator account yet. Use &quot;Reset owner password&quot; to create one.</p>
          ) : (
            <ul className="mt-4 divide-y divide-neutral-100">
              {admins.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-neutral-900">{a.name || a.email}</p>
                    <p className="text-xs text-neutral-500">{a.email}</p>
                  </div>
                  <div className="text-right text-xs text-neutral-500">
                    {a.is_active ? "active" : <Badge color="rose">disabled</Badge>}
                    <p>last login {formatDate(a.last_login)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-neutral-500">
            The owner signs in at <span className="font-mono">{gym.domains[0] ? `${gym.domains[0].host}/authentication` : "<domain>/authentication"}</span> and manages the gym at <span className="font-mono">/admin</span>.
          </p>
        </Card>
      </div>

      {/* Danger zone */}
      <Card className="mt-6 border-rose-200 p-6">
        <h2 className="text-sm font-semibold text-rose-700">Danger zone</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Removing the gym takes it off the platform. Its database is kept unless you choose to drop it, in which case every member, payment and attendance record is gone for good.
        </p>
        <div className="mt-4">
          <DangerButton onClick={() => setDeleteOpen(true)}>Delete this gym</DangerButton>
        </div>
      </Card>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset owner password" size="sm">
        <p className="text-xs text-neutral-500">Sets a new password on this administrator inside the gym, or creates the account if the address is new. Tell them the password yourself; it is not emailed.</p>
        <div className="mt-4 space-y-4">
          <TextField label="Email" type="email" value={reset.email} onChange={(v) => setReset((r) => ({ ...r, email: v }))} />
          <TextField label="New password (min 8 characters)" type="password" value={reset.password} onChange={(v) => setReset((r) => ({ ...r, password: v }))} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={() => setResetOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton
            disabled={busy || reset.password.length < 8}
            onClick={async () => {
              await run("Owner password updated", () => platformFetch(`/gyms/${id}/reset-owner-password`, { method: "POST", body: reset }));
              setResetOpen(false);
              setReset((r) => ({ ...r, password: "" }));
            }}
          >
            Set password
          </PrimaryButton>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={`Delete ${gym.name}`} size="sm">
        <p className="text-sm text-neutral-700">
          Type <span className="font-mono font-semibold">{gym.slug}</span> to confirm.
        </p>
        <div className="mt-4 space-y-4">
          <TextField label="Slug" value={confirmSlug} onChange={setConfirmSlug} />
          <label className="flex items-center gap-2 text-sm text-rose-700">
            <input type="checkbox" checked={dropDatabase} onChange={(e) => setDropDatabase(e.target.checked)} className="h-4 w-4 accent-rose-600" />
            Also drop the database <span className="font-mono text-xs">{gym.database.name}</span> (irreversible)
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={() => setDeleteOpen(false)}>Cancel</SecondaryButton>
          <DangerButton
            disabled={busy || confirmSlug !== gym.slug}
            onClick={async () => {
              setBusy(true);
              try {
                await platformFetch(`/gyms/${id}`, { method: "DELETE", body: { confirmSlug, dropDatabase } });
                router.replace("/super-admin/gyms");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not delete the gym");
                setBusy(false);
                setDeleteOpen(false);
              }
            }}
          >
            Delete gym
          </DangerButton>
        </div>
      </Modal>
    </>
  );
}
