// src/utils/currency.js
// =============================================================================
// Currency formatting for the pricing and billing screens.
//
// The backend returns prices in minor units plus the currency code, so the UI
// never divides by 100 blindly — that would render ¥3,000 as ¥30 and KD 19.500
// as KD 1,950.
// =============================================================================

// ISO 4217 minor-unit exponents that differ from the usual 2.
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);
const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

const LOCALES = {
  USD: "en-US", EUR: "de-DE", GBP: "en-GB", INR: "en-IN", CAD: "en-CA",
  AUD: "en-AU", NZD: "en-NZ", SGD: "en-SG", HKD: "en-HK", CHF: "de-CH",
  JPY: "ja-JP", KRW: "ko-KR", CNY: "zh-CN", BRL: "pt-BR", MXN: "es-MX",
  ZAR: "en-ZA", AED: "en-AE", SEK: "sv-SE", NOK: "nb-NO", DKK: "da-DK",
  PLN: "pl-PL", TRY: "tr-TR", THB: "th-TH", IDR: "id-ID", MYR: "ms-MY",
  PHP: "en-PH", VND: "vi-VN",
};

export function currencyDecimals(currency) {
  const code = String(currency || "USD").toUpperCase();
  if (ZERO_DECIMAL.has(code)) return 0;
  if (THREE_DECIMAL.has(code)) return 3;
  return 2;
}

export function minorFactor(currency) {
  return 10 ** currencyDecimals(currency);
}

/** Minor units (cents) → major units (dollars). */
export function fromMinor(minorAmount, currency) {
  return (Number(minorAmount) || 0) / minorFactor(currency);
}

export function toMinor(majorAmount, currency) {
  return Math.round((Number(majorAmount) || 0) * minorFactor(currency));
}

/**
 * Format an amount held in minor units.
 * Whole amounts drop the decimals ($20, not $20.00); fractional ones keep them.
 */
export function formatMinor(minorAmount, currency = "USD", { showDecimals = "auto" } = {}) {
  const code = String(currency || "USD").toUpperCase();
  const value = fromMinor(minorAmount, code);
  const digits =
    showDecimals === "auto"
      ? Number.isInteger(value)
        ? 0
        : currencyDecimals(code)
      : showDecimals === false
        ? 0
        : currencyDecimals(code);

  try {
    return new Intl.NumberFormat(LOCALES[code] || "en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(digits)}`;
  }
}

/** Format an amount already in major units (dollars). */
export function formatMajor(majorAmount, currency = "USD", options) {
  return formatMinor(toMinor(majorAmount, currency), currency, options);
}

export function currencySymbol(currency = "USD") {
  const code = String(currency || "USD").toUpperCase();
  try {
    return (
      new Intl.NumberFormat(LOCALES[code] || "en-US", {
        style: "currency",
        currency: code,
        maximumFractionDigits: 0,
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value || code
    );
  } catch {
    return code;
  }
}

/**
 * Pull the price for one interval off a plan, preferring the backend-resolved
 * minor amount and falling back to the legacy major-unit fields.
 */
export function planPriceMinor(plan, interval = "monthly") {
  if (!plan) return 0;
  const currency = planCurrency(plan);
  if (interval === "yearly") {
    if (plan.price_yearly_minor != null) return Number(plan.price_yearly_minor);
    return toMinor(plan.price_yearly, currency);
  }
  if (plan.price_monthly_minor != null) return Number(plan.price_monthly_minor);
  return toMinor(plan.price_monthly, currency);
}

export function planCurrency(plan) {
  return String(plan?.currency || plan?.base_currency || "USD").toUpperCase();
}

export function formatPlanPrice(plan, interval = "monthly", options) {
  return formatMinor(planPriceMinor(plan, interval), planCurrency(plan), options);
}

/** Remembered currency choice, so a visitor's pick survives navigation. */
const STORAGE_KEY = "billing.currency";

export function getStoredCurrency() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? stored.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function setStoredCurrency(currency) {
  try {
    if (currency) localStorage.setItem(STORAGE_KEY, String(currency).toUpperCase());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private browsing — fall back to the geo-detected currency */
  }
}
