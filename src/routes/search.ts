import { Router, Request, Response } from 'express';
import { TujiaClient } from '../services/tujiaClient';
import { mapToEnglish } from '../services/mapper';
import { SearchRequest, SearchResponse, HotelEn } from '../types';
import { getCache, setCache } from '../middleware/cache';
import { CONFIG } from '../config';

const router = Router();
const client = new TujiaClient();

router.post('/', async (req: Request, res: Response) => {
  const params: SearchRequest = {
    cityId: req.body.cityId || '45',
    checkIn: req.body.checkIn || '2026-10-10',
    checkOut: req.body.checkOut || '2026-11-05',
    pageIndex: req.body.pageIndex ?? 0,
    pageSize: req.body.pageSize ?? 10,
    priceMin: req.body.priceMin || 0,
    priceMax: req.body.priceMax || 300,
    district: req.body.district,
    roomCount: req.body.roomCount || 1,
    guestCount: req.body.guestCount || 2,
    amenities: Array.isArray(req.body.amenities) ? req.body.amenities.map(String) : [],
    sort: req.body.sort || '1',
    acceptForeigners: req.body.acceptForeigners ?? false,
    nearMetro: req.body.nearMetro ?? false,
    freeParking: req.body.freeParking ?? false,
    maxDistanceToFairKm: req.body.maxDistanceToFairKm,
    metroStationId: req.body.metroStationId,
    metroStationName: req.body.metroStationName,
    metroLng: req.body.metroLng,
    metroLat: req.body.metroLat,
    metroLineId: req.body.metroLineId,
  };

  const cacheKey = JSON.stringify(params);
  const cached = getCache(cacheKey);
  if (cached) {
    res.json({ ...cached, cached: true });
    return;
  }

  // Tujia has no condition for "distance to the Canton Fair", so it can only be applied
  // after mapping. Filtering a single 10-unit page would discard almost everything, so
  // when that filter is active we walk pages until the page is full or the budget runs out.
  const wantsFairFilter = params.maxDistanceToFairKm !== undefined;
  const pageSize = params.pageSize ?? 10;
  const MAX_PAGES = 8;

  try {
    const kept: HotelEn[] = [];
    let totalAvailable: number | null = null;
    let bookableCount: number | null = null;
    let pagesScanned = 0;
    let scanned = 0;
    let exhausted = false;

    const firstPage = params.pageIndex ?? 0;
    let page = firstPage;

    for (; pagesScanned < (wantsFairFilter ? MAX_PAGES : 1); page++) {
      const raw = await client.search({ ...params, pageIndex: page });
      pagesScanned++;

      // Listings live in `data.items` on search/v2/searchhouse/bnb.
      const items = Array.isArray(raw.data?.items) ? raw.data.items : [];
      if (totalAvailable === null) totalAvailable = raw.data?.totalCount ?? null;
      if (bookableCount === null) bookableCount = raw.data?.canBookCount ?? null;
      scanned += items.length;

      // The amenity/price/metro filters are already applied server-side by the
      // `conditions` payload, so we do NOT re-filter on them here — the tag vocabulary
      // in the response differs from the filter vocabulary and would wrongly drop rows.
      const mapped: HotelEn[] = items.map(mapToEnglish);
      kept.push(
        ...(wantsFairFilter
          ? mapped.filter(
              (h) =>
                h.location.distanceToCantonFairKm !== null &&
                h.location.distanceToCantonFairKm <= params.maxDistanceToFairKm!
            )
          : mapped)
      );

      if (items.length < pageSize) {
        exhausted = true; // upstream ran out of listings
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
      scanned: wantsFairFilter ? scanned : undefined,
      pagesScanned: wantsFairFilter ? pagesScanned : undefined,
      cached: false,
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
