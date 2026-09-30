"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiAlertTriangle, FiDownload, FiRefreshCw, FiSearch } from "react-icons/fi";
import {
  PageHeader,
  Card,
  Modal,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  TextField,
  TextArea,
  Toggle,
  Spinner,
  EmptyState,
  Select2,
} from "../_shared/ui";
import { ACCOUNTS_API, apiGet, apiJson, replaceParams } from "../_shared/api";
import { usePermissions } from "@/components/admin/PermissionsProvider";
import { useGymToday } from "@/components/ThemeProvider";
import { TrendChart, CategoryBars, useMoneyFormatter, SERIES_IN, SERIES_OUT, TrendPoint } from "./_charts";
import { ManageHeadsModal } from "./_heads";

// ---------------------------------------------------------------------------
// Shapes, as /api/accounts returns them.
//
// Money never arrives as a bare number: every total carries the currency it
// was recorded in, because this system holds no exchange rate and adding
// currencies together would invent a figure.
// ---------------------------------------------------------------------------

interface Totals {
  by_currency: { currency: string; amount: number }[];
  base_currency: string;
  base_amount: number;
  // What a tile should print: the base currency, or -- when the figure's money
  // is entirely in another one -- that currency, so a real number is never
  // hidden behind a base-currency zero.
  headline_amount: number;
  headline_currency: string;
  mixed: boolean;
}

interface CurrencyNotice {
  configured: string;
  reporting_in: string;
  message: string;
}

/** One line of the profit and loss, in every currency it was recorded in. */
type PnlLine = Totals & {
  key: string;
  label: string;
  /** Taken off revenue (refunds). */
  deducted?: boolean;
  /** Trainer commission only: the part from memberships and from PT sessions. */
  memberships?: Totals;
  personal_training?: Totals;
};

interface Overview {
  base_currency: string;
  currency_notice: CurrencyNotice | null;
  range: { from: string; to: string; label: string; today: string };
  income: Totals & { refunds: Totals; shop?: Totals; orders: number; source: string };
  /**
   * Revenue and outflow line by line, each cost counted once: a paid
   * payslip's salary expense and an asset's purchase expense stand aside
   * (set_aside) for the payslip and the asset.
   */
  profit_and_loss?: {
    currency: string;
    revenue: PnlLine[];
    outflow: PnlLine[];
    total_revenue: number;
    total_outflow: number;
    net_profit: number;
    margin: number | null;
    mixed_currencies: boolean;
    set_aside: { payslip_expenses: number; asset_purchase_expenses: number };
  };
  spending: {
    paid: Totals;
    pending: Totals;
    entries: number;
    by_category: { category: string; label: string; count: number; totals: Totals }[];
  };
  payroll: Totals & {
    salaried: number;
    hourly: number;
    headcount: number;
    hours: number;
    /** `trainer`: costed at the salary on a trainer record with no staff account. */
    people: { id: string; name: string; job_title: string; basis: string; currency: string; hours: number | null; cost: number; trainer?: boolean }[];
    /** Active trainers with no staff account and no salary: nothing to cost them at. */
    unlinked_trainers?: number;
    note: string;
  };
  result: {
    currency: string;
    gross_income: number;
    expenses: number;
    net: number;
    margin: number | null;
    mixed_currencies: boolean;
  };
  assets: { count: number; cost: Totals; book_value: Totals; service_due: number };
  trend: { grain: string; currency: string; points: TrendPoint[] };
}

interface SaleRow {
  id: string;
  order_number: string;
  customer: string;
  email: string;
  package: string;
  amount: number;
  currency: string;
  method: string;
  payment_status: string;
  order_status: string;
  kind: "new" | "renewal";
  paid_label: string | null;
  ends_label: string | null;
}

interface SalesResponse {
  base_currency: string;
  currency_notice: CurrencyNotice | null;
  range: { from: string; to: string; label: string };
  summary: Totals & {
    refunds: Totals;
    orders: number;
    new_business: number;
    renewals: number;
    average_sale: number;
    by_package: { name: string; count: number; totals: Totals }[];
    by_method: { method: string; count: number; totals: Totals }[];
  };
  packages: string[];
  sales: SaleRow[];
}

interface ExpenseRow {
  id: string;
  reference: string;
  title: string;
  category: string;
  category_label: string;
  amount: number;
  currency: string;
  incurred_on: string;
  incurred_label: string | null;
  paid_label: string | null;
  status: string;
  payment_method: string;
  vendor: string;
  reference_no: string;
  notes: string;
  recurring: { is_recurring: boolean; cycle: string };
  staff_name: string;
}

interface ExpensesResponse {
  base_currency: string;
  /** What a new expense is recorded in: the Settings currency. */
  record_currency?: string;
  currency_notice: CurrencyNotice | null;
  range: { from: string; to: string; label: string };
  /** The heads a new expense can be filed under: built-in and the gym's own. */
  categories: { key: string; label: string }[];
  /** The gym's archived heads: still on old rows, so still in the filter. */
  archived_categories?: { key: string; label: string }[];
  methods: string[];
  summary: {
    paid: Totals;
    pending: Totals;
    count: number;
    by_category: { category: string; label: string; count: number; totals: Totals }[];
  };
  expenses: ExpenseRow[];
}

interface AssetRow {
  id: string;
  tag: string;
  name: string;
  category: string;
  category_label: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  currency: string;
  /** The gym-local 'YYYY-MM-DD' (or ''), what a date input holds. */
  purchased_date: string;
  purchased_label: string | null;
  supplier: string;
  invoice_no: string;
  serial_number: string;
  warranty_date: string;
  warranty_label: string | null;
  warranty_active: boolean;
  location: string;
  condition: string;
  status: string;
  useful_life_years: number;
  salvage_value: number;
  age_years: number | null;
  depreciation: number;
  book_value: number;
  last_serviced_date: string;
  last_serviced_label: string | null;
  next_service_label: string | null;
  service_interval_days: number;
  days_to_service: number | null;
  service_overdue: boolean;
  notes: string;
}

interface AssetsResponse {
  base_currency: string;
  /** The purchase dates the register is narrowed to; null for every date. */
  purchased?: { from: string; to: string; label: string } | null;
  /** How far ahead the bell looks: services due, warranties ending. */
  reminder_windows?: { service_due_days: number; warranty_days: number };
  /** What a new asset is recorded in: the Settings currency. */
  record_currency?: string;
  currency_notice: CurrencyNotice | null;
  categories: { key: string; label: string; default_life: number }[];
  archived_categories?: { key: string; label: string }[];
  conditions: string[];
  statuses: string[];
  summary: {
    count: number;
    units: number;
    cost: Totals;
    book_value: Totals;
    service_overdue: number;
    service_soon: number;
    needs_attention: number;
    service_due?: number;
    warranty_ending?: number;
    by_category: { category: string; label: string; count: number; totals: Totals }[];
  };
  assets: AssetRow[];
}

