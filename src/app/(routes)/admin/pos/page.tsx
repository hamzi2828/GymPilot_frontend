"use client";

// The till: tap products into a basket, pick a member if it is for one,
// take payment, print the receipt. Stock comes off as it sells. The receipt
// shown after a sale is the one that prints: the same component, sent to the
// printer on its own at the roll's width (components/receipts).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, TextArea, SelectField, Toggle, Badge, Spinner } from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { MemberPicker, type MemberOption } from "../_ops/MemberPicker";
import {
  ThermalReceipt,
  printReceipt,
  loadReceiptProfile,
  toReceiptProfile,
  EMPTY_RECEIPT_PROFILE,
  RECEIPT_SETTINGS_URL,
  type ReceiptProfile,
  type ReceiptSettings,
  type ReceiptSettingsResponse,
  type ThermalReceiptProps,
} from "@/components/receipts";

const POS_API = `${API_BASE}/admin/pos`;

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  track_stock: boolean;
  stock: number;
  low: boolean;
  is_active: boolean;
}
interface Sale {
  id: string;
  receipt_number: string;
  items: { name: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  payment_method: string;
  status: "paid" | "refunded";
  member_name: string;
  sold_by: string;
  notes: string;
  paid_at: string;
}
interface SalesResponse {
  range: { label: string };
  summary: { totals: Record<string, number>; by_method: Record<string, number>; sales: number; items: number };
  data: Sale[];
}

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "online", label: "Online" },
  { value: "account", label: "On account" },
  { value: "other", label: "Other" },
];
const methodLabel = (m: string) => METHODS.find((x) => x.value === m)?.label || m;
const fmt = (n: number, c: string) => `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const RECEIPT_FOOTER_MAX = 300;

// A sale as the receipt prints it.
function receiptFor(s: Sale, profile: ReceiptProfile): ThermalReceiptProps {
  return {
    ...profile,
    title: "Sales receipt",
    number: s.receipt_number,
    date: s.paid_at,
    currency: s.currency,
    cashier: s.sold_by || undefined,
    customer: s.member_name || undefined,
    lines: s.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unit_price, total: i.total })),
    subtotal: s.subtotal,
    discount: s.discount,
    tax: s.tax_amount,
    taxRate: s.tax_rate,
    taxInclusive: true,
    total: s.total,
    paid: s.total,
    method: methodLabel(s.payment_method),
    notes: s.notes || undefined,
    status: s.status === "refunded" ? "Refunded" : undefined,
  };
}

// What the Receipt settings dialog previews: a made-up sale in the gym's
// own currency, so a change of width or footer can be judged before saving.
function sampleReceipt(profile: ReceiptProfile, settings: ReceiptSettings, currency: string): ThermalReceiptProps {
  return {
    ...profile,
    settings,
    title: "Sales receipt",
    number: "RCP-0000-00000",
    date: new Date(),
    currency,
    cashier: "Front desk",
    lines: [
      { name: "Water 500ml", quantity: 2, unitPrice: 1.5, total: 3 },
      { name: "Protein bar", quantity: 1, unitPrice: 2.5, total: 2.5 },
    ],
    subtotal: 5.5,
    total: 5.5,
    paid: 5.5,
    method: "Cash",
  };
}

export default function PosPage() {
  const { can } = usePermissions();
  const editable = can("pos", "manage");
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(true);
  const [basket, setBasket] = useState<{ product: Product; quantity: number }[]>([]);
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState("cash");
  const [member, setMember] = useState<MemberOption | null>(null);
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [sales, setSales] = useState<SalesResponse | null>(null);
  const [profile, setProfile] = useState<ReceiptProfile>(EMPTY_RECEIPT_PROFILE);
  const [printing, setPrinting] = useState(false);
  const [setup, setSetup] = useState<ReceiptSettings | null>(null);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([apiGet<{ currency: string; data: Product[] }>(`${POS_API}/products`), apiGet<SalesResponse>(`${POS_API}/sales`)]);
      setProducts(p.data || []);
      setCurrency(p.currency || "");
      setSales(s);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load the shop" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The gym's details and print settings, once. Without them a receipt still
  // prints, just without the letterhead, so a failure here does not hold up
  // the till.
  useEffect(() => {
    loadReceiptProfile()
      .then(setProfile)
      .catch(() => undefined);
  }, []);

  const print = async (s: Sale) => {
    setPrinting(true);
    try {
      await printReceipt(receiptFor(s, profile));
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not print the receipt" });
    } finally {
      setPrinting(false);
    }
  };

  const saveSetup = async () => {
    if (!setup) return;
    setSavingSetup(true);
    setSetupError(null);
    try {
      const res = await apiJson<{ data: ReceiptSettingsResponse }>(RECEIPT_SETTINGS_URL, "PUT", setup);
      setProfile(toReceiptProfile(res.data));
      setSetup(null);
      setNotice({ tone: "ok", text: "Receipt settings saved." });
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : "Could not save the receipt settings");
    } finally {
      setSavingSetup(false);
    }
  };

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);
  const shown = products.filter((p) => !category || p.category === category);

  const add = (p: Product) => {
    setBasket((b) => {
      const existing = b.find((x) => x.product.id === p.id);
      if (existing) return b.map((x) => (x.product.id === p.id ? { ...x, quantity: x.quantity + 1 } : x));
      return [...b, { product: p, quantity: 1 }];
    });
  };
  const setQty = (id: string, qty: number) => setBasket((b) => b.map((x) => (x.product.id === id ? { ...x, quantity: Math.max(1, qty) } : x)));
  const remove = (id: string) => setBasket((b) => b.filter((x) => x.product.id !== id));
  const subtotal = basket.reduce((s, x) => s + x.product.price * x.quantity, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const checkout = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiJson<{ data: Sale }>(`${POS_API}/sales`, "POST", {
        items: basket.map((x) => ({ productId: x.product.id, quantity: x.quantity })),
        discount: Number(discount) || 0,
        paymentMethod: method,
        memberId: member?.id || undefined,
      });
      setReceipt(res.data);
      setBasket([]);
      setDiscount("0");
      setMember(null);
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not record the sale" });
    } finally {
      setBusy(false);
    }
  };

  const refund = async (s: Sale) => {
    const reason = prompt(`Refund ${s.receipt_number} (${fmt(s.total, s.currency)})? Reason:`);
    if (reason === null) return;
    try {
      await apiJson(`${POS_API}/sales/${s.id}/refund`, "POST", { reason });
      await load();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not refund" });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Shop / POS"
        actions={
          <>
            {editable && (
              <SecondaryButton
                onClick={() => {
                  setSetupError(null);
                  setSetup({ ...profile.settings });
                }}
              >
                Receipt settings
              </SecondaryButton>
            )}
            <Link href="/admin/inventory" className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
              Products &amp; stock
            </Link>
          </>
        }
      />
      {notice && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice.text}</p>}
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            {products.length === 0 ? (
              <Card className="p-8 text-center text-sm text-neutral-500">
                No products yet. <Link href="/admin/inventory" className="underline">Add some</Link> to start selling.
              </Card>
            ) : (
              <>
                {categories.length > 1 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setCategory("")} className={`rounded-full border px-3 py-1 text-xs ${!category ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600"}`}>All</button>
                    {categories.map((c) => (
                      <button key={c} type="button" onClick={() => setCategory(c)} className={`rounded-full border px-3 py-1 text-xs capitalize ${category === c ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600"}`}>{c}</button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {shown.map((p) => (
                    <button key={p.id} type="button" disabled={!editable || (p.track_stock && p.stock <= 0)} onClick={() => add(p)} className="rounded-xl border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-neutral-400 disabled:opacity-40">
                      <p className="text-sm font-semibold text-neutral-900">{p.name}</p>
                      <p className="mt-1 text-sm text-neutral-700">{fmt(p.price, currency)}</p>
                      {p.track_stock && <p className={`mt-1 text-[11px] ${p.low ? "text-rose-600" : "text-neutral-400"}`}>{p.stock} in stock</p>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {sales && (
              <Card className="mt-6 p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-neutral-900">Sales · {sales.range.label}</h2>
                  <p className="text-xs text-neutral-500">
                    {sales.summary.sales} sales · {sales.summary.items} items · {Object.entries(sales.summary.totals).map(([c, n]) => fmt(n, c)).join(", ") || "—"}
                    {Object.keys(sales.summary.by_method).length ? ` (${Object.entries(sales.summary.by_method).map(([m, n]) => `${m} ${n}`).join(", ")})` : ""}
                  </p>
                </div>
                {sales.data.length === 0 ? (
                  <p className="text-sm text-neutral-500">Nothing sold this month yet.</p>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {sales.data.slice(0, 30).map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <div>
                          <span className="font-mono text-xs">{s.receipt_number}</span> · {s.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                          {s.member_name ? <span className="text-neutral-500"> · {s.member_name}</span> : null}
                          <span className="block text-[11px] text-neutral-400">{new Date(s.paid_at).toLocaleString()} · {s.payment_method} · {s.sold_by}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{fmt(s.total, s.currency)}</span>
                          <Badge color={s.status === "paid" ? "green" : "neutral"}>{s.status}</Badge>
                          <SecondaryButton onClick={() => setReceipt(s)}>Receipt</SecondaryButton>
                          {editable && s.status === "paid" && <DangerButton onClick={() => refund(s)}>Refund</DangerButton>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          <Card className="h-fit p-5 lg:sticky lg:top-4">
            <h2 className="text-sm font-semibold text-neutral-900">Basket</h2>
            {basket.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">Tap products to add them.</p>
            ) : (
              <div className="mt-3 divide-y divide-neutral-100">
                {basket.map((x) => (
                  <div key={x.product.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900">{x.product.name}</p>
                      <p className="text-xs text-neutral-500">{fmt(x.product.price, currency)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setQty(x.product.id, x.quantity - 1)} className="h-7 w-7 rounded-md border border-neutral-200">−</button>
                      <span className="w-6 text-center">{x.quantity}</span>
                      <button type="button" onClick={() => setQty(x.product.id, x.quantity + 1)} className="h-7 w-7 rounded-md border border-neutral-200">+</button>
                      <button type="button" onClick={() => remove(x.product.id)} className="ml-1 text-neutral-400 hover:text-rose-600">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 space-y-3">
              <MemberPicker label="Member (optional)" type="member" value={member} onChange={setMember} placeholder="Name, email or code" disabled={!editable} />
              <TextField label="Discount" type="number" value={discount} onChange={setDiscount} />
              <SelectField label="Payment" value={method} allowClear={false} onChange={setMethod} options={METHODS} />
              <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-sm">
                <span className="text-neutral-600">Total</span>
                <span className="text-lg font-semibold text-neutral-900">{fmt(total, currency)}</span>
              </div>
              <PrimaryButton onClick={checkout} disabled={!editable || busy || basket.length === 0}>
                {busy ? "Recording…" : "Take payment"}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      <Modal open={!!receipt} onClose={() => setReceipt(null)} title={receipt ? `Receipt ${receipt.receipt_number}` : ""} size="sm">
        {receipt && (
          <div>
            <div className="flex justify-center rounded-lg bg-neutral-100 p-3">
              <div className="shadow-sm">
                <ThermalReceipt {...receiptFor(receipt, profile)} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton onClick={() => print(receipt)} disabled={printing}>
                {printing ? "Printing…" : "Print"}
              </SecondaryButton>
              <PrimaryButton onClick={() => setReceipt(null)}>Done</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!setup} onClose={() => setSetup(null)} title="Receipt settings">
        {setup && (
          <div className="space-y-4">
            <SelectField
              label="Paper width"
              value={setup.paperWidth}
              allowClear={false}
              onChange={(v) => setSetup({ ...setup, paperWidth: v === "58mm" ? "58mm" : "80mm" })}
              options={[
                { value: "80mm", label: "80 mm roll" },
                { value: "58mm", label: "58 mm roll" },
              ]}
            />
            <Toggle label="Print the gym's logo" checked={setup.showLogo} onChange={(v) => setSetup({ ...setup, showLogo: v })} />
            <TextArea
              label="Footer"
              rows={3}
              value={setup.footerText}
              placeholder={profile.branding.footerNote || "Thank you, see you at the gym!"}
              onChange={(v) => setSetup({ ...setup, footerText: v.slice(0, RECEIPT_FOOTER_MAX) })}
            />
            <p className="text-xs text-neutral-500">
              Left empty, the invoice footer note from Settings is printed. The gym&apos;s name, address, phone, logo and tax number come from Settings.
            </p>
            <div>
              <p className="mb-2 text-xs font-medium text-neutral-600">Preview</p>
              <div className="flex justify-center rounded-lg bg-neutral-100 p-3">
                <div className="shadow-sm">
                  <ThermalReceipt {...sampleReceipt(profile, setup, currency)} />
                </div>
              </div>
            </div>
            {setupError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{setupError}</p>}
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setSetup(null)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={saveSetup} disabled={savingSetup}>
                {savingSetup ? "Saving…" : "Save"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
