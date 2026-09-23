import Decimal from "decimal.js";

/** Decimal constructor configured for financial math: high precision, half-up rounding. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

export type Numeric = number | string | Dec;

const ZERO = new D(0);
const HUNDRED = new D(100);

/** Parses any numeric input; non-finite / empty values become 0. */
export function dec(value: Numeric | null | undefined): Dec {
  if (value === null || value === undefined || value === "") return ZERO;
  if (value instanceof D) return value;
  if (typeof value === "number" && !Number.isFinite(value)) return ZERO;
  try {
    return new D(value);
  } catch {
    return ZERO;
  }
}

/** Rounds to cents using half-up rounding. */
export function round2(value: Numeric): Dec {
  return dec(value).toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/** Rounds to cents and converts to a number (safe up to ~9e13 major units). */
export function money(value: Numeric): number {
  return round2(value).toNumber();
}

/** Converts a percent number (10 = 10%) into a ratio Decimal (0.1). */
export function pct(value: Numeric): Dec {
  return dec(value).div(HUNDRED);
}

/** Returns a / b * 100 rounded to 4 decimal places, or null when b is zero. */
export function ratioPct(a: Numeric, b: Numeric): number | null {
  const denominator = dec(b);
  if (denominator.isZero()) return null;
  return dec(a).div(denominator).mul(HUNDRED).toDecimalPlaces(4, D.ROUND_HALF_UP).toNumber();
}

export function sum(values: Numeric[]): Dec {
  return values.reduce<Dec>((acc, v) => acc.plus(dec(v)), ZERO);
}

/** Sums values after rounding each to cents so totals reconcile with displayed lines. */
export function sumMoney(values: Numeric[]): number {
  return values.reduce<Dec>((acc, v) => acc.plus(round2(v)), ZERO).toNumber();
}

export function max(a: Numeric, b: Numeric): Dec {
  return D.max(dec(a), dec(b));
}

export function min(a: Numeric, b: Numeric): Dec {
  return D.min(dec(a), dec(b));
}

export function clamp(value: Numeric, lo: Numeric, hi: Numeric): Dec {
  return D.min(D.max(dec(value), dec(lo)), dec(hi));
}
