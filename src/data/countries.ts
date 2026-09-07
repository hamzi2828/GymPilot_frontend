// Countries a gym can pick in Settings → General, with the currency it
// charges in and the clock it runs on. Picking a country fills the currency
// and timezone; both can still be changed on their own.
//
// Currency names and symbols come from the browser (Intl), so the list only
// needs codes.

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  currency: string; // ISO 4217
  timezone: string; // IANA, the country's main clock
}

export const COUNTRIES: Country[] = [
  { code: "AE", name: "United Arab Emirates", currency: "AED", timezone: "Asia/Dubai" },
  { code: "AF", name: "Afghanistan", currency: "AFN", timezone: "Asia/Kabul" },
  { code: "AL", name: "Albania", currency: "ALL", timezone: "Europe/Tirane" },
  { code: "AR", name: "Argentina", currency: "ARS", timezone: "America/Argentina/Buenos_Aires" },
  { code: "AT", name: "Austria", currency: "EUR", timezone: "Europe/Vienna" },
  { code: "AU", name: "Australia", currency: "AUD", timezone: "Australia/Sydney" },
  { code: "AZ", name: "Azerbaijan", currency: "AZN", timezone: "Asia/Baku" },
  { code: "BA", name: "Bosnia and Herzegovina", currency: "BAM", timezone: "Europe/Sarajevo" },
  { code: "BD", name: "Bangladesh", currency: "BDT", timezone: "Asia/Dhaka" },
  { code: "BE", name: "Belgium", currency: "EUR", timezone: "Europe/Brussels" },
  { code: "BG", name: "Bulgaria", currency: "BGN", timezone: "Europe/Sofia" },
  { code: "BH", name: "Bahrain", currency: "BHD", timezone: "Asia/Bahrain" },
  { code: "BN", name: "Brunei", currency: "BND", timezone: "Asia/Brunei" },
  { code: "BR", name: "Brazil", currency: "BRL", timezone: "America/Sao_Paulo" },
  { code: "CA", name: "Canada", currency: "CAD", timezone: "America/Toronto" },
  { code: "CH", name: "Switzerland", currency: "CHF", timezone: "Europe/Zurich" },
  { code: "CL", name: "Chile", currency: "CLP", timezone: "America/Santiago" },
  { code: "CN", name: "China", currency: "CNY", timezone: "Asia/Shanghai" },
  { code: "CO", name: "Colombia", currency: "COP", timezone: "America/Bogota" },
  { code: "CR", name: "Costa Rica", currency: "CRC", timezone: "America/Costa_Rica" },
  { code: "CY", name: "Cyprus", currency: "EUR", timezone: "Asia/Nicosia" },
  { code: "CZ", name: "Czechia", currency: "CZK", timezone: "Europe/Prague" },
  { code: "DE", name: "Germany", currency: "EUR", timezone: "Europe/Berlin" },
  { code: "DK", name: "Denmark", currency: "DKK", timezone: "Europe/Copenhagen" },
  { code: "DO", name: "Dominican Republic", currency: "DOP", timezone: "America/Santo_Domingo" },
  { code: "DZ", name: "Algeria", currency: "DZD", timezone: "Africa/Algiers" },
  { code: "EE", name: "Estonia", currency: "EUR", timezone: "Europe/Tallinn" },
  { code: "EG", name: "Egypt", currency: "EGP", timezone: "Africa/Cairo" },
  { code: "ES", name: "Spain", currency: "EUR", timezone: "Europe/Madrid" },
  { code: "ET", name: "Ethiopia", currency: "ETB", timezone: "Africa/Addis_Ababa" },
  { code: "FI", name: "Finland", currency: "EUR", timezone: "Europe/Helsinki" },
  { code: "FR", name: "France", currency: "EUR", timezone: "Europe/Paris" },
  { code: "GB", name: "United Kingdom", currency: "GBP", timezone: "Europe/London" },
  { code: "GE", name: "Georgia", currency: "GEL", timezone: "Asia/Tbilisi" },
  { code: "GH", name: "Ghana", currency: "GHS", timezone: "Africa/Accra" },
  { code: "GR", name: "Greece", currency: "EUR", timezone: "Europe/Athens" },
  { code: "HK", name: "Hong Kong", currency: "HKD", timezone: "Asia/Hong_Kong" },
  { code: "HR", name: "Croatia", currency: "EUR", timezone: "Europe/Zagreb" },
  { code: "HU", name: "Hungary", currency: "HUF", timezone: "Europe/Budapest" },
  { code: "ID", name: "Indonesia", currency: "IDR", timezone: "Asia/Jakarta" },
  { code: "IE", name: "Ireland", currency: "EUR", timezone: "Europe/Dublin" },
  { code: "IL", name: "Israel", currency: "ILS", timezone: "Asia/Jerusalem" },
  { code: "IN", name: "India", currency: "INR", timezone: "Asia/Kolkata" },
  { code: "IQ", name: "Iraq", currency: "IQD", timezone: "Asia/Baghdad" },
  { code: "IR", name: "Iran", currency: "IRR", timezone: "Asia/Tehran" },
  { code: "IS", name: "Iceland", currency: "ISK", timezone: "Atlantic/Reykjavik" },
  { code: "IT", name: "Italy", currency: "EUR", timezone: "Europe/Rome" },
  { code: "JM", name: "Jamaica", currency: "JMD", timezone: "America/Jamaica" },
  { code: "JO", name: "Jordan", currency: "JOD", timezone: "Asia/Amman" },
  { code: "JP", name: "Japan", currency: "JPY", timezone: "Asia/Tokyo" },
  { code: "KE", name: "Kenya", currency: "KES", timezone: "Africa/Nairobi" },
  { code: "KH", name: "Cambodia", currency: "KHR", timezone: "Asia/Phnom_Penh" },
  { code: "KR", name: "South Korea", currency: "KRW", timezone: "Asia/Seoul" },
  { code: "KW", name: "Kuwait", currency: "KWD", timezone: "Asia/Kuwait" },
  { code: "KZ", name: "Kazakhstan", currency: "KZT", timezone: "Asia/Almaty" },
  { code: "LB", name: "Lebanon", currency: "LBP", timezone: "Asia/Beirut" },
  { code: "LK", name: "Sri Lanka", currency: "LKR", timezone: "Asia/Colombo" },
  { code: "LT", name: "Lithuania", currency: "EUR", timezone: "Europe/Vilnius" },
  { code: "LU", name: "Luxembourg", currency: "EUR", timezone: "Europe/Luxembourg" },
  { code: "LV", name: "Latvia", currency: "EUR", timezone: "Europe/Riga" },
  { code: "LY", name: "Libya", currency: "LYD", timezone: "Africa/Tripoli" },
  { code: "MA", name: "Morocco", currency: "MAD", timezone: "Africa/Casablanca" },
  { code: "MD", name: "Moldova", currency: "MDL", timezone: "Europe/Chisinau" },
  { code: "MK", name: "North Macedonia", currency: "MKD", timezone: "Europe/Skopje" },
  { code: "MM", name: "Myanmar", currency: "MMK", timezone: "Asia/Yangon" },
  { code: "MN", name: "Mongolia", currency: "MNT", timezone: "Asia/Ulaanbaatar" },
  { code: "MT", name: "Malta", currency: "EUR", timezone: "Europe/Malta" },
  { code: "MU", name: "Mauritius", currency: "MUR", timezone: "Indian/Mauritius" },
  { code: "MV", name: "Maldives", currency: "MVR", timezone: "Indian/Maldives" },
  { code: "MX", name: "Mexico", currency: "MXN", timezone: "America/Mexico_City" },
  { code: "MY", name: "Malaysia", currency: "MYR", timezone: "Asia/Kuala_Lumpur" },
  { code: "NG", name: "Nigeria", currency: "NGN", timezone: "Africa/Lagos" },
  { code: "NL", name: "Netherlands", currency: "EUR", timezone: "Europe/Amsterdam" },
  { code: "NO", name: "Norway", currency: "NOK", timezone: "Europe/Oslo" },
  { code: "NP", name: "Nepal", currency: "NPR", timezone: "Asia/Kathmandu" },
  { code: "NZ", name: "New Zealand", currency: "NZD", timezone: "Pacific/Auckland" },
  { code: "OM", name: "Oman", currency: "OMR", timezone: "Asia/Muscat" },
  { code: "PA", name: "Panama", currency: "PAB", timezone: "America/Panama" },
  { code: "PE", name: "Peru", currency: "PEN", timezone: "America/Lima" },
  { code: "PH", name: "Philippines", currency: "PHP", timezone: "Asia/Manila" },
  { code: "PK", name: "Pakistan", currency: "PKR", timezone: "Asia/Karachi" },
  { code: "PL", name: "Poland", currency: "PLN", timezone: "Europe/Warsaw" },
  { code: "PT", name: "Portugal", currency: "EUR", timezone: "Europe/Lisbon" },
  { code: "QA", name: "Qatar", currency: "QAR", timezone: "Asia/Qatar" },
  { code: "RO", name: "Romania", currency: "RON", timezone: "Europe/Bucharest" },
  { code: "RS", name: "Serbia", currency: "RSD", timezone: "Europe/Belgrade" },
  { code: "RU", name: "Russia", currency: "RUB", timezone: "Europe/Moscow" },
  { code: "RW", name: "Rwanda", currency: "RWF", timezone: "Africa/Kigali" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", timezone: "Asia/Riyadh" },
  { code: "SE", name: "Sweden", currency: "SEK", timezone: "Europe/Stockholm" },
  { code: "SG", name: "Singapore", currency: "SGD", timezone: "Asia/Singapore" },
  { code: "SI", name: "Slovenia", currency: "EUR", timezone: "Europe/Ljubljana" },
  { code: "SK", name: "Slovakia", currency: "EUR", timezone: "Europe/Bratislava" },
  { code: "TH", name: "Thailand", currency: "THB", timezone: "Asia/Bangkok" },
  { code: "TN", name: "Tunisia", currency: "TND", timezone: "Africa/Tunis" },
  { code: "TR", name: "Türkiye", currency: "TRY", timezone: "Europe/Istanbul" },
  { code: "TW", name: "Taiwan", currency: "TWD", timezone: "Asia/Taipei" },
  { code: "TZ", name: "Tanzania", currency: "TZS", timezone: "Africa/Dar_es_Salaam" },
  { code: "UA", name: "Ukraine", currency: "UAH", timezone: "Europe/Kyiv" },
  { code: "UG", name: "Uganda", currency: "UGX", timezone: "Africa/Kampala" },
  { code: "US", name: "United States", currency: "USD", timezone: "America/New_York" },
  { code: "UY", name: "Uruguay", currency: "UYU", timezone: "America/Montevideo" },
  { code: "UZ", name: "Uzbekistan", currency: "UZS", timezone: "Asia/Tashkent" },
  { code: "VN", name: "Vietnam", currency: "VND", timezone: "Asia/Ho_Chi_Minh" },
  { code: "ZA", name: "South Africa", currency: "ZAR", timezone: "Africa/Johannesburg" },
  { code: "ZM", name: "Zambia", currency: "ZMW", timezone: "Africa/Lusaka" },
  { code: "ZW", name: "Zimbabwe", currency: "ZWL", timezone: "Africa/Harare" },
].sort((a, b) => a.name.localeCompare(b.name));

export function countryByCode(code?: string | null): Country | undefined {
  if (!code) return undefined;
  const upper = String(code).toUpperCase();
  return COUNTRIES.find((c) => c.code === upper);
}

let displayNames: Intl.DisplayNames | null | undefined;
function currencyDisplayNames(): Intl.DisplayNames | null {
  if (displayNames !== undefined) return displayNames;
  try {
    displayNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "currency" }) : null;
  } catch {
    displayNames = null;
  }
  return displayNames;
}

