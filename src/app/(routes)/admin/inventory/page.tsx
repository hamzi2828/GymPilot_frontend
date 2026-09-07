"use client";

// Products and stock: what the till sells, what it costs, how many are
// left, and every movement in and out.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FiPlus } from "react-icons/fi";
import { PageHeader, PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, SelectField, Toggle, Badge, Spinner, Table } from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";

const POS_API = `${API_BASE}/admin/pos`;

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  track_stock: boolean;
  stock: number;
  low_stock_at: number;
  low: boolean;
  taxable: boolean;
  is_active: boolean;
}
interface Movement {
  id: string;
  product_name: string;
  delta: number;
  stock_after: number;
  reason: string;
  note: string;
  by: string;
  at: string;
}

type Draft = { name: string; sku: string; category: string; price: string; cost: string; stock: string; lowStockAt: string; trackStock: boolean; taxable: boolean; isActive: boolean };
const emptyDraft: Draft = { name: "", sku: "", category: "general", price: "", cost: "", stock: "0", lowStockAt: "5", trackStock: true, taxable: true, isActive: true };

export default function InventoryPage() {
  const { can } = usePermissions();
  const editable = can("pos", "manage");
  const [rows, setRows] = useState<Product[]>([]);
  const [currency, setCurrency] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [stockDraft, setStockDraft] = useState({ mode: "delta", value: "", reason: "restock", note: "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([apiGet<{ currency: string; data: Product[] }>(`${POS_API}/products?all=1`), apiGet<{ data: Movement[] }>(`${POS_API}/products/movements`)]);
      setRows(p.data || []);
      setCurrency(p.currency || "");
      setMovements(m.data || []);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load products" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setDraft({ name: p.name, sku: p.sku, category: p.category, price: String(p.price), cost: String(p.cost), stock: String(p.stock), lowStockAt: String(p.low_stock_at), trackStock: p.track_stock, taxable: p.taxable, isActive: p.is_active });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    const body = { name: draft.name, sku: draft.sku, category: draft.category, price: Number(draft.price) || 0, cost: Number(draft.cost) || 0, lowStockAt: Number(draft.lowStockAt) || 0, trackStock: draft.trackStock, taxable: draft.taxable, isActive: draft.isActive, ...(editing ? {} : { stock: Number(draft.stock) || 0 }) };
    try {
      if (editing) await apiJson(`${POS_API}/products/${editing.id}`, "PUT", body);
      else await apiJson(`${POS_API}/products`, "POST", body);
      setOpen(false);
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  };

  const adjust = async () => {
    if (!stockFor) return;
    setSaving(true);
    try {
      const body = stockDraft.mode === "set" ? { set: Number(stockDraft.value), reason: "count", note: stockDraft.note } : { delta: Number(stockDraft.value), reason: stockDraft.reason, note: stockDraft.note };
      const r = await apiJson<{ message: string }>(`${POS_API}/products/${stockFor.id}/stock`, "POST", body);
      setNotice({ tone: "ok", text: r.message });
      setStockFor(null);
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not adjust stock" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    try {
      const r = await apiJson<{ message: string }>(`${POS_API}/products/${p.id}`, "DELETE");
      setNotice({ tone: "ok", text: r.message });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not delete" });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Products & stock"
        actions={
          <div className="flex gap-2">
            <Link href="/admin/pos" className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Till</Link>
            {editable && (
              <PrimaryButton onClick={openCreate}>
                <FiPlus className="mr-1.5 h-4 w-4" /> New product
              </PrimaryButton>
            )}
          </div>
        }
      />
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <>
          <Table
            columns={["Product", "Category", "Price", "Cost", "Stock", "Status", ""]}
            rows={rows.map((p) => [
              <div key="n">
                <p className="font-medium text-neutral-900">{p.name}</p>
                {p.sku && <p className="font-mono text-[11px] text-neutral-500">{p.sku}</p>}
              </div>,
              <span key="c" className="capitalize">{p.category}</span>,
              <span key="p">{currency} {p.price}</span>,
              <span key="k" className="text-neutral-600">{p.cost ? `${currency} ${p.cost}` : "—"}</span>,
              <span key="s">
                {p.track_stock ? (
                  <>
                    <span className={p.low ? "font-semibold text-rose-600" : ""}>{p.stock}</span>
                    {p.low && <span className="ml-1 text-[11px] text-rose-600">low</span>}
                  </>
                ) : (
                  <span className="text-neutral-400">not tracked</span>
                )}
              </span>,
              <Badge key="a" color={p.is_active ? "green" : "neutral"}>{p.is_active ? "On sale" : "Hidden"}</Badge>,
              editable ? (
                <div key="x" className="flex flex-wrap gap-1.5">
                  <SecondaryButton onClick={() => { setStockFor(p); setStockDraft({ mode: "delta", value: "", reason: "restock", note: "" }); }}>Stock</SecondaryButton>
                  <SecondaryButton onClick={() => openEdit(p)}>Edit</SecondaryButton>
                  <DangerButton onClick={() => remove(p)}>Delete</DangerButton>
                </div>
              ) : (
                <span key="x" />
              ),
            ])}
            empty="No products yet."
          />
          {movements.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-2 text-sm font-semibold text-neutral-900">Recent stock movements</h2>
              <Table
                columns={["When", "Product", "Change", "After", "Reason", "By"]}
                rows={movements.slice(0, 50).map((m) => [
                  <span key="w" className="text-xs">{new Date(m.at).toLocaleString()}</span>,
                  <span key="p">{m.product_name}</span>,
                  <span key="d" className={m.delta < 0 ? "text-rose-600" : "text-emerald-700"}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>,
                  <span key="a">{m.stock_after}</span>,
                  <span key="r" className="capitalize">{m.reason}{m.note ? ` · ${m.note}` : ""}</span>,
                  <span key="b" className="text-xs text-neutral-500">{m.by}</span>,
                ])}
              />
            </div>
          )}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : "New product"} size="md">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Name" required value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
          <TextField label="SKU / barcode" value={draft.sku} onChange={(v) => setDraft({ ...draft, sku: v })} />
          <TextField label="Category" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} placeholder="drinks, supplements, merch…" />
          <TextField label={`Price (${currency})`} type="number" value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} />
          <TextField label="Cost price" type="number" value={draft.cost} onChange={(v) => setDraft({ ...draft, cost: v })} />
          {!editing && <TextField label="Opening stock" type="number" value={draft.stock} onChange={(v) => setDraft({ ...draft, stock: v })} />}
          <TextField label="Low-stock warning at" type="number" value={draft.lowStockAt} onChange={(v) => setDraft({ ...draft, lowStockAt: v })} />
          <Toggle label="Track stock" checked={draft.trackStock} onChange={(v) => setDraft({ ...draft, trackStock: v })} />
          <Toggle label="Taxable" checked={draft.taxable} onChange={(v) => setDraft({ ...draft, taxable: v })} />
          <Toggle label="On sale" checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={() => setOpen(false)} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || !draft.name.trim() || draft.price === ""}>{saving ? "Saving…" : "Save"}</PrimaryButton>
        </div>
      </Modal>

      <Modal open={!!stockFor} onClose={() => setStockFor(null)} title={stockFor ? `Stock · ${stockFor.name} (now ${stockFor.stock})` : ""} size="sm">
        <div className="space-y-4">
          <SelectField label="What happened" value={stockDraft.mode === "set" ? "set" : stockDraft.reason} allowClear={false} onChange={(v) => setStockDraft({ ...stockDraft, mode: v === "set" ? "set" : "delta", reason: v === "set" ? "count" : v })} options={[{ value: "restock", label: "Delivery / restock (add)" }, { value: "waste", label: "Damaged or expired (remove)" }, { value: "adjust", label: "Other adjustment (+/−)" }, { value: "set", label: "Stock count (set the total)" }]} />
          <TextField label={stockDraft.mode === "set" ? "Counted total" : stockDraft.reason === "waste" ? "Quantity removed" : "Quantity (negative to remove)"} type="number" value={stockDraft.value} onChange={(v) => setStockDraft({ ...stockDraft, value: v })} />
          <TextField label="Note" value={stockDraft.note} onChange={(v) => setStockDraft({ ...stockDraft, note: v })} />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setStockFor(null)} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton onClick={() => { if (stockDraft.reason === "waste" && stockDraft.mode !== "set") setStockDraft((d) => ({ ...d, value: String(-Math.abs(Number(d.value) || 0)) })); adjust(); }} disabled={saving || stockDraft.value === ""}>Apply</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
