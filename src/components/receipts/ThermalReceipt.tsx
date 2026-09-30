"use client";

// A receipt for a thermal roll printer: 80mm or 58mm wide, black on white,
// the gym's own details at the top and its footer at the bottom. The till
// prints it for a sale; anything else that takes money at the desk (a
// membership fee, say) can hand it its own lines and totals.
//
// It carries its own stylesheet, scoped to .gp-receipt, rather than relying
// on the site's Tailwind: printReceipt() renders it into an empty frame that
// has none of the page's CSS, and the preview on screen must look exactly
// like what comes out of the printer.

import React from "react";

export type PaperWidth = "80mm" | "58mm";

export interface ReceiptLine {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** A smaller second line under the name: a SKU, a period, a session count. */
  detail?: string;
}

/** Who the receipt is from. Everything but the name is optional and left out when empty. */
export interface ReceiptBranding {
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  /** "Tax", "VAT", "GST" -- the word printed beside the tax number and amount. */
  taxLabel?: string;
  taxNumber?: string;
  /** Printed when the receipt settings have no footer of their own (the invoice's footer). */
  footerNote?: string;
}

/** How the gym prints: settings.receipt on the backend. */
export interface ReceiptSettings {
  paperWidth: PaperWidth;
  showLogo: boolean;
  footerText: string;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = { paperWidth: "80mm", showLogo: true, footerText: "" };

export interface ThermalReceiptProps {
  branding: ReceiptBranding;
  settings: ReceiptSettings;
  /** The heading under the gym's details. Defaults to "Receipt". */
  title?: string;
  number: string;
  date: string | Date;
  currency: string;
  /** Who took the money. */
  cashier?: string;
  customer?: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount?: number;
  /** The tax amount. Printed only when above zero. */
  tax?: number;
  /** The tax rate in percent, printed beside the amount. */
  taxRate?: number;
  /** Prices include the tax (the default, as everywhere in GymPilot): it is shown as "incl." and not added to the total. */
  taxInclusive?: boolean;
  total: number;
  /** What was handed over. Printed only when given. */
  paid?: number;
  /** Change given back. Printed only when above zero. */
  change?: number;
  /** Still owed after this payment. Printed whenever given, zero included. */
  balanceDue?: number;
  /** The payment method as it should read: "Cash", "JazzCash". */
  method?: string;
  notes?: string;
  /** A word printed large across the top, e.g. "Refunded". */
  status?: string;
}

// Printable width on each roll, and the side margin that leaves it: a 80mm
// head prints 72mm, a 58mm head 48mm.
const PAPER: Record<PaperWidth, { padding: string; font: string }> = {
  "80mm": { padding: "4mm", font: "12px" },
  "58mm": { padding: "5mm", font: "10.5px" },
};

export const RECEIPT_CSS = `
.gp-receipt { box-sizing: border-box; margin: 0 auto; background: #fff; color: #000; font-family: "Helvetica Neue", Arial, "Segoe UI", sans-serif; line-height: 1.35; font-variant-numeric: tabular-nums; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.gp-receipt * { box-sizing: border-box; }
.gp-receipt p { margin: 0; }
.gp-receipt .gp-c { text-align: center; }
.gp-receipt .gp-logo { display: block; margin: 0 auto 2mm; max-width: 60%; max-height: 18mm; object-fit: contain; }
.gp-receipt .gp-name { font-size: 1.35em; font-weight: 700; }
.gp-receipt .gp-small { font-size: 0.9em; }
.gp-receipt .gp-rule { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
.gp-receipt .gp-title { font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.gp-receipt .gp-status { border: 2px solid #000; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; text-align: center; padding: 1mm 0; margin-bottom: 2mm; }
.gp-receipt .gp-row { display: flex; justify-content: space-between; gap: 2mm; }
.gp-receipt .gp-row > span:first-child { min-width: 0; overflow-wrap: anywhere; }
.gp-receipt .gp-row > span:last-child { white-space: nowrap; text-align: right; }
.gp-receipt .gp-line { margin-bottom: 1mm; }
.gp-receipt .gp-line-name { font-weight: 600; overflow-wrap: anywhere; }
.gp-receipt .gp-total { font-size: 1.25em; font-weight: 700; margin: 1mm 0; }
.gp-receipt .gp-notes { white-space: pre-wrap; overflow-wrap: anywhere; }
.gp-receipt .gp-footer { margin-top: 3mm; white-space: pre-wrap; overflow-wrap: anywhere; }
`;

const num = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

function when(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Row({ label, value, className = "" }: { label: React.ReactNode; value: React.ReactNode; className?: string }) {
  return (
    <div className={`gp-row ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ThermalReceipt(props: ThermalReceiptProps) {
  const { branding: b, settings, currency } = props;
  const paper = PAPER[settings.paperWidth] || PAPER["80mm"];
  const taxLabel = b.taxLabel || "Tax";
  const footer = (settings.footerText || "").trim() || (b.footerNote || "").trim();
  const contact = [b.phone, b.email].filter(Boolean).join(" · ");
  const discount = Number(props.discount || 0);
  const tax = Number(props.tax || 0);

  return (
    <div className="gp-receipt" style={{ width: settings.paperWidth, padding: `4mm ${paper.padding} 6mm`, fontSize: paper.font }}>
      <style>{RECEIPT_CSS}</style>
      {props.status && <p className="gp-status">{props.status}</p>}

      <div className="gp-c">
        {settings.showLogo && b.logoUrl && (
          // A plain img: the receipt is rendered into a bare print frame,
          // where next/image's loader and layout do not exist.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="gp-logo"
            src={b.logoUrl}
            alt=""
            onError={(e) => {
              // A logo that will not load prints as nothing, not a broken icon.
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        {b.name && <p className="gp-name">{b.name}</p>}
        {b.address && <p className="gp-small">{b.address}</p>}
        {contact && <p className="gp-small">{contact}</p>}
        {b.taxNumber && (
          <p className="gp-small">
            {taxLabel} no. {b.taxNumber}
          </p>
        )}
      </div>

      <hr className="gp-rule" />
      <p className="gp-title gp-c">{props.title || "Receipt"}</p>
      <div className="gp-small" style={{ marginTop: "1mm" }}>
        <Row label="No." value={props.number} />
        <Row label="Date" value={when(props.date)} />
        {props.cashier && <Row label="Cashier" value={props.cashier} />}
        {props.customer && <Row label="Customer" value={props.customer} />}
      </div>

      <hr className="gp-rule" />
      {props.lines.map((line, i) => (
        <div key={i} className="gp-line">
          <p className="gp-line-name">{line.name}</p>
          {line.detail && <p className="gp-small">{line.detail}</p>}
          <Row label={`${qty(line.quantity)} × ${num(line.unitPrice)}`} value={num(line.total)} />
        </div>
      ))}

      <hr className="gp-rule" />
      <Row label="Subtotal" value={num(props.subtotal)} />
      {discount > 0 && <Row label="Discount" value={`-${num(discount)}`} />}
      {tax > 0 && props.taxInclusive === false && <Row label={`${taxLabel}${props.taxRate ? ` ${props.taxRate}%` : ""}`} value={num(tax)} />}
      <Row className="gp-total" label="Total" value={`${currency} ${num(props.total)}`} />
      {tax > 0 && props.taxInclusive !== false && (
        <Row className="gp-small" label={`Incl. ${taxLabel}${props.taxRate ? ` ${props.taxRate}%` : ""}`} value={num(tax)} />
      )}
      {props.paid !== undefined && <Row label={`Paid${props.method ? ` (${props.method})` : ""}`} value={num(props.paid)} />}
      {props.paid === undefined && props.method && <Row label="Payment" value={props.method} />}
      {Number(props.change || 0) > 0 && <Row label="Change" value={num(props.change || 0)} />}
      {props.balanceDue !== undefined && props.balanceDue !== null && <Row className="gp-title" label="Balance due" value={`${currency} ${num(props.balanceDue)}`} />}

      {props.notes && (
        <>
          <hr className="gp-rule" />
          <p className="gp-notes gp-small">{props.notes}</p>
        </>
      )}

      {footer && <p className="gp-footer gp-c gp-small">{footer}</p>}
    </div>
  );
}

export default ThermalReceipt;
