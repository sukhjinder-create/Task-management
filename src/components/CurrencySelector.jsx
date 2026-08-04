// src/components/CurrencySelector.jsx
// =============================================================================
// Currency picker for pricing and billing screens.
//
// The backend already infers a currency from the visitor's country, so this is
// an override rather than a required choice. The pick is remembered locally.
// =============================================================================
import { useEffect, useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { currencySymbol, getStoredCurrency, setStoredCurrency } from "../utils/currency";

const FALLBACK_CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "INR", name: "Indian Rupee" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "AED", name: "UAE Dirham" },
  { code: "JPY", name: "Japanese Yen" },
];

/**
 * @param {object}   props
 * @param {string}   props.value      currently selected currency code
 * @param {function} props.onChange   called with the new code
 * @param {Array}    props.currencies [{ code, name, symbol }] from the API
 * @param {boolean}  props.disabled
 */
export default function CurrencySelector({ value, onChange, currencies, disabled = false, compact = false }) {
  const options = useMemo(() => {
    const list = Array.isArray(currencies) && currencies.length ? currencies : FALLBACK_CURRENCIES;
    return list.map((item) => ({
      code: String(item.code || item).toUpperCase(),
      name: item.name || "",
      symbol: item.symbol || currencySymbol(item.code || item),
    }));
  }, [currencies]);

  const selected = String(value || "USD").toUpperCase();

  return (
    <label
      className={`inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] ${
        compact ? "px-2 py-1" : "px-3 py-1.5"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <Globe className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" aria-hidden="true" />
      <span className="sr-only">Display currency</span>
      <select
        value={selected}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          setStoredCurrency(next);
          onChange?.(next);
        }}
        className="bg-transparent text-sm font-semibold text-[color:var(--text)] outline-none cursor-pointer"
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.code}
            {option.name && !compact ? ` — ${option.name}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Resolves the currency to request: a remembered override, else whatever the
 * backend detected from the visitor's country.
 */
export function useDisplayCurrency(fetchCurrencies) {
  const [currency, setCurrency] = useState(() => getStoredCurrency());
  const [currencies, setCurrencies] = useState([]);
  const [detected, setDetected] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchCurrencies();
        if (cancelled || !data) return;
        setCurrencies(data.currencies || []);
        setDetected(data.detected || null);
        // Only adopt the detected currency when the user has not chosen one.
        if (!getStoredCurrency() && data.detected) setCurrency(data.detected);
      } catch {
        /* pricing still renders in whatever currency the plans endpoint returns */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchCurrencies]);

  return { currency, setCurrency, currencies, detected };
}
