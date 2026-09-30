// The thermal receipt for money taken at the fee desk, built from the order
// the API answered with -- never from what the form said, so the paper shows
// what was actually recorded (the real period, the invoice number, the
// balance left).

import type { ReceiptLine, ThermalReceiptProps } from "@/components/receipts";
import { fmtDate, methodLabel, priceNumber, round2, type DeskMember, type OrderResult } from "./desk";

/** A receipt without the gym's details, which the page adds when it prints. */
export type DeskReceipt = Omit<ThermalReceiptProps, "branding" | "settings">;

function customerOf(member: DeskMember) {
  return member.memberCode ? `${member.name} (${member.memberCode})` : member.name;
}

function periodOf(order: OrderResult) {
  const s = order.subscription || {};
  return s.startDate || s.endDate ? `${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}` : "";
}

/**
 * A membership sold or renewed: the package for its period, any admission
 * or trainer's fee beside it, the discount, and what was paid now.
 */
export function membershipReceipt(order: OrderResult, member: DeskMember, cashier?: string): DeskReceipt {
  const p = order.payment;
  const joiningFee = round2(p.joiningFee || 0);
  const trainerFee = round2(p.trainerFee || 0);
  // The package's price when it was sold: the order's subtotal less the fees
  // beside it, or the price on the order's copy of the package.
  const listPrice =
    p.subtotal !== undefined && p.subtotal !== null
      ? round2(p.subtotal - joiningFee - trainerFee)
      : priceNumber(order.packageDetails.price) ?? round2(p.amount);

  const lines: ReceiptLine[] = [
    { name: order.packageDetails.name, quantity: 1, unitPrice: listPrice, total: listPrice, detail: periodOf(order) || undefined },
  ];
  if (joiningFee > 0) lines.push({ name: "Admission fee", quantity: 1, unitPrice: joiningFee, total: joiningFee });
  if (trainerFee > 0) lines.push({ name: "Personal trainer", quantity: 1, unitPrice: trainerFee, total: trainerFee });

  const total = round2(p.amount);
  let subtotal = round2(lines.reduce((sum, line) => sum + line.total, 0));
  // An amount agreed above the price reads as a line of its own, so the
  // lines always add up to the total.
  if (total > subtotal) {
    lines.push({ name: "Adjustment", quantity: 1, unitPrice: round2(total - subtotal), total: round2(total - subtotal) });
    subtotal = total;
  }
  const paidNow = round2(p.amountPaid ?? total);

  return {
    title: "Membership fee",
    number: order.invoice?.number || order.orderNumber,
    date: p.paidAt || new Date(),
    currency: (p.currency || "").toUpperCase(),
    cashier,
    customer: customerOf(member),
    lines,
    subtotal,
    discount: round2(subtotal - total),
    total,
    paid: paidNow,
    balanceDue: round2(p.balanceDue || 0),
    method: methodLabel(p.method),
    notes: [`Order ${order.orderNumber}`, p.discountNote ? `Discount: ${p.discountNote}` : "", order.subscription?.endDate ? `Valid until ${fmtDate(order.subscription.endDate)}` : ""]
      .filter(Boolean)
      .join("\n"),
  };
}

/** Money received against a balance: this payment, and what is still owed. */
export function paymentReceipt(order: OrderResult, member: DeskMember, amount: number, method: string, cashier?: string): DeskReceipt {
  const p = order.payment;
  const paid = round2(amount);
  const parts = p.installments || [];
  // The order's receipt number and which payment on it this is.
  const base = order.invoice?.number || order.orderNumber;
  const period = periodOf(order);
  return {
    title: "Payment received",
    number: parts.length ? `${base}-${parts.length}` : base,
    date: parts.length ? parts[parts.length - 1].at : new Date(),
    currency: (p.currency || "").toUpperCase(),
    cashier,
    customer: customerOf(member),
    lines: [{ name: `Balance payment — ${order.packageDetails.name}`, quantity: 1, unitPrice: paid, total: paid, detail: period || undefined }],
    subtotal: paid,
    total: paid,
    paid,
    balanceDue: round2(p.balanceDue || 0),
    method: methodLabel(method),
    notes: [`Order ${order.orderNumber}`, `Order total ${(p.currency || "").toUpperCase()} ${round2(p.amount).toFixed(2)}`, `Paid so far ${round2(p.amountPaid ?? p.amount).toFixed(2)}`].join("\n"),
  };
}
