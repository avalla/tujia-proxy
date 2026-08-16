import { Router } from 'express';
import { hasCookies } from '../services/cookieJar';
import { CONFIG } from '../config';

const router = Router();

router.get('/', (_req, res) => {
  const session = hasCookies();
  res.json({
    service: 'Tujia Proxy EN',
    version: '1.0.0',
    session: session ? 'loaded' : 'MISSING',
    ...(session
      ? {}
      : {
          hint: `No Tujia session at ${CONFIG.COOKIES_FILE}. Copy cookies.example.txt to cookies.txt and fill it in.`,
        }),
    endpoints: {
      cities: 'GET /api/v1/cities',
      filters: 'GET /api/v1/filters',
      search: 'POST /api/v1/search',
      detail: 'GET /api/v1/hotel/:id (501 — not reverse-engineered yet)',
    },
    ui: 'GET /',
  });
});

export default router;
