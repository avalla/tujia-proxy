import express from 'express';
import cors from 'cors';
import path from 'path';
import { CONFIG } from './config';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import citiesRouter from './routes/cities';
import searchRouter from './routes/search';
import detailRouter from './routes/detail';
import filtersRouter from './routes/filters';
import { startSessionRefresh } from './services/sessionMinter';

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/v1/cities', citiesRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/hotel', detailRouter);
  app.use('/api/v1/filters', filtersRouter);
  app.use('/api', healthRouter);

  // The English UI. Served last so /api/* always wins.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(errorHandler);
  return app;
}

export function startServer() {
  const app = createServer();
  app.listen(CONFIG.PORT, CONFIG.HOST, () => {
    console.log(`🚀 Tujia Proxy EN on http://${CONFIG.HOST}:${CONFIG.PORT}`);

    // Tujia sessions expire after a few hours, and there is no way to renew one
    // except by loading the site again — so the server does that for itself rather
    // than leaving search to fail until someone runs `bun run session` by hand.
    const minutes = CONFIG.SESSION_REFRESH_MINUTES;
    if (minutes > 0) {
      console.log(`[session] auto-refresh every ${minutes} min (TUJIA_SESSION_REFRESH_MINUTES=0 to disable)`);
      startSessionRefresh(minutes * 60_000);
    } else {
      console.log('[session] auto-refresh disabled');
    }
  });
}
