"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card, Modal, PrimaryButton, SecondaryButton, DangerButton, TextField, TextArea, Toggle, Spinner, EmptyState, Badge } from "../../admin/_shared/ui";
import { platformFetch, formatMoney, type Plan } from "../_shared/api";

type Draft = {
  name: string;
  slug: string;
  description: string;
  monthly: string;
  yearly: string;
  currency: string;
  maxMembers: string;
  maxStaff: string;
  maxTrainers: string;
  maxClasses: string;
  features: string;
  trialDays: string;
  isActive: boolean;
  order: string;
};

const emptyDraft: Draft = {
  name: "",
  slug: "",
  description: "",
  monthly: "0",
  yearly: "0",
  currency: "USD",
  maxMembers: "0",
  maxStaff: "0",
  maxTrainers: "0",
  maxClasses: "0",
  features: "",
  trialDays: "14",
  isActive: true,
  order: "0",
};

function toDraft(plan: Plan): Draft {
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description || "",
    monthly: String(plan.price.monthly),
    yearly: String(plan.price.yearly),
    currency: plan.price.currency,
    maxMembers: String(plan.limits.maxMembers),
    maxStaff: String(plan.limits.maxStaff),
    maxTrainers: String(plan.limits.maxTrainers),
    maxClasses: String(plan.limits.maxClasses),
    features: (plan.features || []).join("\n"),
    trialDays: String(plan.trialDays),
    isActive: plan.isActive,
    order: String(plan.order),
  };
}

function limit(n: number) {
  return n ? n.toLocaleString() : "Unlimited";
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformFetch<{ data: Plan[] }>("/plans");
      setPlans(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setOpen(true);
  };
  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setDraft(toDraft(plan));
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      name: draft.name,
      slug: draft.slug || undefined,
      description: draft.description,
      price: { monthly: Number(draft.monthly) || 0, yearly: Number(draft.yearly) || 0, currency: draft.currency },
      limits: {
        maxMembers: Number(draft.maxMembers) || 0,
        maxStaff: Number(draft.maxStaff) || 0,
        maxTrainers: Number(draft.maxTrainers) || 0,
        maxClasses: Number(draft.maxClasses) || 0,
      },
      features: draft.features,
      trialDays: Number(draft.trialDays) || 0,
      isActive: draft.isActive,
      order: Number(draft.order) || 0,
    };
    try {
      if (editing) await platformFetch(`/plans/${editing.id}`, { method: "PUT", body });
      else await platformFetch("/plans", { method: "POST", body });
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save plan");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (plan: Plan) => {
    if (!window.confirm(`Delete the "${plan.name}" plan?`)) return;
    try {
      await platformFetch(`/plans/${plan.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete plan");
    }
  };

  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <>
      <PageHeader eyebrow="Platform" title="Plans" actions={<PrimaryButton onClick={openNew}>New plan</PrimaryButton>} />

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {loading ? (
        <Spinner />
      ) : !plans.length ? (
        <EmptyState title="No plans yet" hint="Create the plans you sell to gyms. Limits of 0 mean unlimited." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">{plan.name}</h2>
                  <p className="font-mono text-xs text-neutral-400">{plan.slug}</p>
                </div>
                {!plan.isActive && <Badge color="neutral">inactive</Badge>}
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
                {formatMoney(plan.price.monthly, plan.price.currency)}
                <span className="text-sm font-normal text-neutral-500"> /month</span>
              </p>
              <p className="text-xs text-neutral-500">
                {formatMoney(plan.price.yearly, plan.price.currency)} /year · {plan.trialDays}-day trial
              </p>
              {plan.description && <p className="mt-3 text-sm text-neutral-600">{plan.description}</p>}
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-600">
                <dt>Members</dt>
                <dd className="text-right font-medium text-neutral-900">{limit(plan.limits.maxMembers)}</dd>
                <dt>Staff</dt>
                <dd className="text-right font-medium text-neutral-900">{limit(plan.limits.maxStaff)}</dd>
                <dt>Trainers</dt>
                <dd className="text-right font-medium text-neutral-900">{limit(plan.limits.maxTrainers)}</dd>
                <dt>Classes</dt>
                <dd className="text-right font-medium text-neutral-900">{limit(plan.limits.maxClasses)}</dd>
              </dl>
              {plan.features.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-neutral-600">
                  {plan.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex items-center justify-between pt-5">
                <span className="text-xs text-neutral-500">{plan.gym_count || 0} gym(s)</span>
                <div className="flex gap-2">
                  <SecondaryButton onClick={() => openEdit(plan)}>Edit</SecondaryButton>
                  <DangerButton onClick={() => remove(plan)} disabled={!!plan.gym_count}>
                    Delete
                  </DangerButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : "New plan"} size="lg">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Name" value={draft.name} onChange={set("name")} required />
          <TextField label="Slug" value={draft.slug} onChange={set("slug")} placeholder="starter" />
          <div className="md:col-span-2">
            <TextArea label="Description" value={draft.description} onChange={set("description")} />
          </div>
          <TextField label="Monthly price" type="number" value={draft.monthly} onChange={set("monthly")} />
          <TextField label="Yearly price" type="number" value={draft.yearly} onChange={set("yearly")} />
          <TextField label="Currency" value={draft.currency} onChange={(v) => set("currency")(v.toUpperCase())} />
          <TextField label="Trial days" type="number" value={draft.trialDays} onChange={set("trialDays")} />
          <TextField label="Max members (0 = unlimited)" type="number" value={draft.maxMembers} onChange={set("maxMembers")} />
          <TextField label="Max staff (0 = unlimited)" type="number" value={draft.maxStaff} onChange={set("maxStaff")} />
          <TextField label="Max trainers (0 = unlimited)" type="number" value={draft.maxTrainers} onChange={set("maxTrainers")} />
          <TextField label="Max classes (0 = unlimited)" type="number" value={draft.maxClasses} onChange={set("maxClasses")} />
          <div className="md:col-span-2">
            <TextArea label="Features (one per line)" value={draft.features} onChange={set("features")} />
          </div>
          <TextField label="Sort order" type="number" value={draft.order} onChange={set("order")} />
          <div className="flex items-end pb-2">
            <Toggle label="Active (offered to new gyms)" checked={draft.isActive} onChange={(v) => setDraft((d) => ({ ...d, isActive: v }))} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={save} disabled={busy || !draft.name.trim()}>
            {busy ? "Saving…" : "Save plan"}
          </PrimaryButton>
        </div>
      </Modal>
    </>
  );
}
