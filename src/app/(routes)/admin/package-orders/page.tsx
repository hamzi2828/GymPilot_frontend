"use client";

import { useEffect, useState } from "react";
import {
  PageHeader,
  Modal,
  SecondaryButton,
  PrimaryButton,
  SelectField,
  TextField,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { API_BASE, GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";

interface Member {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface PackageOption {
  _id: string;
  name: string;
  price: number;
  currency?: string;
  period?: string;
}

interface PackageOrder {
  _id: string;
  orderNumber: string;
  packageDetails: { name: string; price: string; currency: string; period: string };
  customerInfo: { fullName: string; email: string; phone: string };
  payment: { amount: number; currency: string; status: string };
  subscription?: { isActive: boolean; startDate?: string; endDate?: string };
  status: string;
  createdAt: string;
}

const statusColors: Record<string, "neutral" | "green" | "amber" | "rose" | "blue"> = {
  pending: "amber",
  processing: "blue",
  paid: "green",
  completed: "green",
  failed: "rose",
  cancelled: "rose",
  refunded: "neutral",
};

const orderStatuses = ["pending", "processing", "completed", "cancelled", "refunded"];

export default function PackageOrdersAdminPage() {
  const [list, setList] = useState<PackageOrder[]>([]);
  // How many orders exist, as opposed to how many are on screen. The two can
  // differ once a gym has more than the fetch limit, and saying so is better
  // than a table that looks complete and is not.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PackageOrder | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  // Assign a package directly to a member (cash/bank payments taken in person,
  // or a comped membership) without going through checkout.
  const [assignOpen, setAssignOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const emptyAssign = { userId: "", packageId: "", paymentMethod: "cash", markPaid: "yes", durationMonths: "", notes: "" };
  const [assignDraft, setAssignDraft] = useState(emptyAssign);

  const openAssign = async () => {
    setAssignDraft(emptyAssign);
    setAssignErr(null);
    setAssignOpen(true);
    try {
      const [u, p] = await Promise.all([
        apiGet<{ data?: Member[]; users?: Member[] }>(`${API_BASE}/get/allUsers`),
        apiGet<{ data?: PackageOption[] }>(`${GYMFOLIO_API}/packages`),
      ]);
      setMembers(u.data || u.users || []);
      setPackages(p.data || []);
    } catch (e) {
      setAssignErr(e instanceof Error ? e.message : "Could not load members or packages.");
    }
  };

  const assignPackage = async () => {
    if (!assignDraft.userId || !assignDraft.packageId) {
      setAssignErr("Choose both a member and a package.");
      return;
    }
    setAssigning(true);
    setAssignErr(null);
    try {
      const res = await apiJson<{ message: string }>(`${GYMFOLIO_API}/package-orders/assign`, "POST", {
        userId: assignDraft.userId,
        packageId: assignDraft.packageId,
        paymentMethod: assignDraft.paymentMethod,
        markPaid: assignDraft.markPaid === "yes",
        durationMonths: assignDraft.durationMonths ? Number(assignDraft.durationMonths) : undefined,
        notes: assignDraft.notes || undefined,
      });
      setAssignOpen(false);
      setNotice(res.message || "Package assigned.");
      await load();
    } catch (e) {
      setAssignErr(e instanceof Error ? e.message : "Could not assign the package.");
    } finally {
      setAssigning(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      // An explicit limit, because the endpoint's own default is 20 and this
      // page asked for no page at all -- so it had been showing the 20 most
      // recent orders and silently dropping every one before them, with no
      // paging control to reveal that anything was missing.
      const r = await apiGet<{
        data: PackageOrder[];
        orders?: PackageOrder[];
        pagination?: { total: number };
      }>(`${GYMFOLIO_API}/package-orders?limit=200`);
      const rows = r.data || r.orders || [];
      setList(rows);
      setTotal(r.pagination?.total ?? rows.length);
    } catch {
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async () => {
    if (!selected || !newStatus) return;
    setSaving(true);
    try {
      await apiJson(`${GYMFOLIO_API}/package-orders/${selected._id}/status`, "PUT", { status: newStatus });
      setSelected(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Package Orders"
        actions={<PrimaryButton onClick={openAssign}>Assign Package</PrimaryButton>}
      />

      {notice && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {!loading && total > list.length && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Showing the {list.length} most recent of {total} orders.
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <Table
          columns={["Order #", "Customer", "Package", "Amount", "Payment", "Status", ""]}
          rows={list.map((o) => [
            <code key="o" className="text-xs text-neutral-700">{o.orderNumber}</code>,
            <div key="c">
              <div className="font-medium text-neutral-900">{o.customerInfo?.fullName}</div>
              <div className="text-xs text-neutral-500">{o.customerInfo?.email}</div>
            </div>,
            o.packageDetails?.name,
            `${(o.payment?.currency || "").toUpperCase()} ${o.payment?.amount}`,
            <Badge key="p" color={statusColors[o.payment?.status] || "neutral"}>{o.payment?.status}</Badge>,
            <Badge key="s" color={statusColors[o.status] || "neutral"}>{o.status}</Badge>,
            <SecondaryButton key="b" onClick={() => { setSelected(o); setNewStatus(o.status); }}>
              Update
            </SecondaryButton>,
          ])}
          empty="No package orders yet."
        />
      )}

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Package to Member" size="md">
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            Creates an active membership without going through checkout — for payments
            taken in person or a comped package.
          </p>

          <SelectField
            label="Member"
            value={assignDraft.userId}
            onChange={(v) => setAssignDraft({ ...assignDraft, userId: v })}
            options={[
              ...members.map((m) => ({
                value: m._id,
                label: `${[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email} — ${m.email}`,
              })),
            ]}
          />

          <SelectField
            label="Package"
            value={assignDraft.packageId}
            onChange={(v) => setAssignDraft({ ...assignDraft, packageId: v })}
            options={[
              ...packages.map((p) => ({
                value: p._id,
                label: `${p.name} — ${(p.currency || "GBP").toUpperCase()} ${p.price}/${p.period || "month"}`,
              })),
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Payment Method"
              value={assignDraft.paymentMethod}
              onChange={(v) => setAssignDraft({ ...assignDraft, paymentMethod: v })}
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank_transfer", label: "Bank Transfer" },
                { value: "card", label: "Card" },
                { value: "stripe", label: "Stripe" },
              ]}
            />
            <SelectField
              label="Mark as Paid"
              value={assignDraft.markPaid}
              onChange={(v) => setAssignDraft({ ...assignDraft, markPaid: v })}
              options={[
                { value: "yes", label: "Yes — activate now" },
                { value: "no", label: "No — leave pending" },
              ]}
            />
          </div>

          <TextField
            label="Duration in months (optional)"
            type="number"
            value={assignDraft.durationMonths}
            onChange={(v) => setAssignDraft({ ...assignDraft, durationMonths: v })}
            placeholder="Defaults to the package period"
          />

          <TextField
            label="Notes (optional)"
            value={assignDraft.notes}
            onChange={(v) => setAssignDraft({ ...assignDraft, notes: v })}
          />

          {assignErr && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{assignErr}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton onClick={() => setAssignOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={assignPackage} disabled={assigning}>
              {assigning ? "Assigning..." : "Assign Package"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Order ${selected?.orderNumber || ""}`} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="text-neutral-500">Customer</p>
              <p className="text-neutral-900">{selected.customerInfo.fullName} — {selected.customerInfo.email}</p>
            </div>
            <div className="text-sm">
              <p className="text-neutral-500">Package</p>
              <p className="text-neutral-900">{selected.packageDetails.name} ({selected.packageDetails.currency} {selected.packageDetails.price} / {selected.packageDetails.period})</p>
            </div>
            <SelectField
              label="Order Status"
              value={newStatus}
              onChange={setNewStatus}
              options={orderStatuses.map((s) => ({ value: s, label: s }))}
            />
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setSelected(null)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={updateStatus} disabled={saving}>{saving ? "Saving..." : "Update"}</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
