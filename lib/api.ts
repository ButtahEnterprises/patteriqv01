import { NextResponse } from 'next/server';
import { logger } from './log';

export type ApiHandler = (req: Request) => Promise<Response> | Response;

export function withApi(handler: ApiHandler): ApiHandler {
  return async (req: Request): Promise<Response> => {
    const rid = req.headers?.get('x-request-id') ?? (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const started = Date.now();

    try {
      const res = await handler(req);
      // attach diagnostics
      try {
        res.headers.set('x-request-id', rid);
        res.headers.set('x-response-time-ms', String(Date.now() - started));
      } catch {}
      logger.info('API success', { rid, url: req.url, ms: Date.now() - started });
      return res;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error('API error', { rid, url: req.url, ms: Date.now() - started, err: errMsg });
      return NextResponse.json(
        { ok: false, error: errMsg },
        {
          status: 500,
          headers: {
            'x-request-id': rid,
            'x-response-time-ms': String(Date.now() - started),
          },
        },
      );
    }
  };
}
