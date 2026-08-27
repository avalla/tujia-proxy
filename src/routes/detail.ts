import { Router, Request, Response } from 'express';
import { TujiaClient } from '../services/tujiaClient';
import { mapDetailToEnglish } from '../services/detailMapper';
import { getCache, setCache } from '../middleware/cache';
import { CONFIG } from '../config';

const router = Router();
const client = new TujiaClient();

/**
 * Full listing detail, translated.
 *
 * Dates are optional but meaningful: Tujia computes the price and the cancellation
 * timeline for the requested stay, so passing them keeps the page consistent with
 * whatever the search showed.
 */
router.get('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!/^\d+$/.test(id)) {
    res.status(400).json({ error: 'Invalid listing id', message: 'Expected a numeric unit id.' });
    return;
  }

  const checkIn = typeof req.query.checkIn === 'string' ? req.query.checkIn : '';
  const checkOut = typeof req.query.checkOut === 'string' ? req.query.checkOut : '';
  const guests = Number(req.query.guests) || 1;
  // Both optional: the mapper resolves the city from the payload's own cityName and
  // falls back to these only when it names something we do not support.
  const cityId = typeof req.query.city === 'string' ? req.query.city : undefined;
  const landmarkKey = typeof req.query.landmark === 'string' ? req.query.landmark : undefined;

  const cacheKey = `detail:${id}:${checkIn}:${checkOut}:${guests}:${cityId ?? ''}:${landmarkKey ?? ''}`;
  const cached = getCache(cacheKey);
  if (cached) {
    res.json({ ...cached, cached: true });
    return;
  }

  try {
    const raw = await client.detail(id, { checkIn, checkOut, guests });
    if (!raw?.data?.houseId && !raw?.data?.currentHouse) {
      res.status(404).json({ error: 'Listing not found', message: `No detail for unit ${id}.` });
      return;
    }

    const hotel = mapDetailToEnglish(raw, id, { cityId, landmarkKey });
    setCache(cacheKey, hotel);
    res.json({ ...hotel, cached: false });
  } catch (err: any) {
    const status = err.status || 502;
    const missingSession = err.name === 'MissingCookiesError';
    console.error('Detail error:', err.response?.data || err.message);
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
