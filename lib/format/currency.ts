import type { CurrencyCode } from "@/lib/commission-engine/types";

export const CURRENCIES: { code: CurrencyCode; label: string; locale: string }[] = [
  { code: "USD", label: "USD – US Dollar", locale: "en-US" },
  { code: "EUR", label: "EUR – Euro", locale: "de-DE" },
  { code: "GBP", label: "GBP – British Pound", locale: "en-GB" },
  { code: "CZK", label: "CZK – Czech Koruna", locale: "cs-CZ" },
];

const cache = new Map<string, Intl.NumberFormat>();

function formatter(currency: CurrencyCode, options: { compact?: boolean; decimals?: boolean }): Intl.NumberFormat {
  const key = `${currency}:${options.compact ? "c" : ""}${options.decimals === false ? "0" : "2"}`;
  let f = cache.get(key);
  if (!f) {
    const locale = CURRENCIES.find((c) => c.code === currency)?.locale ?? "en-US";
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      ...(options.compact
        ? { notation: "compact", maximumFractionDigits: 1 }
        : options.decimals === false
          ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
          : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
    cache.set(key, f);
  }
  return f;
}

export function formatCurrency(
  value: number | null | undefined,
  currency: CurrencyCode,
  options: { compact?: boolean; decimals?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  return formatter(currency, options).format(value);
}

export function currencySymbol(currency: CurrencyCode): string {
  const parts = formatter(currency, {}).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? currency;
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  return `${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}
