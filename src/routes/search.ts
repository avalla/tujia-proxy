import { Router, Request, Response } from 'express';
import { TujiaClient } from '../services/tujiaClient';
import { mapToEnglish, mapContext } from '../services/mapper';
import { SearchRequest, SearchResponse, HotelEn } from '../types';
import { getCache, setCache } from '../middleware/cache';
import { CONFIG } from '../config';
import { findCity, CITIES, DEFAULT_CITY_ID, hasCatalog } from '../catalog';

const router = Router();
const client = new TujiaClient();

/** Default stay when the caller sends no dates: today → today + 7 nights. */
function defaultStay(): { checkIn: string; checkOut: string } {
  const iso = (d: Date) => d.toLocaleDateString('sv');
  const today = new Date();
  const out = new Date(today);
  out.setDate(out.getDate() + 7);
  return { checkIn: iso(today), checkOut: iso(out) };
}

router.post('/', async (req: Request, res: Response) => {
  // An unknown cityId is rejected rather than silently searched: Tujia would happily
  // answer for a city we have no metro catalog or district vocabulary for, and every
  // result would come back with a null nearest-station and untranslated districts.
  const city = findCity(req.body.cityId ?? DEFAULT_CITY_ID);
  if (!city || !hasCatalog(city.id)) {
    res.status(400).json({
      error: 'Unsupported city',
      message: `No catalog for city "${req.body.cityId}".`,
      supported: CITIES.filter((c) => hasCatalog(c.id)).map((c) => ({ id: c.id, name: c.name })),
    });
    return;
  }

  const params: SearchRequest = {
    cityId: city.id,
    checkIn: req.body.checkIn || defaultStay().checkIn,
    checkOut: req.body.checkOut || defaultStay().checkOut,
    pageIndex: req.body.pageIndex ?? 0,
    pageSize: req.body.pageSize ?? 10,
    priceMin: req.body.priceMin || 0,
    priceMax: req.body.priceMax || 300,
    district: req.body.district,
    roomCount: req.body.roomCount || 1,
    guestCount: req.body.guestCount || 2,
    bedrooms: Number(req.body.bedrooms) || undefined,
    amenities: Array.isArray(req.body.amenities) ? req.body.amenities.map(String) : [],
    sort: req.body.sort || '1',
    acceptForeigners: req.body.acceptForeigners ?? false,
    nearMetro: req.body.nearMetro ?? false,
    freeParking: req.body.freeParking ?? false,
    // `maxDistanceToFairKm` is the pre-multi-city spelling, still accepted so older
    // callers and the curl probes in test-*.sh keep working.
    maxDistanceToLandmarkKm: req.body.maxDistanceToLandmarkKm ?? req.body.maxDistanceToFairKm,
    landmarkKey: req.body.landmarkKey,
    metroStationId: req.body.metroStationId,
    metroStationName: req.body.metroStationName,
    metroLng: req.body.metroLng,
    metroLat: req.body.metroLat,
    metroLineId: req.body.metroLineId,
    maxDistanceToMetroLineKm: req.body.maxDistanceToMetroLineKm,
  };

  const cacheKey = JSON.stringify(params);
  const cached = getCache(cacheKey);
  if (cached) {
    res.json({ ...cached, cached: true });
    return;
  }

  // Two filters Tujia has no condition for, so both can only be applied after mapping:
  // distance to a landmark, and distance to the filtered metro line. (Tujia's own line
  // filter is generous — it returns places 4 km out — so tightening it is a real need.)
  // Filtering a single 10-unit page would discard almost everything, so when either is
  // active we walk pages until the page is full or the budget runs out.
  const ctx = mapContext(params.cityId, params.landmarkKey, params.metroLineId);
  const landmarkKm = ctx.landmark ? params.maxDistanceToLandmarkKm : undefined;
  // Only meaningful with a line filter; `metroStationId` beats `metroLineId` upstream,
  // so ctx.line is null in that case and this correctly falls away.
  const lineKm = ctx.line ? params.maxDistanceToMetroLineKm : undefined;

  const keep = (h: HotelEn): boolean => {
    if (landmarkKm !== undefined) {
      const d = h.location.distanceToLandmarkKm;
      if (d === null || d > landmarkKm) return false;
    }
    if (lineKm !== undefined) {
      const d = h.location.nearestOnLine?.distanceKm;
      if (d === undefined || d > lineKm) return false;
    }
    return true;
  };

  const wantsLocalFilter = landmarkKm !== undefined || lineKm !== undefined;
  const pageSize = params.pageSize ?? 10;

  /**
   * How the local-filter page walk is paced, all three numbers measured rather than
   * guessed. An anonymous session is the constraint:
   *
   *   - it answers three back-to-back searches, then fails the fourth with 55004
   *     ("not logged in") — the burst is what breaks it, not the session age;
   *   - it tolerates `pageSize` up to 20, but refuses 30 outright;
   *   - at ~2.5 s apart, four requests in a row are fine.
   *
   * So: ask for twice as much per request and make fewer of them. Five pages of 20
   * scans 100 units where the old eight-of-ten scanned 80, in three fewer round trips.
   */
  const UPSTREAM_PAGE_SIZE = wantsLocalFilter ? Math.max(pageSize, 20) : pageSize;
  const MAX_PAGES = 5;
  const PAGE_GAP_MS = 1500;
  const nap = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    const kept: HotelEn[] = [];
    let totalAvailable: number | null = null;
    let bookableCount: number | null = null;
    let pagesScanned = 0;
    let scanned = 0;
    let exhausted = false;

    const firstPage = params.pageIndex ?? 0;
    let page = firstPage;

    for (; pagesScanned < (wantsLocalFilter ? MAX_PAGES : 1); page++) {
      if (pagesScanned) await nap(PAGE_GAP_MS);

      let raw: any;
      try {
        raw = await client.search({ ...params, pageIndex: page, pageSize: UPSTREAM_PAGE_SIZE });
      } catch (err) {
        // A page that fails *mid-walk* should not throw away the results already
        // collected — return them and leave hasMore true so the client can retry from
        // the cursor. Only a failure on the very first page is a failed search.
        if (pagesScanned === 0) throw err;
        console.warn(`[search] page ${page} failed mid-walk, returning ${kept.length} kept:`, (err as any).message);
        break;
      }
      pagesScanned++;

      // Listings live in `data.items` on search/v2/searchhouse/bnb.
      const items = Array.isArray(raw.data?.items) ? raw.data.items : [];
      if (totalAvailable === null) totalAvailable = raw.data?.totalCount ?? null;
      if (bookableCount === null) bookableCount = raw.data?.canBookCount ?? null;
      scanned += items.length;

      // The amenity/price/metro filters are already applied server-side by the
      // `conditions` payload, so we do NOT re-filter on them here — the tag vocabulary
      // in the response differs from the filter vocabulary and would wrongly drop rows.
      const mapped: HotelEn[] = items.map((item: any) => mapToEnglish(item, ctx));
      kept.push(...(wantsLocalFilter ? mapped.filter(keep) : mapped));

      // Compare against what we actually asked upstream for, not the client's page
      // size — a short page is the only signal that Tujia has run out.
      if (items.length < UPSTREAM_PAGE_SIZE) {
        exhausted = true;
        page++;
        break;
      }
      if (kept.length >= pageSize) {
        page++;
        break;
      }
    }

    const results = kept.slice(0, pageSize);

    const response: SearchResponse = {
      query: params,
      results,
      total: results.length,
      totalAvailable,
      bookableCount,
      // Where a follow-up request should resume. With the fair filter the server walks
      // several upstream pages per response, so the client cannot just do pageIndex + 1.
      nextPageIndex: exhausted ? null : page,
      // Keyed on upstream exhaustion, NOT on whether this response kept anything: a
      // local-filter scan can burn its page budget in a sparse stretch and keep zero
      // while plenty remains further on. Saying "that's all" there would be wrong.
      hasMore: !exhausted,
      scanned: wantsLocalFilter ? scanned : undefined,
      pagesScanned: wantsLocalFilter ? pagesScanned : undefined,
      cached: false,
      city: { id: city.id, name: city.name, nameCn: city.nameCn },
      landmark: ctx.landmark && { key: ctx.landmark.key, name: ctx.landmark.name },
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (err: any) {
    const status = err.status || 502;
    const missingSession = err.name === 'MissingCookiesError';
    console.error('Search error:', err.response?.data || err.message);
    res.status(status).json({
      error: missingSession
        ? 'No Tujia session'
        : status === 401
          ? 'Tujia session expired'
          : 'Tujia API error',
      message: err.message,
      ...(status === 401 &&
        !missingSession && {
          hint: `Refresh the cookies in ${CONFIG.COOKIES_FILE} — the saved session has expired.`,
        }),
    });
  }
});

export default router;