type Tab = "overview" | "sales" | "expenses" | "assets";
const TABS: Tab[] = ["overview", "sales", "expenses", "assets"];

// A filter's head options: the ones in use, then the archived ones -- old rows
// are still filed under those.
function headFilterOptions(active?: { key: string; label: string }[], archived?: { key: string; label: string }[]) {
  return [
    { value: "all", label: "All categories" },
    ...(active || []).map((entry) => ({ value: entry.key, label: entry.label })),
    ...(archived || []).map((entry) => ({ value: entry.key, label: `${entry.label} (archived)` })),
  ];
}

// A form's head options: the ones in use, plus the archived head the row being
// edited is already filed under, so opening it does not quietly move it.
function headFormOptions(active: { key: string; label: string }[] | undefined, archived: { key: string; label: string }[] | undefined, current: string) {
  const options = (active || []).map((entry) => ({ value: entry.key, label: entry.label }));
  const kept = (archived || []).find((entry) => entry.key === current);
  if (kept) options.push({ value: kept.key, label: `${kept.label} (archived)` });
  return options;
}

const CONDITION_TONE: Record<string, string> = {
  new: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  fair: "bg-amber-50 text-amber-800 ring-amber-600/20",
  poor: "bg-rose-50 text-rose-700 ring-rose-600/15",
  unusable: "bg-rose-50 text-rose-700 ring-rose-600/15",
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-neutral-100 text-neutral-600 ring-neutral-500/15",
  maintenance: "bg-amber-50 text-amber-800 ring-amber-600/20",
  retired: "bg-neutral-100 text-neutral-500 ring-neutral-500/15",
  sold: "bg-neutral-100 text-neutral-500 ring-neutral-500/15",
  lost: "bg-rose-50 text-rose-700 ring-rose-600/15",
};

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}-${String(
    anchor.getUTCDate()
  ).padStart(2, "0")}`;
}

function monthStart(key: string) {
  return `${key.slice(0, 7)}-01`;
}

function presetsFor(today: string) {
  const [y, m] = today.split("-").map(Number);
  const lastMonthEnd = `${y}-${String(m).padStart(2, "0")}-01`;
  const prevEnd = shiftKey(lastMonthEnd, -1);

  return [
    { id: "today", label: "Today", from: today, to: today },
    { id: "mtd", label: "This month", from: monthStart(today), to: today },
    { id: "last", label: "Last month", from: monthStart(prevEnd), to: prevEnd },
    { id: "90", label: "Last 90 days", from: shiftKey(today, -89), to: today },
    { id: "ytd", label: "Year to date", from: `${today.slice(0, 4)}-01-01`, to: today },
    { id: "12m", label: "Last 12 months", from: monthStart(shiftKey(today, -364)), to: today },
  ];
}

// A headline figure. Proportional digits, not tabular -- equal-width digits
// make a large standalone number look loose.
function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad";
  accent?: string;
}) {
  const valueTone =
    tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-600" : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        {accent && <span className="h-2 w-2 rounded-full" style={{ background: accent }} />}
        {label}
      </p>
      <p className={`mt-1.5 truncate text-xl font-semibold tracking-tight ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

// Shown wherever a figure hides money in another currency, rather than letting
// a headline quietly under-report.
function MixedNote({ totals, format }: { totals: Totals; format: (v: number, c?: string) => string }) {
  const others = totals.by_currency.filter((entry) => entry.currency !== totals.base_currency);
  if (!others.length) return null;
  return (
    <span className="ml-1 text-[11px] text-amber-700">
      + {others.map((entry) => format(entry.amount, entry.currency)).join(", ")}
    </span>
  );
}

const emptyExpense = {
  title: "",
  category: "utilities",
  amount: "",
  currency: "",
  incurredOn: "",
  paidOn: "",
  status: "paid",
  paymentMethod: "cash",
  vendor: "",
  referenceNo: "",
  notes: "",
  isRecurring: false,
  cycle: "monthly",
};

const emptyAsset = {
  name: "",
  category: "cardio",
  quantity: "1",
  unitCost: "",
  currency: "",
  purchasedOn: "",
  supplier: "",
  invoiceNo: "",
  serialNumber: "",
  warrantyUntil: "",
  location: "",
  condition: "good",
  status: "active",
  usefulLifeYears: "",
  salvageValue: "",
  serviceIntervalDays: "",
  lastServicedOn: "",
  notes: "",
  recordExpense: true,
};

