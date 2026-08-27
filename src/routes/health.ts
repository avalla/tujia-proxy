import { Router } from 'express';
import { hasCookies, isAnonymous } from '../services/cookieJar';
import { CONFIG } from '../config';
import { CITIES, hasCatalog } from '../catalog';

const router = Router();

router.get('/', (_req, res) => {
  const session = hasCookies();
  const anon = session && isAnonymous();
  res.json({
    service: 'Tujia Proxy EN',
    version: '1.0.0',
    session: session ? (anon ? 'anonymous' : 'logged in') : 'MISSING',
    ...(session
      ? anon
        ? { note: 'Anonymous session: prices come back masked, so listings show a range.' }
        : {}
      : {
          hint: `No Tujia session at ${CONFIG.COOKIES_FILE}. Run \`bun run session\` to mint one.`,
        }),
    cities: CITIES.filter((c) => hasCatalog(c.id)).map((c) => `${c.name} (${c.id})`),
    endpoints: {
      cities: 'GET /api/v1/cities',
      filters: 'GET /api/v1/filters?city=<id|slug>',
      search: 'POST /api/v1/search',
      detail: 'GET /api/v1/hotel/:id?checkIn=&checkOut=&guests=&city=&landmark=',
    },
    ui: 'GET /',
  });
});

export default router;
