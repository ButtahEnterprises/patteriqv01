import { describe, it, expect, beforeAll } from 'vitest';
import { GET as getConfig } from '../../src/app/api/config/route';
import { GET as getWeekly } from '../../src/app/api/weekly-summary/route';
import { GET as getTrend } from '../../src/app/api/kpi/trend/route';
import { GET as getRisk } from '../../src/app/api/stores-at-risk/route';
import { GET as getDataHealth } from '../../src/app/api/data-health/route';
import { GET as getPromotions } from '../../src/app/api/promotions/route';

function req(url: string, cookieDemo = true) {
  const headers = new Headers();
  if (cookieDemo) headers.set('cookie', `piq_demo_mode=true`);
  return new Request(url, { headers });
}

beforeAll(() => {
  // Force demo mode and disable DB for tests
  process.env.DEMO_MODE = 'true';
  process.env.USE_DB = 'false';
});

describe('API routes return JSON', () => {
  it('/api/config returns JSON with demoMode', async () => {
    const res = await getConfig(req('http://test.local/api/config'));
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type') || '').toContain('application/json');
    const body = await res.json();
    expect(typeof body.demoMode).toBe('boolean');
    expect(body).toHaveProperty('defaultTenant');
    expect(body).toHaveProperty('riskThreshold');
  });

  it('/api/weekly-summary returns summary JSON in demo', async () => {
    const res = await getWeekly(req('http://test.local/api/weekly-summary'));
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type') || '').toContain('application/json');
    const body = await res.json();
    expect(body).toHaveProperty('week');
    expect(body).toHaveProperty('tenant');
    expect(Array.isArray(body.kpis)).toBe(true);
    expect(body.kpis.length).toBe(4);
  });

  it('/api/kpi/trend returns array of points', async () => {
    const res = await getTrend(req('http://test.local/api/kpi/trend?weeks=12'));
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type') || '').toContain('application/json');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      const pt = body[0];
      expect(pt).toHaveProperty('isoWeek');
      expect(pt).toHaveProperty('revenue');
      expect(pt).toHaveProperty('units');
    }
  });

  it('/api/stores-at-risk returns array of stores', async () => {
    const res = await getRisk(req('http://test.local/api/stores-at-risk?lookback=8&limit=10'));
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type') || '').toContain('application/json');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      const s = body[0];
      expect(s).toHaveProperty('storeId');
      expect(s).toHaveProperty('storeName');
      expect(s).toHaveProperty('zScore');
      expect(s).toHaveProperty('pctChange');
      expect(s).toHaveProperty('topSkuCount');
    }
  });

  it('/api/data-health returns array of weekly health', async () => {
    const res = await getDataHealth(req('http://test.local/api/data-health?weeks=12'));
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type') || '').toContain('application/json');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      const r = body[0];
      expect(r).toHaveProperty('isoWeek');
      expect(r).toHaveProperty('totalStores');
      expect(r).toHaveProperty('pseudoStores');
      expect(r).toHaveProperty('pctFullAllocated');
    }
  });

  it('/api/promotions returns array of promotions', async () => {
    const res = await getPromotions(req('http://test.local/api/promotions?years=2024,2025'));
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type') || '').toContain('application/json');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      const p = body[0];
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('startDate');
      expect(p).toHaveProperty('endDate');
      expect(p).toHaveProperty('metrics');
      expect(p.metrics).toHaveProperty('baselineAvg');
      expect(p.metrics).toHaveProperty('promoAvg');
      expect(p.metrics).toHaveProperty('effectPct');
      expect(p).toHaveProperty('weeks');
      expect(Array.isArray(p.weeks)).toBe(true);
    }
  });
});