function AccountsAdminPageInner() {
  const { can } = usePermissions();
  const editable = can("accounts", "manage");

  // The address can open a tab already filtered (?tab=assets&service=due,
  // from the admin bell), read again whenever it changes.
  const searchParams = useSearchParams();
  const urlTab = TABS.find((entry) => entry === searchParams.get("tab")) || null;
  const urlService = ["overdue", "soon", "due"].find((entry) => entry === searchParams.get("service")) || null;
  const urlWarranty = searchParams.get("warranty") === "ending" ? "ending" : null;

  const [tab, setTab] = useState<Tab>(urlTab || "overview");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // The register's purchase dates, apart from the money tabs' period: it
  // opens on every date, since a register showing only this month's
  // purchases would look as if the gym owned nothing.
  const [assetFrom, setAssetFrom] = useState("");
  const [assetTo, setAssetTo] = useState("");
  // The gym's day until the overview answers with the server's own.
  const gymToday = useGymToday();
  const [today, setToday] = useState(() => gymToday());

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [sales, setSales] = useState<SalesResponse | null>(null);
  const [expenses, setExpenses] = useState<ExpensesResponse | null>(null);
  const [assets, setAssets] = useState<AssetsResponse | null>(null);

  const [salesStatus, setSalesStatus] = useState("paid");
  const [expenseCategory, setExpenseCategory] = useState("all");
  const [expenseStatus, setExpenseStatus] = useState("all");
  const [assetCategory, setAssetCategory] = useState("all");
  const [assetStatus, setAssetStatus] = useState("all");
  const [assetService, setAssetService] = useState(urlService || "all");
  const [assetWarranty, setAssetWarranty] = useState(urlWarranty || "all");

  useEffect(() => {
    if (urlTab) setTab(urlTab);
    if (urlService) setAssetService(urlService);
    if (urlWarranty) setAssetWarranty(urlWarranty);
  }, [urlTab, urlService, urlWarranty]);

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [expenseDraft, setExpenseDraft] = useState(emptyExpense);

  const [assetOpen, setAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [assetDraft, setAssetDraft] = useState(emptyAsset);

  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [headsOpen, setHeadsOpen] = useState(false);

  const base = overview?.base_currency || sales?.base_currency || expenses?.base_currency || assets?.base_currency || "USD";
  const currencyNotice =
    overview?.currency_notice || sales?.currency_notice || expenses?.currency_notice || assets?.currency_notice || null;
  // New records start in the gym's Settings currency -- what the server
  // stamps them with -- not whichever currency most of the history is in.
  const recordCurrency = expenses?.record_currency || assets?.record_currency || base;
  const format = useMoneyFormatter(base);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (q) params.set("q", q);

      if (tab === "overview") {
        const res = await apiGet<Overview>(`${ACCOUNTS_API}/overview?${params}`);
        setOverview(res);
        setToday(res.range.today);
        if (!from) setFrom(res.range.from);
        if (!to) setTo(res.range.to);
      } else if (tab === "sales") {
        params.set("status", salesStatus);
        const res = await apiGet<SalesResponse>(`${ACCOUNTS_API}/sales?${params}`);
        setSales(res);
        if (!from) setFrom(res.range.from);
        if (!to) setTo(res.range.to);
      } else if (tab === "expenses") {
        if (expenseCategory !== "all") params.set("category", expenseCategory);
        if (expenseStatus !== "all") params.set("status", expenseStatus);
        const res = await apiGet<ExpensesResponse>(`${ACCOUNTS_API}/expenses?${params}`);
        setExpenses(res);
        if (!from) setFrom(res.range.from);
        if (!to) setTo(res.range.to);
      } else {
        // Purchase dates, not the money tabs' period; none means every date.
        params.delete("from");
        params.delete("to");
        if (assetFrom) params.set("from", assetFrom);
        if (assetTo) params.set("to", assetTo);
        if (assetCategory !== "all") params.set("category", assetCategory);
        if (assetStatus !== "all") params.set("status", assetStatus);
        if (assetService !== "all") params.set("service", assetService);
        if (assetWarranty !== "all") params.set("warranty", assetWarranty);
        const res = await apiGet<AssetsResponse>(`${ACCOUNTS_API}/assets?${params}`);
        setAssets(res);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load the accounts");
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, assetFrom, assetTo, q, salesStatus, expenseCategory, expenseStatus, assetCategory, assetStatus, assetService, assetWarranty]);

  useEffect(() => {
    load();
  }, [load]);

  // The date row drives the period on the money tabs and the purchase dates
  // on the register, which alone can be cleared to every date.
  const onAssets = tab === "assets";
  const shownFrom = onAssets ? assetFrom : from;
  const shownTo = onAssets ? assetTo : to;
  const setShownFrom = onAssets ? setAssetFrom : setFrom;
  const setShownTo = onAssets ? setAssetTo : setTo;
  const presets = useMemo(
    () => (onAssets ? [{ id: "any", label: "Any date", from: "", to: "" }, ...presetsFor(today)] : presetsFor(today)),
    [today, onAssets]
  );
  const activePreset = presets.find((preset) => preset.from === shownFrom && preset.to === shownTo)?.id || "custom";

  // ---- Expense form -------------------------------------------------------

  const openExpense = (row?: ExpenseRow) => {
    if (row) {
      setEditingExpense(row);
      setExpenseDraft({
        title: row.title,
        category: row.category,
        amount: String(row.amount),
        currency: row.currency,
        incurredOn: row.incurred_on ? row.incurred_on.slice(0, 10) : "",
        paidOn: "",
        status: row.status,
        paymentMethod: row.payment_method,
        vendor: row.vendor,
        referenceNo: row.reference_no,
        notes: row.notes,
        isRecurring: row.recurring.is_recurring,
        cycle: row.recurring.cycle,
      });
    } else {
      setEditingExpense(null);
      setExpenseDraft({ ...emptyExpense, currency: recordCurrency, incurredOn: today });
    }
    setFormErr(null);
    setExpenseOpen(true);
  };

  const saveExpense = async () => {
    if (!expenseDraft.title.trim() || !expenseDraft.amount) {
      setFormErr("A title and an amount are both needed.");
      return;
    }
    setSaving(true);
    setFormErr(null);
    try {
      const body = {
        ...expenseDraft,
        amount: Number(expenseDraft.amount),
        recurring: { isRecurring: expenseDraft.isRecurring, cycle: expenseDraft.cycle },
      };
      const res = editingExpense
        ? await apiJson<{ message: string }>(`${ACCOUNTS_API}/expenses/${editingExpense.id}`, "PUT", body)
        : await apiJson<{ message: string }>(`${ACCOUNTS_API}/expenses`, "POST", body);
      setNotice(res.message);
      setExpenseOpen(false);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Could not save this expense");
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (row: ExpenseRow) => {
    if (!confirm(`Delete ${row.reference} — ${row.title}?`)) return;
    try {
      const res = await apiJson<{ message: string }>(`${ACCOUNTS_API}/expenses/${row.id}`, "DELETE");
      setNotice(res.message);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete this expense");
    }
  };

  const draftPayroll = async () => {
    if (!confirm("Draft this period's salaries as pending expenses? Existing drafts are left alone.")) return;
    try {
      const res = await apiJson<{ message: string }>(`${ACCOUNTS_API}/expenses/payroll`, "POST", { from, to });
      setNotice(res.message);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not draft payroll");
    }
  };

  // ---- Asset form ---------------------------------------------------------

  // Every field is filled from the row. The save sends the whole form, and
  // the server reads a blank as "clear it" -- so a field left empty here used
  // to wipe the warranty date and invoice number on every unrelated edit.
  const openAsset = (row?: AssetRow) => {
    if (row) {
      setEditingAsset(row);
      setAssetDraft({
        name: row.name,
        category: row.category,
        quantity: String(row.quantity),
        unitCost: String(row.unit_cost),
        currency: row.currency,
        purchasedOn: row.purchased_date || "",
        supplier: row.supplier,
        invoiceNo: row.invoice_no || "",
        serialNumber: row.serial_number,
        warrantyUntil: row.warranty_date || "",
        location: row.location,
        condition: row.condition,
        status: row.status,
        usefulLifeYears: String(row.useful_life_years || ""),
        salvageValue: String(row.salvage_value || ""),
        serviceIntervalDays: String(row.service_interval_days || ""),
        lastServicedOn: row.last_serviced_date || "",
        notes: row.notes,
        recordExpense: false,
      });
    } else {
      setEditingAsset(null);
      setAssetDraft({ ...emptyAsset, currency: recordCurrency, purchasedOn: today });
    }
    setFormErr(null);
    setAssetOpen(true);
  };

  const saveAsset = async () => {
    if (!assetDraft.name.trim()) {
      setFormErr("Give the asset a name.");
      return;
    }
    setSaving(true);
    setFormErr(null);
    try {
      const res = editingAsset
        ? await apiJson<{ message: string }>(`${ACCOUNTS_API}/assets/${editingAsset.id}`, "PUT", assetDraft)
        : await apiJson<{ message: string }>(`${ACCOUNTS_API}/assets`, "POST", assetDraft);
      setNotice(res.message);
      setAssetOpen(false);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Could not save this asset");
    } finally {
      setSaving(false);
    }
  };

  const logService = async (row: AssetRow) => {
    if (!confirm(`Log a service for ${row.tag} — ${row.name} today?`)) return;
    try {
      const res = await apiJson<{ message: string }>(`${ACCOUNTS_API}/assets/${row.id}/service`, "POST", {});
      setNotice(res.message);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not log that service");
    }
  };

  const deleteAsset = async (row: AssetRow) => {
    if (!confirm(`Remove ${row.tag} — ${row.name} from the register?`)) return;
    try {
      const res = await apiJson<{ message: string }>(`${ACCOUNTS_API}/assets/${row.id}`, "DELETE");
      setNotice(res.message);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not remove this asset");
    }
  };

  const exportCsv = () => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    let header: string[] = [];
    let lines: string[][] = [];

    if (tab === "sales" && sales) {
      header = ["Order", "Customer", "Package", "Amount", "Currency", "Method", "Status", "Type", "Paid"];
      lines = sales.sales.map((row) => [
        row.order_number, row.customer, row.package, String(row.amount), row.currency,
        row.method, row.payment_status, row.kind, row.paid_label || "",
      ]);
    } else if (tab === "expenses" && expenses) {
      header = ["Reference", "Date", "Title", "Category", "Amount", "Currency", "Status", "Method", "Vendor"];
      lines = expenses.expenses.map((row) => [
        row.reference, row.incurred_label || "", row.title, row.category_label, String(row.amount),
        row.currency, row.status, row.payment_method, row.vendor,
      ]);
    } else if (tab === "assets" && assets) {
      header = ["Tag", "Name", "Category", "Qty", "Cost", "Book value", "Currency", "Condition", "Status", "Location", "Bought", "Invoice", "Warranty until", "Next service"];
      lines = assets.assets.map((row) => [
        row.tag, row.name, row.category_label, String(row.quantity), String(row.total_cost),
        String(row.book_value), row.currency, row.condition, row.status, row.location, row.purchased_date,
        row.invoice_no, row.warranty_date, row.next_service_label || "",
      ]);
    } else if (overview) {
      header = ["Period", "Money in", "Money out", "Net"];
      lines = overview.trend.points.map((point) => [
        point.label, String(point.revenue), String(point.expense), String(point.net),
      ]);
      // The profit and loss after the trend, in the base currency like it.
      const pnl = overview.profit_and_loss;
      if (pnl) {
        lines.push([], ["Profit and loss", "Amount", "Currency", ""]);
        for (const line of pnl.revenue) lines.push([line.deducted ? `Less ${line.label.toLowerCase()}` : line.label, String(line.deducted ? -line.base_amount : line.base_amount), pnl.currency, ""]);
        lines.push(["Total revenue", String(pnl.total_revenue), pnl.currency, ""]);
        for (const line of pnl.outflow) lines.push([line.label, String(line.base_amount), pnl.currency, ""]);
        lines.push(["Total outflow", String(pnl.total_outflow), pnl.currency, ""], ["Net profit", String(pnl.net_profit), pnl.currency, ""]);
      }
    }

    const csv = [header, ...lines].map((row) => row.map(escape).join(",")).join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      tab === "assets"
        ? `accounts-assets-${assetFrom || assetTo ? `${assetFrom || "start"}-to-${assetTo || today}` : "all-dates"}.csv`
        : `accounts-${tab}-${from || today}-to-${to || today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Accounts"
        actions={
          <>
            <SecondaryButton onClick={exportCsv} disabled={loading}>
              <FiDownload className="mr-1.5 h-4 w-4" /> Export CSV
            </SecondaryButton>
            <SecondaryButton onClick={load} disabled={loading}>
              <FiRefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </SecondaryButton>
            {editable && (tab === "expenses" || tab === "assets") && (
              <SecondaryButton onClick={() => setHeadsOpen(true)}>Manage heads</SecondaryButton>
            )}
            {editable && tab === "expenses" && <PrimaryButton onClick={() => openExpense()}>Add Expense</PrimaryButton>}
            {editable && tab === "assets" && <PrimaryButton onClick={() => openAsset()}>Add Asset</PrimaryButton>}
          </>
        }
      />

      {notice && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {err && <div className="mb-6 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">{err}</div>}

      {/* The gym's configured currency and the one its money is actually in
          disagree. Reporting in the money's currency beats reporting a
          confident zero, but the mismatch is worth fixing at the source. */}
      {currencyNotice && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{currencyNotice.message}</p>
        </div>
      )}

      {/* One filter row above everything it scopes -- never a filter inside a card. */}
      <Card className="mb-6 p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setShownFrom(preset.from);
                setShownTo(preset.to);
              }}
              className={`h-8 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                activePreset === preset.id
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <span className="ml-auto text-[12px] text-neutral-400">
            {onAssets
              ? assets?.purchased
                ? `Bought ${assets.purchased.label}`
                : "Bought on any date"
              : overview?.range.label || sales?.range.label || expenses?.range.label}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{onAssets ? "Bought from" : "From"}</span>
            <input type="date" value={shownFrom} max={shownTo || undefined} onChange={(e) => setShownFrom(e.target.value)} className={fieldCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{onAssets ? "Bought to" : "To"}</span>
            <input type="date" value={shownTo} min={shownFrom || undefined} onChange={(e) => setShownTo(e.target.value)} className={fieldCls} />
          </label>

          {tab === "sales" && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Payment</span>
              <Select2
                ariaLabel="Payment status"
                value={salesStatus}
                onChange={setSalesStatus}
                options={[
                  { value: "paid", label: "Paid only" },
                  { value: "all", label: "Every status" },
                  { value: "pending", label: "Pending" },
                  { value: "refunded", label: "Refunded" },
                  { value: "failed", label: "Failed" },
                ]}
              />
            </label>
          )}

          {tab === "expenses" && (
            <>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Category</span>
                <Select2
                  ariaLabel="Category"
                  value={expenseCategory}
                  onChange={setExpenseCategory}
                  options={headFilterOptions(expenses?.categories, expenses?.archived_categories)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Status</span>
                <Select2
                  ariaLabel="Expense status"
                  value={expenseStatus}
                  onChange={setExpenseStatus}
                  options={[
                    { value: "all", label: "Any status" },
                    { value: "paid", label: "Paid" },
                    { value: "pending", label: "Unpaid" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                />
              </label>
            </>
          )}

          {tab === "assets" && (
            <>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Category</span>
                <Select2
                  ariaLabel="Asset category"
                  value={assetCategory}
                  onChange={setAssetCategory}
                  options={headFilterOptions(assets?.categories, assets?.archived_categories)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Status</span>
                <Select2
                  ariaLabel="Asset status"
                  value={assetStatus}
                  onChange={setAssetStatus}
                  options={[
                    { value: "all", label: "Any status" },
                    ...(assets?.statuses || []).map((entry) => ({ value: entry, label: entry })),
                  ]}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Servicing</span>
                <Select2
                  ariaLabel="Servicing"
                  value={assetService}
                  onChange={(v) => {
                    setAssetService(v);
                    replaceParams({ service: v === "all" ? null : v });
                  }}
                  options={[
                    { value: "all", label: "Everything" },
                    { value: "overdue", label: "Service overdue" },
                    { value: "due", label: `Due within ${assets?.reminder_windows?.service_due_days ?? 7} days or overdue` },
                    { value: "soon", label: "Due within 30 days" },
                  ]}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Warranty</span>
                <Select2
                  ariaLabel="Warranty"
                  value={assetWarranty}
                  onChange={(v) => {
                    setAssetWarranty(v);
                    replaceParams({ warranty: v === "all" ? null : v });
                  }}
                  options={[
                    { value: "all", label: "Any" },
                    { value: "ending", label: `Ending within ${assets?.reminder_windows?.warranty_days ?? 30} days` },
                  ]}
                />
              </label>
            </>
          )}

          {tab !== "overview" && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Search</span>
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    tab === "sales"
                      ? "Name, email, phone, member ID or order…"
                      : tab === "assets"
                      ? "Name, tag, supplier, serial or location…"
                      : "Title, vendor or reference…"
                  }
                  className={`${fieldCls} pl-9`}
                />
              </div>
            </label>
          )}
        </div>
      </Card>

      <div className="mb-4 flex items-center gap-1 border-b border-neutral-200">
        {([
          { id: "overview", label: "Overview" },
          { id: "sales", label: "Sales" },
          { id: "expenses", label: "Expenses" },
          { id: "assets", label: "Assets" },
        ] as { id: Tab; label: string }[]).map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              setTab(entry.id);
              replaceParams({ tab: entry.id === "overview" ? null : entry.id });
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === entry.id
                ? "border-[var(--accent)] text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* Held at reduced opacity on refetch rather than flashing a skeleton. */}
      <div className={loading ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>
        {loading && !overview && !sales && !expenses && !assets ? (
          <Spinner />
        ) : tab === "overview" ? (
          <OverviewTab data={overview} format={format} />
        ) : tab === "sales" ? (
          <SalesTab data={sales} format={format} />
        ) : tab === "expenses" ? (
          <ExpensesTab
            data={expenses}
            format={format}
            editable={editable}
            onEdit={openExpense}
            onDelete={deleteExpense}
            onDraftPayroll={draftPayroll}
          />
        ) : (
          <AssetsTab
            data={assets}
            format={format}
            editable={editable}
            onEdit={openAsset}
            onService={logService}
            onDelete={deleteAsset}
          />
        )}
      </div>

      {/* ---- Expense dialog ---- */}
      <Modal open={expenseOpen} onClose={() => setExpenseOpen(false)} title={editingExpense ? `Edit ${editingExpense.reference}` : "Add expense"} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="What was it for" value={expenseDraft.title} onChange={(v) => setExpenseDraft({ ...expenseDraft, title: v })} required />
            <div>
              <span className="text-xs font-semibold text-neutral-700">Category</span>
              <div className="mt-1">
                <Select2
                  ariaLabel="Category"
                  value={expenseDraft.category}
                  onChange={(v) => setExpenseDraft({ ...expenseDraft, category: v })}
                  options={headFormOptions(expenses?.categories, expenses?.archived_categories, expenseDraft.category)}
                />
              </div>
            </div>
            <TextField label="Amount" type="number" value={expenseDraft.amount} onChange={(v) => setExpenseDraft({ ...expenseDraft, amount: v })} required />
            <TextField label="Currency" value={expenseDraft.currency} onChange={(v) => setExpenseDraft({ ...expenseDraft, currency: v })} />
            <TextField label="Date incurred" type="date" value={expenseDraft.incurredOn} onChange={(v) => setExpenseDraft({ ...expenseDraft, incurredOn: v })} />
            <div>
              <span className="text-xs font-semibold text-neutral-700">Status</span>
              <div className="mt-1">
                <Select2
                  ariaLabel="Status"
                  value={expenseDraft.status}
                  onChange={(v) => setExpenseDraft({ ...expenseDraft, status: v })}
                  options={[
                    { value: "paid", label: "Paid" },
                    { value: "pending", label: "Not paid yet" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                />
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-neutral-700">Paid by</span>
              <div className="mt-1">
                <Select2
                  ariaLabel="Payment method"
                  value={expenseDraft.paymentMethod}
                  onChange={(v) => setExpenseDraft({ ...expenseDraft, paymentMethod: v })}
                  options={(expenses?.methods || ["cash"]).map((method) => ({
                    value: method,
                    label: method.replace(/_/g, " "),
                  }))}
                />
              </div>
            </div>
            <TextField label="Paid to" value={expenseDraft.vendor} onChange={(v) => setExpenseDraft({ ...expenseDraft, vendor: v })} placeholder="Supplier or landlord" />
            <TextField label="Invoice / receipt no." value={expenseDraft.referenceNo} onChange={(v) => setExpenseDraft({ ...expenseDraft, referenceNo: v })} />
          </div>

          <TextArea label="Notes" value={expenseDraft.notes} onChange={(v) => setExpenseDraft({ ...expenseDraft, notes: v })} rows={2} />

          <div className="rounded-xl border border-neutral-200 px-4 py-3">
            <Toggle label="This cost repeats" checked={expenseDraft.isRecurring} onChange={(v) => setExpenseDraft({ ...expenseDraft, isRecurring: v })} />
            {expenseDraft.isRecurring && (
              <div className="mt-3 max-w-[220px]">
                <Select2
                  ariaLabel="Repeats"
                  value={expenseDraft.cycle}
                  onChange={(v) => setExpenseDraft({ ...expenseDraft, cycle: v })}
                  options={[
                    { value: "weekly", label: "Every week" },
                    { value: "monthly", label: "Every month" },
                    { value: "quarterly", label: "Every quarter" },
                    { value: "yearly", label: "Every year" },
                  ]}
                />
              </div>
            )}
          </div>

          {formErr && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formErr}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={() => setExpenseOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={saveExpense} disabled={saving}>{saving ? "Saving…" : editingExpense ? "Save changes" : "Record expense"}</PrimaryButton>
          </div>
        </div>
      </Modal>

      <ManageHeadsModal
        open={headsOpen}
        kind={tab === "assets" ? "asset" : "expense"}
        onClose={() => setHeadsOpen(false)}
        onChanged={load}
      />

      {/* ---- Asset dialog ---- */}
      <Modal open={assetOpen} onClose={() => setAssetOpen(false)} title={editingAsset ? `Edit ${editingAsset.tag}` : "Add asset"} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="What is it" value={assetDraft.name} onChange={(v) => setAssetDraft({ ...assetDraft, name: v })} required />
            <div>
              <span className="text-xs font-semibold text-neutral-700">Category</span>
              <div className="mt-1">
                <Select2
                  ariaLabel="Asset category"
                  value={assetDraft.category}
                  onChange={(v) => {
                    const life = (assets?.categories || []).find((entry) => entry.key === v)?.default_life;
                    setAssetDraft({ ...assetDraft, category: v, usefulLifeYears: life ? String(life) : assetDraft.usefulLifeYears });
                  }}
                  options={headFormOptions(assets?.categories, assets?.archived_categories, assetDraft.category)}
                />
              </div>
            </div>
            <TextField label="How many" type="number" value={assetDraft.quantity} onChange={(v) => setAssetDraft({ ...assetDraft, quantity: v })} />
            <TextField label="Cost each" type="number" value={assetDraft.unitCost} onChange={(v) => setAssetDraft({ ...assetDraft, unitCost: v })} />
            <TextField label="Currency" value={assetDraft.currency} onChange={(v) => setAssetDraft({ ...assetDraft, currency: v })} />
            <TextField label="Bought on" type="date" value={assetDraft.purchasedOn} onChange={(v) => setAssetDraft({ ...assetDraft, purchasedOn: v })} />
            <TextField label="Supplier" value={assetDraft.supplier} onChange={(v) => setAssetDraft({ ...assetDraft, supplier: v })} />
            <TextField label="Invoice no." value={assetDraft.invoiceNo} onChange={(v) => setAssetDraft({ ...assetDraft, invoiceNo: v })} />
            <TextField label="Where it lives" value={assetDraft.location} onChange={(v) => setAssetDraft({ ...assetDraft, location: v })} placeholder="Cardio floor" />
            <TextField label="Serial number" value={assetDraft.serialNumber} onChange={(v) => setAssetDraft({ ...assetDraft, serialNumber: v })} />
            <TextField label="Warranty until" type="date" value={assetDraft.warrantyUntil} onChange={(v) => setAssetDraft({ ...assetDraft, warrantyUntil: v })} />

            <div>
              <span className="text-xs font-semibold text-neutral-700">Condition</span>
              <div className="mt-1">
                <Select2
                  ariaLabel="Condition"
                  value={assetDraft.condition}
                  onChange={(v) => setAssetDraft({ ...assetDraft, condition: v })}
                  options={(assets?.conditions || ["good"]).map((entry) => ({ value: entry, label: entry }))}
                />
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-neutral-700">Status</span>
              <div className="mt-1">
                <Select2
                  ariaLabel="Status"
                  value={assetDraft.status}
                  onChange={(v) => setAssetDraft({ ...assetDraft, status: v })}
                  options={(assets?.statuses || ["active"]).map((entry) => ({ value: entry, label: entry }))}
                />
              </div>
            </div>

            <TextField label="Write off over (years)" type="number" value={assetDraft.usefulLifeYears} onChange={(v) => setAssetDraft({ ...assetDraft, usefulLifeYears: v })} />
            <TextField label="Value at end of life" type="number" value={assetDraft.salvageValue} onChange={(v) => setAssetDraft({ ...assetDraft, salvageValue: v })} />
            <TextField label="Service every (days)" type="number" value={assetDraft.serviceIntervalDays} onChange={(v) => setAssetDraft({ ...assetDraft, serviceIntervalDays: v })} placeholder="0 for none" />
            <TextField label="Last serviced" type="date" value={assetDraft.lastServicedOn} onChange={(v) => setAssetDraft({ ...assetDraft, lastServicedOn: v })} />
          </div>

          <TextArea label="Notes" value={assetDraft.notes} onChange={(v) => setAssetDraft({ ...assetDraft, notes: v })} rows={2} />

          {!editingAsset && (
            <div className="rounded-xl border border-neutral-200 px-4 py-3">
              <Toggle
                label="Also record this purchase as an expense"
                checked={assetDraft.recordExpense}
                onChange={(v) => setAssetDraft({ ...assetDraft, recordExpense: v })}
              />
              <p className="mt-1 text-[12px] text-neutral-400">
                Keeps the register and the books agreeing without entering the purchase twice.
              </p>
            </div>
          )}

          {formErr && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formErr}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={() => setAssetOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={saveAsset} disabled={saving}>{saving ? "Saving…" : editingAsset ? "Save changes" : "Add to register"}</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function AccountsAdminPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={<Spinner />}>
      <AccountsAdminPageInner />
    </Suspense>
  );
}

const fieldCls =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]";

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab({ data, format }: { data: Overview | null; format: (v: number, c?: string) => string }) {
  if (!data) return <EmptyState title="Nothing to report yet" />;

  const net = data.result.net;

  return (
    <div className="space-y-6">
      {data.result.mixed_currencies && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Some money in this period was recorded in a currency other than{" "}
            <strong>{data.base_currency}</strong>. It is listed separately rather than added in —
            there is no exchange rate in this system, so summing them would invent a figure.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Revenue"
          value={format(data.result.gross_income, data.base_currency)}
          hint={`${data.income.orders} sale${data.income.orders === 1 ? "" : "s"} · after refunds`}
          accent={SERIES_IN}
        />
        <Stat
          label="Outflow"
          value={format(data.result.expenses, data.base_currency)}
          hint="commission, expenses, assets, salaries"
          accent={SERIES_OUT}
        />
        <Stat
          label="Net profit"
          value={format(net, data.base_currency)}
          tone={net >= 0 ? "good" : "bad"}
          hint={data.result.margin !== null ? `${data.result.margin}% margin` : undefined}
        />
        <Stat
          label="Wage cost"
          value={format(data.payroll.headline_amount, data.payroll.headline_currency)}
          hint={
            data.payroll.headline_currency === data.base_currency
              ? `${data.payroll.headcount} staff · ${data.payroll.hours} h logged`
              : `${data.payroll.headcount} staff · paid in ${data.payroll.headline_currency}`
          }
        />
        <Stat
          label="Equipment value"
          value={format(data.assets.book_value.headline_amount, data.assets.book_value.headline_currency)}
          hint={`${data.assets.count} items · ${format(data.assets.cost.headline_amount, data.assets.cost.headline_currency)} cost`}
        />
      </div>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">Money in and out</h2>
        <p className="mb-4 text-[12px] text-neutral-500">
          {data.trend.grain === "day" ? "By day" : "By month"} · {data.base_currency} only
        </p>
        <TrendChart points={data.trend.points} currency={data.base_currency} format={format} />
      </Card>

      {data.profit_and_loss && <ProfitAndLoss pnl={data.profit_and_loss} format={format} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-neutral-900">Where the money went</h2>
          <p className="mb-4 text-[12px] text-neutral-500">Expenses by category, this period</p>
          <CategoryBars
            rows={data.spending.by_category.map((entry) => ({
              key: entry.category,
              label: entry.label,
              value: entry.totals.base_amount,
              count: entry.count,
              currency: entry.totals.base_currency,
            }))}
            format={format}
            emptyLabel="No expenses recorded in this period"
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-neutral-900">Wage cost by person</h2>
          <p className="mb-4 text-[12px] text-neutral-500">{data.payroll.note}</p>
          <CategoryBars
            rows={data.payroll.people.map((person) => ({
              key: person.id,
              label: person.name + (person.hours !== null ? ` · ${person.hours} h` : ""),
              value: person.cost,
              currency: person.currency,
            }))}
            format={format}
            emptyLabel="No staff pay rates set"
          />
          {data.payroll.mixed && (
            <p className="mt-3 text-[12px] text-amber-700">
              Some staff are paid in another currency; totals above are per person, not summed.
            </p>
          )}
          {!!data.payroll.unlinked_trainers && (
            <p className="mt-3 text-[12px] text-amber-700">
              {data.payroll.unlinked_trainers} active{" "}
              {data.payroll.unlinked_trainers === 1 ? "trainer has" : "trainers have"} no staff
              account and no salary set, so their pay is not in this total. Link them to a
              staff account or set a salary on the Trainers screen to include them.
            </p>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">What is and is not counted</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
          <div className="flex justify-between border-b border-neutral-100 py-1.5">
            <dt className="text-neutral-500">Income counted</dt>
            <dd className="text-right text-neutral-800">{data.income.source}</dd>
          </div>
          <div className="flex justify-between border-b border-neutral-100 py-1.5">
            <dt className="text-neutral-500">Refunds deducted</dt>
            <dd className="text-neutral-800">{format(data.income.refunds.base_amount, data.base_currency)}</dd>
          </div>
          <div className="flex justify-between border-b border-neutral-100 py-1.5">
            <dt className="text-neutral-500">Shop / POS takings</dt>
            <dd className="text-neutral-800">{format(data.income.shop?.base_amount ?? 0, data.base_currency)}</dd>
          </div>
          <div className="flex justify-between border-b border-neutral-100 py-1.5">
            <dt className="text-neutral-500">Unpaid bills outstanding</dt>
            <dd className="text-neutral-800">
              {format(data.spending.pending.headline_amount, data.spending.pending.headline_currency)}
              <MixedNote totals={data.spending.pending} format={format} />
            </dd>
          </div>
          <div className="flex justify-between border-b border-neutral-100 py-1.5">
            <dt className="text-neutral-500">Equipment needing a service</dt>
            <dd className={data.assets.service_due ? "font-medium text-amber-700" : "text-neutral-800"}>
              {data.assets.service_due}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[12px] text-neutral-400">
          Unpaid bills are not in the outflow until they are paid. Day passes and personal training paid
          at the desk are not included — they are not recorded as sales in this system yet.
        </p>
      </Card>
    </div>
  );
}

// The profit and loss, line by line: revenue less refunds, less every outflow
// line, in the base currency, with any other currency noted on its line.
function ProfitAndLoss({ pnl, format }: { pnl: NonNullable<Overview["profit_and_loss"]>; format: (v: number, c?: string) => string }) {
  const row = (line: PnlLine) => (
    <div key={line.key} className="flex items-baseline justify-between border-b border-neutral-100 py-1.5">
      <dt className="text-neutral-600">
        {line.deducted ? `Less ${line.label.toLowerCase()}` : line.label}
        {line.key === "trainer_commission" && line.memberships && line.personal_training && (
          <span className="ml-1 text-[11px] text-neutral-400">
            memberships {format(line.memberships.base_amount, pnl.currency)} · PT {format(line.personal_training.base_amount, pnl.currency)}
          </span>
        )}
      </dt>
      <dd className="whitespace-nowrap tabular-nums text-neutral-800">
        {line.deducted && line.base_amount ? "−" : ""}
        {format(line.base_amount, pnl.currency)}
        <MixedNote totals={line} format={format} />
      </dd>
    </div>
  );
  const total = (label: string, value: number, tone?: "good" | "bad") => (
    <div className="flex items-baseline justify-between py-2 font-semibold">
      <dt className="text-neutral-900">{label}</dt>
      <dd className={`tabular-nums ${tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-600" : "text-neutral-900"}`}>{format(value, pnl.currency)}</dd>
    </div>
  );
  const setAside = pnl.set_aside.payslip_expenses + pnl.set_aside.asset_purchase_expenses;

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold text-neutral-900">Profit and loss</h2>
      <p className="mb-4 text-[12px] text-neutral-500">
        {pnl.currency} · each cost counted once
        {setAside > 0 &&
          ` · ${setAside} expense${setAside === 1 ? "" : "s"} counted under salaries or asset purchases instead`}
      </p>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-[13px] lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Revenue</h3>
          <dl>
            {pnl.revenue.map(row)}
            {total("Total revenue", pnl.total_revenue)}
          </dl>
        </div>
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Outflow</h3>
          <dl>
            {pnl.outflow.map(row)}
            {total("Total outflow", pnl.total_outflow)}
          </dl>
        </div>
      </div>
      <dl className="mt-2 border-t border-neutral-200">
        {total(
          pnl.margin !== null ? `Net profit · ${pnl.margin}% margin` : "Net profit",
          pnl.net_profit,
          pnl.net_profit >= 0 ? "good" : "bad"
        )}
      </dl>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

function SalesTab({ data, format }: { data: SalesResponse | null; format: (v: number, c?: string) => string }) {
  if (!data) return <EmptyState title="No sales data" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Sales" value={format(data.summary.base_amount, data.base_currency)} hint={`${data.summary.orders} payments`} accent={SERIES_IN} />
        <Stat label="Average sale" value={format(data.summary.average_sale, data.base_currency)} />
        <Stat label="New members" value={String(data.summary.new_business)} hint="first purchase" tone="good" />
        <Stat label="Renewals" value={String(data.summary.renewals)} hint="bought before" />
        <Stat label="Refunded" value={format(data.summary.refunds.base_amount, data.base_currency)} tone={data.summary.refunds.base_amount ? "bad" : "neutral"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">Sales by package</h2>
          <CategoryBars
            color={SERIES_IN}
            rows={data.summary.by_package.map((entry) => ({
              key: entry.name,
              label: entry.name,
              value: entry.totals.base_amount,
              count: entry.count,
              currency: entry.totals.base_currency,
            }))}
            format={format}
            emptyLabel="No sales in this period"
          />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">How they paid</h2>
          <CategoryBars
            color={SERIES_IN}
            rows={data.summary.by_method.map((entry) => ({
              key: entry.method,
              label: entry.method.replace(/_/g, " "),
              value: entry.totals.base_amount,
              count: entry.count,
              currency: entry.totals.base_currency,
            }))}
            format={format}
            emptyLabel="No sales in this period"
          />
        </Card>
      </div>

      {!data.sales.length ? (
        <EmptyState title="No sales in this period" hint="Widen the dates or change the payment filter." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["Order", "Customer", "Package", "Amount", "Paid", "Type", "Status"].map((column) => (
                    <th key={column} className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sales.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                    <td className="px-5 py-3"><code className="text-xs text-neutral-600">{row.order_number}</code></td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-neutral-900">{row.customer}</div>
                      <div className="text-[11px] text-neutral-400">{row.email}</div>
                    </td>
                    <td className="px-5 py-3 text-neutral-700">{row.package}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium tabular-nums text-neutral-900">{format(row.amount, row.currency)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-neutral-700">
                      {row.paid_label || "—"}
                      <div className="text-[11px] text-neutral-400">{row.method.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${row.kind === "new" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15" : "bg-neutral-100 text-neutral-600 ring-neutral-500/15"}`}>
                        {row.kind === "new" ? "New" : "Renewal"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${row.payment_status === "paid" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15" : row.payment_status === "refunded" ? "bg-rose-50 text-rose-700 ring-rose-600/15" : "bg-amber-50 text-amber-800 ring-amber-600/20"}`}>
                        {row.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

function ExpensesTab({
  data,
  format,
  editable,
  onEdit,
  onDelete,
  onDraftPayroll,
}: {
  data: ExpensesResponse | null;
  format: (v: number, c?: string) => string;
  editable: boolean;
  onEdit: (row?: ExpenseRow) => void;
  onDelete: (row: ExpenseRow) => void;
  onDraftPayroll: () => void;
}) {
  if (!data) return <EmptyState title="No expense data" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Paid out" value={format(data.summary.paid.headline_amount, data.summary.paid.headline_currency)} accent={SERIES_OUT} />
        <Stat label="Still owed" value={format(data.summary.pending.headline_amount, data.summary.pending.headline_currency)} tone={data.summary.pending.headline_amount ? "bad" : "neutral"} hint="entered but unpaid" />
        <Stat label="Entries" value={String(data.summary.count)} hint="in this period" />
        <Stat label="Biggest cost" value={data.summary.by_category[0]?.label || "—"} hint={data.summary.by_category[0] ? format(data.summary.by_category[0].totals.base_amount, data.base_currency) : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">By category</h2>
          <CategoryBars
            rows={data.summary.by_category.map((entry) => ({
              key: entry.category,
              label: entry.label,
              value: entry.totals.base_amount,
              count: entry.count,
              currency: entry.totals.base_currency,
            }))}
            format={format}
            emptyLabel="Nothing recorded yet"
          />
          {editable && (
            <div className="mt-5 border-t border-neutral-100 pt-4">
              <SecondaryButton onClick={onDraftPayroll}>Draft this period&apos;s salaries</SecondaryButton>
              <p className="mt-2 text-[12px] text-neutral-400">
                Creates one unpaid entry per salaried staff member from their pay rate.
              </p>
            </div>
          )}
        </Card>

        <div className="lg:col-span-2">
          {!data.expenses.length ? (
            <EmptyState title="No expenses in this period" hint="Add one, or widen the dates." />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50/80">
                      {["Expense", "Category", "Amount", "Date", "Status", ""].map((column) => (
                        <th key={column} className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                        <td className="px-5 py-3">
                          <div className="font-medium text-neutral-900">{row.title}</div>
                          <div className="text-[11px] text-neutral-400">
                            {row.reference}
                            {row.vendor ? ` · ${row.vendor}` : ""}
                            {row.recurring.is_recurring ? ` · repeats ${row.recurring.cycle}` : ""}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-neutral-700">{row.category_label}</td>
                        <td className="whitespace-nowrap px-5 py-3 font-medium tabular-nums text-neutral-900">{format(row.amount, row.currency)}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-neutral-700">{row.incurred_label}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${row.status === "paid" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15" : row.status === "pending" ? "bg-amber-50 text-amber-800 ring-amber-600/20" : "bg-neutral-100 text-neutral-500 ring-neutral-500/15"}`}>
                            {row.status === "pending" ? "unpaid" : row.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          {editable && (
                            <div className="flex items-center justify-end gap-2">
                              <SecondaryButton onClick={() => onEdit(row)}>Edit</SecondaryButton>
                              <DangerButton onClick={() => onDelete(row)}>Delete</DangerButton>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

function AssetsTab({
  data,
  format,
  editable,
  onEdit,
  onService,
  onDelete,
}: {
  data: AssetsResponse | null;
  format: (v: number, c?: string) => string;
  editable: boolean;
  onEdit: (row?: AssetRow) => void;
  onService: (row: AssetRow) => void;
  onDelete: (row: AssetRow) => void;
}) {
  if (!data) return <EmptyState title="No asset data" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Items" value={String(data.summary.count)} hint={`${data.summary.units} units`} />
        <Stat label="Bought for" value={format(data.summary.cost.headline_amount, data.summary.cost.headline_currency)} hint="original cost" />
        <Stat label="Worth now" value={format(data.summary.book_value.headline_amount, data.summary.book_value.headline_currency)} hint="after depreciation" />
        <Stat label="Service overdue" value={String(data.summary.service_overdue)} tone={data.summary.service_overdue ? "bad" : "neutral"} hint={`${data.summary.service_soon} due within 30 days`} />
        <Stat label="Poor condition" value={String(data.summary.needs_attention)} tone={data.summary.needs_attention ? "bad" : "neutral"} hint="replace or repair" />
      </div>

      {!data.assets.length ? (
        <EmptyState title="Nothing in the register" hint={editable ? "Add your equipment to track what it is worth and when it needs servicing." : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  {["Asset", "Category", "Cost", "Worth now", "Condition", "Next service", ""].map((column) => (
                    <th key={column} className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.assets.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">{row.name}</span>
                        {row.quantity > 1 && <span className="text-[11px] text-neutral-400">×{row.quantity}</span>}
                        {row.status !== "active" && (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_TONE[row.status]}`}>{row.status}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {[row.tag, row.location, row.purchased_label ? `bought ${row.purchased_label}` : ""].filter(Boolean).join(" · ")}
                      </div>
                      {row.warranty_active && row.warranty_label && (
                        <div className="text-[11px] text-neutral-400">warranty until {row.warranty_label}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-neutral-700">{row.category_label}</td>
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-neutral-700">{format(row.total_cost, row.currency)}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="font-medium tabular-nums text-neutral-900">{format(row.book_value, row.currency)}</span>
                      {row.age_years !== null && <div className="text-[11px] text-neutral-400">{row.age_years} yrs old</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CONDITION_TONE[row.condition]}`}>{row.condition}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {!row.next_service_label ? (
                        <span className="text-[12px] text-neutral-400">Not scheduled</span>
                      ) : row.service_overdue ? (
                        <span className="flex items-center gap-1.5 text-[12px] font-medium text-rose-600">
                          <FiAlertTriangle className="h-3.5 w-3.5" /> Overdue {Math.abs(row.days_to_service || 0)} d
                        </span>
                      ) : (
                        <span className="text-[12px] text-neutral-700">
                          {row.next_service_label}
                          <span className="ml-1 text-neutral-400">in {row.days_to_service} d</span>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      {editable && (
                        <div className="flex items-center justify-end gap-2">
                          {row.service_interval_days > 0 && <SecondaryButton onClick={() => onService(row)}>Serviced</SecondaryButton>}
                          <SecondaryButton onClick={() => onEdit(row)}>Edit</SecondaryButton>
                          <DangerButton onClick={() => onDelete(row)}>Remove</DangerButton>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
