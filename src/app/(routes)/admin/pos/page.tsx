"use client";

// The till: tap products into a basket, pick a member if it is for one,
// take payment, print the receipt. Stock comes off as it sells. The receipt
// shown after a sale is the one that prints: the same component, sent to the
// printer on its own at the roll's width (components/receipts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, PrimaryButton, SecondaryButton, DangerButton, Modal, TextField, TextArea, SelectField, Toggle, Badge, Spinner, useConfirm, ErrorState, useLatestRequest } from "../_shared/ui";
import { API_BASE, apiGet, apiJson } from "../_shared/api";
import { downloadExport } from "../reports/download";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { useGymToday } from "@/components/ThemeProvider";
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
  taxable: boolean;
  is_active: boolean;
}
interface Sale {
  id: string;
  receipt_number: string;
  // unit_cost, cost and margin, and the sale's cost and profit, come only to
  // pos at manage.
  items: { name: string; quantity: number; unit_price: number; total: number; unit_cost?: number; cost?: number; margin?: number }[];
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  payment_method: string;
  tendered: number | null;
  change: number | null;
  status: "paid" | "refunded";
  member_name: string;
  sold_by: string;
  notes: string;
  paid_at: string;
  cost?: number;
  profit?: number;
}
interface SalesResponse {
  range: { from: string; to: string; label: string };
  summary: {
    totals: Record<string, number>;
    by_method: Record<string, number>;
    sales: number;
    items: number;
    cost?: Record<string, number>;
    gross_profit?: Record<string, number>;
  };
  truncated?: boolean;
  data: Sale[];
}

