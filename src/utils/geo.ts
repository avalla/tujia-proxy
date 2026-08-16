/**
 * All Tujia coordinates are Baidu bd09ll (`geoCoordSysType: "bd09ll"` on every unit).
 * We never convert to WGS84 — we only ever measure Tujia points against other Tujia
 * points, so staying inside bd09 keeps the datum consistent and the error at zero.
 *
 * Reference points below are Tujia's own, lifted from the `conditions/fetch` taxonomy,
 * so they are bd09 by construction.
 */

import { ALL_STATIONS } from '../catalog/filters.generated';

/** 中国进出口商品交易会（广交会）展馆 — taxonomy id 5_23158498 */
export const CANTON_FAIR = { lng: 113.36747, lat: 23.106647 };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in km. Matches Tujia's own `distance` field to ~2m. */
export function haversineKm(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

export function distanceToCantonFairKm(lng?: number, lat?: number): number | null {
  if (typeof lng !== 'number' || typeof lat !== 'number' || (lng === 0 && lat === 0)) {
    return null;
  }
  return Math.round(haversineKm({ lng, lat }, CANTON_FAIR) * 10) / 10;
}

/**
 * Nearest metro station, measured against the real station coordinates in the
 * generated catalog rather than guessed from address substrings.
 */
export interface NearestMetro {
  value: string; // taxonomy condition value, e.g. "1_268263"
  nameCn: string;
  nameEn: string;
  /** Every line serving this station — interchanges list more than one. */
  lines: string[];
  distanceKm: number;
  /** Rough walking time at 4.5 km/h, rounded up. */
  walkMinutes: number;
}

/**
 * Stations collapsed by name: Tujia lists an interchange once per line, each with its
 * own condition value, so "Kecun" appears twice. Merge them into one entry that knows
 * all its lines, and keep the first condition value so the result stays searchable.
 */
const STATIONS = (() => {
  const byName = new Map<
    string,
    { value: string; cn: string; en: string; lng: number; lat: number; lines: string[] }
  >();
  for (const s of ALL_STATIONS) {
    if (s.lng === 0 && s.lat === 0) continue; // line-level pseudo-entries ("全线")
    const existing = byName.get(s.en);
    if (existing) {
      if (!existing.lines.includes(s.line)) existing.lines.push(s.line);
    } else {
      byName.set(s.en, {
        value: s.value,
        cn: s.cn,
        en: s.en,
        lng: s.lng ?? 0,
        lat: s.lat ?? 0,
        lines: [s.line],
      });
    }
  }
  return [...byName.values()];
})();

/** Average walking speed, km/h — used to turn distance into a legible number. */
const WALK_KMH = 4.5;

export function findNearestMetro(lng?: number, lat?: number): NearestMetro | null {
  if (typeof lng !== 'number' || typeof lat !== 'number' || (lng === 0 && lat === 0)) return null;

  let best: (typeof STATIONS)[number] | null = null;
  let bestKm = Infinity;
  for (const station of STATIONS) {
    const d = haversineKm({ lng, lat }, station);
    if (d < bestKm) {
      bestKm = d;
      best = station;
    }
  }
  if (!best) return null;

  return {
    value: best.value,
    nameCn: best.cn,
    nameEn: best.en,
    // Numbered lines first, so "Lines 3 & 8" reads naturally.
    lines: [...best.lines].sort((a, b) => {
      const n = (s: string) => (s.match(/^Line (\d+)/) ? +s.match(/^Line (\d+)/)![1] : 999);
      return n(a) - n(b) || a.localeCompare(b);
    }),
    distanceKm: Math.round(bestKm * 100) / 100,
    walkMinutes: Math.max(1, Math.ceil((bestKm / WALK_KMH) * 60)),
  };
}
