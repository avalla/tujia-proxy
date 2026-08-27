/**
 * All Tujia coordinates are Baidu bd09ll (`geoCoordSysType: "bd09ll"` on every unit).
 * We never convert to WGS84 — we only ever measure Tujia points against other Tujia
 * points, so staying inside bd09 keeps the datum consistent and the error at zero.
 *
 * Reference points are Tujia's own, lifted from the `conditions/fetch` taxonomy into
 * `src/catalog/cities.ts`, so they are bd09 by construction.
 *
 * Everything here is city-scoped: Guangzhou's 400-odd stations and Shenzhen's are
 * separate networks, and measuring a Shenzhen unit against Guangzhou's catalog would
 * report a "nearest station" 100 km away rather than none.
 */

import { allStations, type Landmark } from '../catalog';

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

/**
 * Straight-line distance to a city's chosen anchor (the Canton Fair complex, the
 * Shenzhen World convention centre, …), in km. Null when either point is unknown.
 */
export function distanceToLandmarkKm(
  landmark: Landmark | null | undefined,
  lng?: number,
  lat?: number
): number | null {
  if (!landmark) return null;
  if (typeof lng !== 'number' || typeof lat !== 'number' || (lng === 0 && lat === 0)) {
    return null;
  }
  return Math.round(haversineKm({ lng, lat }, landmark) * 10) / 10;
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

interface IndexedStation {
  value: string;
  cn: string;
  en: string;
  lng: number;
  lat: number;
  lines: string[];
}

/**
 * Stations collapsed by name, per city: Tujia lists an interchange once per line, each
 * with its own condition value, so "Kecun" appears twice. Merge them into one entry
 * that knows all its lines, and keep the first condition value so the result stays
 * searchable. Built lazily and memoized — a city nobody searches costs nothing.
 */
const STATION_INDEX = new Map<string, IndexedStation[]>();

function stationsFor(cityId: string): IndexedStation[] {
  const cached = STATION_INDEX.get(cityId);
  if (cached) return cached;

  const byName = new Map<string, IndexedStation>();
  for (const s of allStations(cityId)) {
    if (!s.lng || !s.lat) continue; // line-level pseudo-entries ("全线")
    const existing = byName.get(s.en);
    if (existing) {
      if (!existing.lines.includes(s.line)) existing.lines.push(s.line);
    } else {
      byName.set(s.en, {
        value: s.value,
        cn: s.cn,
        en: s.en,
        lng: s.lng,
        lat: s.lat,
        lines: [s.line],
      });
    }
  }

  const list = [...byName.values()];
  STATION_INDEX.set(cityId, list);
  return list;
}

/** Average walking speed, km/h — used to turn distance into a legible number. */
const WALK_KMH = 4.5;

export function findNearestMetro(
  cityId: string,
  lng?: number,
  lat?: number
): NearestMetro | null {
  if (typeof lng !== 'number' || typeof lat !== 'number' || (lng === 0 && lat === 0)) return null;

  const stations = stationsFor(cityId);
  if (!stations.length) return null; // city with no metro, or catalog not generated yet

  let best: IndexedStation | null = null;
  let bestKm = Infinity;
  for (const station of stations) {
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