// The same values the server accepts (posController METHODS); the mobile
// wallets are the ones package orders take too.
const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "wallet", label: "Other mobile wallet" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "online", label: "Online" },
  { value: "account", label: "On account" },
  { value: "other", label: "Other" },
];
const methodLabel = (m: string) => METHODS.find((x) => x.value === m)?.label || m;
const fmt = (n: number, c: string) => `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const RECEIPT_FOOTER_MAX = 300;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const moneyList = (m: Record<string, number> | undefined) => Object.entries(m || {}).map(([c, n]) => fmt(n, c)).join(", ") || "—";

// Calendar days, which is how the server reads ?from=&to= -- the gym's days,
// so "today" is the gym's (useGymToday), not this browser's.
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shiftDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};
const monthStart = (key: string) => `${key.slice(0, 7)}-01`;
const SALES_PAGE = 30;

type BasketLine = { product: Product; quantity: number };

// The basket's sums, worked out exactly as the server works out the sale
// (posController.createSale), so the total shown before payment is the
// total on the receipt: prices include tax, the discount comes off the
// whole basket, and the tax is the included share of what is left on the
// taxable lines.
function basketTotals(basket: BasketLine[], discountInput: string, taxRate: number) {
  const lines = basket.map((x) => ({ ...x, total: round2(x.product.price * x.quantity) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const discount = Math.min(subtotal, Math.max(0, round2(Number(discountInput) || 0)));
  const total = round2(subtotal - discount);
  const taxableShare = subtotal ? lines.filter((l) => l.product.taxable !== false).reduce((s, l) => s + l.total, 0) / subtotal : 0;
  const tax = taxRate > 0 ? round2(total * taxableShare - (total * taxableShare) / (1 + taxRate / 100)) : 0;
  return { lines, subtotal, discount, total, tax };
}

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
    paid: s.tendered ?? s.total,
    change: s.change ?? undefined,
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
  const { ask, dialog: confirmDialog } = useConfirm();
  const editable = can("pos", "manage");
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [member, setMember] = useState<MemberOption | null>(null);
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [sales, setSales] = useState<SalesResponse | null>(null);
  const today = useGymToday();
  const [from, setFrom] = useState(() => monthStart(today()));
  const [to, setTo] = useState(() => today());
  const [salesLoading, setSalesLoading] = useState(true);
  const [visible, setVisible] = useState(SALES_PAGE);
  const [opened, setOpened] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [profile, setProfile] = useState<ReceiptProfile>(EMPTY_RECEIPT_PROFILE);
  const [printing, setPrinting] = useState(false);
  const [setup, setSetup] = useState<ReceiptSettings | null>(null);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  // A shelf or a sales list that could not be read says so where it would
  // have been, rather than reading as "no products" or "no sales".
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [salesErr, setSalesErr] = useState<string | null>(null);
  // Why the sale was refused, shown beside "Take payment" (which on a phone
  // is a long way below the top of the page).
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);
  const basketRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await apiGet<{ currency: string; tax_rate?: number; data: Product[] }>(`${POS_API}/products`);
      setProducts(p.data || []);
      setCurrency(p.currency || "");
      setTaxRate(Number(p.tax_rate) || 0);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load the shop");
    } finally {
      setLoading(false);
    }
  }, []);

  // The sales for the chosen days. Loaded on their own so changing the dates
  // does not reload the shelf or blank the till.
  const begin = useLatestRequest();
  const loadSales = useCallback(async () => {
    const isLatest = begin();
    setSalesLoading(true);
    try {
      const res = await apiGet<SalesResponse>(`${POS_API}/sales?from=${from}&to=${to}`);
      if (!isLatest()) return;
      setSales(res);
      setVisible(SALES_PAGE);
      setSalesErr(null);
    } catch (e) {
      if (!isLatest()) return;
      setSalesErr(e instanceof Error ? e.message : "Could not load the sales");
    } finally {
      if (isLatest()) setSalesLoading(false);
    }
  }, [from, to, begin]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const setRange = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
  };

  const exportSales = async () => {
    setExporting(true);
    try {
      await downloadExport(`${POS_API}/sales/export?from=${from}&to=${to}`, `sales_${from}_${to}.csv`);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not export the sales" });
    } finally {
      setExporting(false);
    }
  };

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
  const totals = basketTotals(basket, discount, taxRate);
  const cashGiven = method === "cash" && tendered.trim() !== "" ? Number(tendered) : null;
  const cashShort = cashGiven !== null && (!Number.isFinite(cashGiven) || round2(cashGiven) < totals.total);
  const change = cashGiven !== null && !cashShort ? round2(cashGiven - totals.total) : null;

  const checkout = async () => {
    setBusy(true);
    setNotice(null);
    setCheckoutErr(null);
    try {
      const res = await apiJson<{ data: Sale }>(`${POS_API}/sales`, "POST", {
        items: basket.map((x) => ({ productId: x.product.id, quantity: x.quantity })),
        discount: Number(discount) || 0,
        paymentMethod: method,
        tendered: cashGiven ?? undefined,
        memberId: member?.id || undefined,
      });
      setReceipt(res.data);
      setBasket([]);
      setDiscount("0");
      setTendered("");
      setMember(null);
      await Promise.all([load(), loadSales()]);
    } catch (e) {
      setCheckoutErr(e instanceof Error ? e.message : "Could not record the sale");
    } finally {
      setBusy(false);
    }
  };

  const refund = async (s: Sale) => {
    const reason = await ask({
      title: `Refund ${s.receipt_number}?`,
      body: `${fmt(s.total, s.currency)}. The sale is marked as refunded and its items go back into stock. Give the customer their money back at the desk — this does not send it. This cannot be undone.`,
      confirmLabel: "Refund sale",
      reason: { label: "Reason (optional)", placeholder: "Wrong item, faulty, changed their mind…" },
    });
    if (reason === null) return;
    try {
      await apiJson(`${POS_API}/sales/${s.id}/refund`, "POST", { reason });
      await Promise.all([load(), loadSales()]);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not refund" });
    }
  };

  return (
    <div>
      {confirmDialog}
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
        // One column below lg, in the order the desk works: the shelf, the
        // basket, then past sales. From lg the basket is the right-hand column.
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr]">
          <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
            {loadErr ? (
              <ErrorState message={loadErr} onRetry={load} />
            ) : products.length === 0 ? (
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
          </div>

          <div className="order-3 min-w-0 lg:col-start-1 lg:row-start-2">
            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">Sales{sales ? ` · ${sales.range.label}` : ""}</h2>
                <SecondaryButton onClick={exportSales} disabled={exporting}>
                  {exporting ? "Exporting…" : "Export CSV"}
                </SecondaryButton>
              </div>
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <div className="w-40">
                  <TextField label="From" type="date" value={from} onChange={setFrom} />
                </div>
                <div className="w-40">
                  <TextField label="To" type="date" value={to} onChange={setTo} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <SecondaryButton onClick={() => setRange(today(), today())}>Today</SecondaryButton>
                  <SecondaryButton onClick={() => setRange(monthStart(today()), today())}>This month</SecondaryButton>
                  <SecondaryButton onClick={() => setRange(shiftDays(today(), -29), today())}>Last 30 days</SecondaryButton>
                </div>
              </div>
              {salesLoading && !sales ? (
                <Spinner />
              ) : salesErr && !salesLoading ? (
                <ErrorState message={salesErr} onRetry={loadSales} />
              ) : sales ? (
                <div className={salesLoading ? "opacity-60" : ""}>
                  <p className="text-xs text-neutral-500">
                    {sales.summary.sales} sales · {sales.summary.items} items · {moneyList(sales.summary.totals)}
                    {Object.keys(sales.summary.by_method).length ? ` (${Object.entries(sales.summary.by_method).map(([m, n]) => `${methodLabel(m)} ${n}`).join(", ")})` : ""}
                  </p>
                  {sales.summary.gross_profit && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Cost of goods {moneyList(sales.summary.cost)} · <span className="font-semibold text-emerald-700">Gross profit {moneyList(sales.summary.gross_profit)}</span>
                      <span className="text-neutral-400"> (takings less the tax in them and the cost)</span>
                    </p>
                  )}
                  {sales.data.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-500">No sales on these days.</p>
                  ) : (
                    <div className="mt-2 divide-y divide-neutral-100">
                      {sales.data.slice(0, visible).map((s) => (
                        <div key={s.id} className="py-2 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-mono text-xs">{s.receipt_number}</span> · {s.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                              {s.member_name ? <span className="text-neutral-500"> · {s.member_name}</span> : null}
                              <span className="block text-[11px] text-neutral-400">
                                {new Date(s.paid_at).toLocaleString()} · {methodLabel(s.payment_method)} · {s.sold_by}
                                {s.profit !== undefined && s.status === "paid" && (
                                  <>
                                    {" "}
                                    · cost {fmt(s.cost || 0, s.currency)} ·{" "}
                                    <button type="button" onClick={() => setOpened(opened === s.id ? null : s.id)} className={`underline decoration-dotted ${s.profit < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                                      profit {fmt(s.profit, s.currency)}
                                    </button>
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{fmt(s.total, s.currency)}</span>
                              <Badge color={s.status === "paid" ? "green" : "neutral"}>{s.status}</Badge>
                              <SecondaryButton onClick={() => setReceipt(s)}>Receipt</SecondaryButton>
                              {editable && s.status === "paid" && <DangerButton onClick={() => refund(s)}>Refund</DangerButton>}
                            </div>
                          </div>
                          {opened === s.id && s.profit !== undefined && (
                            <table className="mt-2 w-full text-xs text-neutral-600">
                              <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400">
                                  <th className="py-1 font-medium">Item</th>
                                  <th className="py-1 text-right font-medium">Qty</th>
                                  <th className="py-1 text-right font-medium">Price</th>
                                  <th className="py-1 text-right font-medium">Cost</th>
                                  <th className="py-1 text-right font-medium">Margin</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.items.map((i, n) => (
                                  <tr key={n} className="border-t border-neutral-100">
                                    <td className="py-1">{i.name}</td>
                                    <td className="py-1 text-right">{i.quantity}</td>
                                    <td className="py-1 text-right">{fmt(i.total, s.currency)}</td>
                                    <td className="py-1 text-right">{fmt(i.cost || 0, s.currency)}</td>
                                    <td className="py-1 text-right">{fmt(i.margin || 0, s.currency)}</td>
                                  </tr>
                                ))}
                                <tr className="border-t border-neutral-200 font-medium text-neutral-800">
                                  <td className="py-1" colSpan={2}>
                                    Sale{s.discount > 0 ? `, after ${fmt(s.discount, s.currency)} off` : ""}
                                    {s.tax_amount > 0 ? ` and less ${fmt(s.tax_amount, s.currency)} tax` : ""}
                                  </td>
                                  <td className="py-1 text-right">{fmt(round2(s.total - s.tax_amount), s.currency)}</td>
                                  <td className="py-1 text-right">{fmt(s.cost || 0, s.currency)}</td>
                                  <td className="py-1 text-right">{fmt(s.profit, s.currency)}</td>
                                </tr>
                              </tbody>
                            </table>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {sales.data.length > visible && (
                    <div className="mt-3">
                      <SecondaryButton onClick={() => setVisible((v) => v + 50)}>Show more ({sales.data.length - visible} more)</SecondaryButton>
                    </div>
                  )}
                  {sales.truncated && <p className="mt-2 text-xs text-neutral-500">The list stops at the latest 500 sales on these days; Export CSV has every one.</p>}
                </div>
              ) : null}
            </Card>
          </div>

          <Card className="order-2 h-fit min-w-0 p-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <h2 ref={basketRef} className="scroll-mt-6 text-sm font-semibold text-neutral-900">Basket</h2>
            {basket.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">Tap products to add them.</p>
            ) : (
              <div className="mt-3 divide-y divide-neutral-100">
                {totals.lines.map((x) => (
                  <div key={x.product.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-neutral-900">{x.product.name}</p>
                      <span className="shrink-0 font-medium text-neutral-900">{fmt(x.total, currency)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-neutral-500">
                        {x.quantity} × {fmt(x.product.price, currency)}
                        {taxRate > 0 && !x.product.taxable ? " · no tax" : ""}
                      </p>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setQty(x.product.id, x.quantity - 1)} className="h-7 w-7 rounded-md border border-neutral-200">−</button>
                        <span className="w-6 text-center">{x.quantity}</span>
                        <button type="button" onClick={() => setQty(x.product.id, x.quantity + 1)} className="h-7 w-7 rounded-md border border-neutral-200">+</button>
                        <button type="button" onClick={() => remove(x.product.id)} className="ml-1 text-neutral-400 hover:text-rose-600">×</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 space-y-3">
              <MemberPicker label="Member (optional)" type="member" value={member} onChange={setMember} placeholder="Name, email or code" disabled={!editable} />
              <TextField label="Discount" type="number" value={discount} onChange={setDiscount} />
              <SelectField label="Payment" value={method} allowClear={false} onChange={setMethod} options={METHODS} />
              <div className="space-y-1 border-t border-neutral-200 pt-3 text-sm">
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span>{fmt(totals.subtotal, currency)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex items-center justify-between text-neutral-600">
                    <span>Discount</span>
                    <span>−{fmt(totals.discount, currency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Total</span>
                  <span className="text-lg font-semibold text-neutral-900">{fmt(totals.total, currency)}</span>
                </div>
                {totals.tax > 0 && (
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      Includes {profile.branding.taxLabel || "tax"} {taxRate}%
                    </span>
                    <span>{fmt(totals.tax, currency)}</span>
                  </div>
                )}
              </div>
              {method === "cash" && basket.length > 0 && (
                <div>
                  <TextField label="Cash received (optional)" type="number" value={tendered} onChange={setTendered} placeholder={totals.total.toFixed(2)} />
                  {cashShort ? (
                    <p className="mt-1 text-xs text-rose-600">Less than the total of {fmt(totals.total, currency)}.</p>
                  ) : change !== null ? (
                    <p className="mt-1 flex justify-between text-sm font-semibold text-neutral-900">
                      <span>Change</span>
                      <span>{fmt(change, currency)}</span>
                    </p>
                  ) : null}
                </div>
              )}
              {/* Below lg the bar at the bottom of the screen says it. */}
              {checkoutErr && (
                <p role="alert" className="hidden rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 lg:block">
                  {checkoutErr}
                </p>
              )}
              <PrimaryButton onClick={checkout} disabled={!editable || busy || basket.length === 0 || cashShort}>
                {busy ? "Recording…" : "Take payment"}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {/* Phones and portrait tablets: the total and "Take payment" stay at the
          bottom of the screen however far the shelf has been scrolled. */}
      {!loading && editable && basket.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-6 mt-6 border-t border-neutral-200 bg-white px-6 py-3 shadow-[0_-4px_12px_rgba(16,24,40,0.06)] lg:hidden">
          {checkoutErr && (
            <p role="alert" className="mb-2 text-sm text-rose-700">
              {checkoutErr}
            </p>
          )}
          {cashShort && <p className="mb-2 text-xs text-rose-600">The cash received is less than the total.</p>}
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => basketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="min-w-0 text-left">
              <span className="block text-lg font-semibold leading-tight text-neutral-900">{fmt(totals.total, currency)}</span>
              <span className="block truncate text-xs text-neutral-500 underline underline-offset-2">
                {basket.reduce((n, x) => n + x.quantity, 0)} in the basket · {methodLabel(method)} · view
              </span>
            </button>
            <div className="shrink-0">
              <PrimaryButton onClick={checkout} disabled={busy || cashShort}>
                {busy ? "Recording…" : "Take payment"}
              </PrimaryButton>
            </div>
          </div>
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
