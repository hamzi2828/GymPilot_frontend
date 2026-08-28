"use client";

import { useEffect, useState } from "react";
import {
  PageHeader,
  Modal,
  SecondaryButton,
  PrimaryButton,
  SelectField,
  Badge,
  Spinner,
  Table,
} from "../_shared/ui";
import { GYMFOLIO_API, apiGet, apiJson } from "../_shared/api";

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
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PackageOrder | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: PackageOrder[]; orders?: PackageOrder[] }>(`${GYMFOLIO_API}/package-orders`);
      setList(r.data || r.orders || []);
    } catch {
      setList([]);
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
      <PageHeader eyebrow="Sales" title="Package Orders" />

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
