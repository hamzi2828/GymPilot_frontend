// src/helper/money.ts
//
// A package's price is the display string the admin typed ("Rs. 1,200/-",
// "$1,299.99"). The API charges parseAmount() of that string
// (GymPilot_backend/src/helper/money.js), so this is a line-for-line mirror:
// the total shown at checkout has to be the amount the card is charged.

/** Major units (rupees, pounds, dollars) from a typed price, or null if none. */
export function parseAmount(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  // A negative price is not a price.
  if (/-\s*\d/.test(raw)) return null;

  // Drop the currency symbol and code, keeping digits and separators.
  let digits = raw.replace(/[^\d.,]/g, "");

  // "Rs. 1,200/-" leaves ".1,200": that leading dot came from the
  // abbreviation, not the number, and must not be read as a decimal point.
  digits = digits.replace(/^[.,]+/, "").replace(/[.,]+$/, "");
  if (!digits) return null;

  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: whichever comes last is the decimal point.
    digits = lastComma > lastDot ? digits.replace(/\./g, "").replace(",", ".") : digits.replace(/,/g, "");
  } else if (lastComma !== -1) {
    // Only commas: read as grouping ("5,000").
    digits = digits.replace(/,/g, "");
  }

  // Several dots left were all grouping ("1.500.000") unless the last group
  // is not three digits long.
  const parts = digits.split(".");
  let cleaned = digits;
  if (parts.length > 2) {
    cleaned =
      parts[parts.length - 1].length === 3
        ? parts.join("")
        : parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }

  const amount = parseFloat(cleaned);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}
