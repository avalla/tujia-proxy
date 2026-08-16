import NodeCache from 'node-cache';
import { Request, Response, NextFunction } from 'express';

const cache = new NodeCache({ stdTTL: 300 });

export function getCache(key: string): any | undefined {
  return cache.get(key);
}

export function setCache(key: string, value: any): void {
  cache.set(key, value);
}

export function cacheMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.originalUrl + JSON.stringify(req.body);
  const cached = getCache(key);
  if (cached) {
    res.json({ ...cached, cached: true });
    return;
  }
  (res as any).sendResponse = res.json;
  res.json = (body: any): Response => {
    setCache(key, body);
    return (res as any).sendResponse(body);
  };
  next();
}
