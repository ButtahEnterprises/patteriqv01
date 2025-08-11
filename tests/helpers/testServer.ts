import http from 'http';
import { GET as healthGET } from '../../src/app/api/health/route';
import { GET as weeklySummaryGET } from '../../src/app/api/weekly-summary/route';
import { GET as trendGET } from '../../src/app/api/kpi/trend/route';
import { GET as storesAtRiskGET } from '../../src/app/api/stores-at-risk/route';
import { GET as storeTrendGET } from '../../src/app/api/stores/[storeId]/trend/route';
import { GET as skuBreakdownGET } from '../../src/app/api/stores/[storeId]/sku-breakdown/route';
import { GET as topProductsGET } from '../../src/app/api/leaderboards/top-products/route';
import { GET as topStoresGET } from '../../src/app/api/leaderboards/top-stores/route';
import { POST as ultaIngestPOST } from '../../src/app/api/ingest/ulta/route';

export type Handler = (req: Request) => Promise<Response> | Response;

const getRoutes: Record<string, Handler> = {
  '/api/health': healthGET,
  '/api/weekly-summary': weeklySummaryGET,
  '/api/kpi/trend': trendGET,
  '/api/stores-at-risk': storesAtRiskGET,
  '/api/leaderboards/top-products': topProductsGET,
  '/api/leaderboards/top-stores': topStoresGET,
};

const postRoutes: Record<string, Handler> = {
  '/api/ingest/ulta': ultaIngestPOST,
};

export function createServer(): http.Server {
  return http.createServer(async (nodeReq, nodeRes) => {
    try {
      const url = new URL(nodeReq.url || '/', 'http://localhost');
      const pathname = url.pathname;
      const method = nodeReq.method || 'GET';

      let handler: Handler | undefined;
      if (method === 'GET') {
        handler = getRoutes[pathname];
      } else if (method === 'POST') {
        handler = postRoutes[pathname];
      }
      // dynamic GET routes
      if (!handler && method === 'GET') {
        if (/^\/api\/stores\/\d+\/trend$/.test(pathname)) handler = storeTrendGET;
        else if (/^\/api\/stores\/\d+\/sku-breakdown$/.test(pathname)) handler = skuBreakdownGET;
      }
      if (!handler) {
        nodeRes.statusCode = 404;
        nodeRes.end('Not Found');
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of nodeReq as any) chunks.push(Buffer.from(chunk));
      const body = chunks.length ? Buffer.concat(chunks) : undefined;

      const headers = new Headers();
      for (const [k, v] of Object.entries(nodeReq.headers)) {
        if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
        else if (v != null) headers.set(k, String(v));
      }

      const req = new Request(url.toString(), { method, headers, body: body as any });
      const res = await handler(req);

      nodeRes.statusCode = (res as any).status ?? 200;
      res.headers.forEach((val, key) => nodeRes.setHeader(key, val));
      const buf = Buffer.from(await res.arrayBuffer());
      nodeRes.end(buf);
    } catch (e: any) {
      nodeRes.statusCode = 500;
      nodeRes.end(e?.message || String(e));
    }
  });
}