/** "British Pound" for GBP; the code itself when the browser has no name. */
export function currencyName(code: string): string {
  try {
    const name = currencyDisplayNames()?.of(code);
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}

/** "£" for GBP, "Rs" for PKR; the code when there is no distinct symbol. */
export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(1).find((p) => p.type === "currency");
    return part ? part.value : code;
  } catch {
    return code;
  }
}

// Every currency a listed country uses, plus a few used across borders.
const EXTRA_CURRENCIES = ["XOF", "XAF", "XCD", "AWG", "BBD", "BSD", "BZD", "BWP", "FJD", "GTQ", "HNL", "KYD", "MOP", "NAD", "NIO", "PGK", "PYG", "TTD", "BOB", "VES", "SDG", "SYP", "YER", "MZN", "AOA", "MGA", "MWK", "SCR", "SLE", "GMD", "CVE", "BIF", "DJF", "ERN", "KGS", "TJS", "TMT", "LAK", "BTN", "MRU", "STN", "SZL", "LSL", "SBD", "TOP", "VUV", "WST", "KMF", "GNF", "LRD", "SSP", "SRD", "GYD", "HTG", "CUP"];

export const CURRENCIES: string[] = Array.from(new Set([...COUNTRIES.map((c) => c.currency), ...EXTRA_CURRENCIES])).sort();

export function currencyOptions() {
  return CURRENCIES.map((code) => ({ value: code, label: `${code} — ${currencyName(code)}`, hint: currencySymbol(code) }));
}

export function countryOptions() {
  return COUNTRIES.map((c) => ({ value: c.code, label: c.name, hint: `${c.currency} · ${c.timezone}` }));
}
