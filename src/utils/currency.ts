import { CONFIG } from '../config';

export function cnyToEur(cny: number): number {
  return Math.round(cny * CONFIG.CNY_TO_EUR);
}
