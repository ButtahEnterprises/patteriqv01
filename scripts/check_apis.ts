import 'dotenv/config';
import prisma from '../lib/prisma';
import { GET as trendGET } from '../src/app/api/kpi/trend/route';
import { GET as storesAtRiskGET } from '../src/app/api/stores-at-risk/route';

type TrendItem = { isoWeek: string; revenue: number; units: number };
type StoreRiskItem = {
  storeId: number;
  storeName: string;
  zScore: number;
  pctChange: number;
  topSkuCount: number;
};

const DEMO_COOKIE = 'piq_demo_mode';

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function assertTrendArray(data: unknown): asserts data is TrendItem[] {
  if (!Array.isArray(data)) {
    throw new Error('Trend response is not an array');
  }
  for (let i = 0; i < data.length; i++) {
    const it = data[i] as any;
    if (!it || typeof it.isoWeek !== 'string' || !isFiniteNumber(it.revenue) || !isFiniteNumber(it.units)) {
      throw new Error(`Trend item[${i}] has invalid shape: ${JSON.stringify(it)}`);
    }
  }
}

function assertStoresArray(data: unknown): asserts data is StoreRiskItem[] {
  if (!Array.isArray(data)) {
    throw new Error('Stores-at-risk response is not an array');
  }
  for (let i = 0; i < data.length; i++) {
    const it = data[i] as any;
    if (
      !it ||
      !isFiniteNumber(it.storeId) ||
      typeof it.storeName !== 'string' ||
      !isFiniteNumber(it.zScore) ||
      !isFiniteNumber(it.pctChange) ||
      !isFiniteNumber(it.topSkuCount)
    ) {
      throw new Error(`Stores item[${i}] has invalid shape: ${JSON.stringify(it)}`);
    }
  }
}

async function callApi(
  handler: (req: Request) => Promise<Response> | Response,
  path: string,
  cookies?: Record<string, string>,
) {
  const headers = new Headers();
  if (cookies && Object.keys(cookies).length) {
    headers.set(
      'Cookie',
      Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    );
  }
  const req = new Request(`http://localhost${path}`, { headers });
  const res = await handler(req);
  try {
    return await res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse JSON from ${path}: ${msg}`);
  }
}

async function runMode(label: 'Demo' | 'Live', cookieValue: 'true' | 'false') {
  const weeks = 12;
  const trendData = await callApi(trendGET, `/api/kpi/trend?weeks=${weeks}`, { [DEMO_COOKIE]: cookieValue });
  assertTrendArray(trendData);
  console.log(`[CHECK] Mode=${label} /api/kpi/trend?weeks=${weeks} → length=${trendData.length}`);
  console.log(trendData.slice(0, Math.min(2, trendData.length)));

  const lookback = 8;
  const limit = 10;
  const storesData = await callApi(
    storesAtRiskGET,
    `/api/stores-at-risk?lookback=${lookback}&limit=${limit}`,
    { [DEMO_COOKIE]: cookieValue },
  );
  assertStoresArray(storesData);
  console.log(
    `[CHECK] Mode=${label} /api/stores-at-risk?lookback=${lookback}&limit=${limit} → length=${storesData.length}`,
  );
  console.log(storesData.slice(0, Math.min(2, storesData.length)));
}

async function main() {
  try {
    await runMode('Demo', 'true');
    await runMode('Live', 'false');
    console.log('[CHECK] All validations passed.');
  } catch (err) {
    console.error('[ERROR]', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
