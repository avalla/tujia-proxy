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
  app.listen(CONFIG.PORT, () => {
    console.log(`🚀 Tujia Proxy EN on http://localhost:${CONFIG.PORT}`);
  });
}
