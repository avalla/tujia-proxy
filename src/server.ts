import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
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
  const publicDir = path.join(__dirname, '..', 'public');
  app.get(['/', '/index.html', '/listing.html'], (req, res, next) => {
    const file = path.join(publicDir, req.path === '/' ? 'index.html' : req.path);
    stampAssets(file, publicDir).then((html) => {
      // The page must always be fresh: it is what names the asset versions.
      res.set('Cache-Control', 'no-cache').type('html').send(html);
    }, next);
  });
  app.use(express.static(publicDir));

  app.use(errorHandler);
  return app;
}

/**
 * Append `?v=<mtime>` to every local .css/.js a page references.
 *
 * Cloudflare gives static assets a 4-hour browser TTL whatever the origin says, so
 * after a deploy browsers paired the new HTML with the old app.js — which then threw
 * on an element that no longer existed and left the page dead. A URL that changes
 * with the file sidesteps every cache in the path.
 */
async function stampAssets(file: string, publicDir: string): Promise<string> {
  const html = await fs.readFile(file, 'utf8');
  const refs = [...new Set([...html.matchAll(/(?:href|src)="\/([\w.-]+\.(?:css|js))"/g)].map((m) => m[1]))];
  let out = html;
  for (const ref of refs) {
    const { mtimeMs } = await fs.stat(path.join(publicDir, ref));
    out = out.replaceAll(`"/${ref}"`, `"/${ref}?v=${Math.floor(mtimeMs).toString(36)}"`);
  }
  return out;
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
