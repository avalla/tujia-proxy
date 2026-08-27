import { CONFIG } from '../config';

/**
 * Read a Tujia price field, which is not always a number.
 *
 * A logged-out session gets the figure masked — `finalPrice: "1??"`, `productPrice:
 * "¥2??"` — rather than withheld. The mask is not noise: each `?` is one hidden
 * digit, so "1??" pins the price to 100–199, which is worth showing as a range
 * instead of throwing the value away. Logging in returns real numbers.
 */
export interface ParsedPrice {
  /** The exact figure, when Tujia gave one. */
  exact: number | null;
  /** Range implied by a mask, or [exact, exact] when it was a real number. */
  from: number | null;
  to: number | null;
  masked: boolean;
}

export function parsePrice(raw: unknown): ParsedPrice {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { exact: raw, from: raw, to: raw, masked: false };
  }
  const s = String(raw ?? '').replace(/[¥,\s]/g, '');
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    return { exact: n, from: n, to: n, masked: false };
  }
  const mask = s.match(/^(\d+)(\?+)$/);
  if (mask) {
    const [, digits, hidden] = mask;
    return {
      exact: null,
      from: parseInt(digits + '0'.repeat(hidden.length), 10),
      to: parseInt(digits + '9'.repeat(hidden.length), 10),
      masked: true,
    };
  }
  return { exact: null, from: null, to: null, masked: false };
}

export function cnyToEur(cny: number): number {
  return Math.round(cny * CONFIG.CNY_TO_EUR);
}

/** cnyToEur that carries null through, for the masked-price fields. */
export const cnyToEurOrNull = (cny: number | null): number | null =>
  cny === null ? null : cnyToEur(cny);
