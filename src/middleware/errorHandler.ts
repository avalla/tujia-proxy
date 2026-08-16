import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  res.status(err.status || 502).json({
    error: err.message || 'Internal error',
    code: err.code || 'UNKNOWN',
  });
}
