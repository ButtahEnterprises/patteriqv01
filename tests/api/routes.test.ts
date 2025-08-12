import { describe, it, expect, beforeAll } from 'vitest';
import { GET as getConfig } from '../../src/app/api/config/route';
import { GET as getWeekly } from '../../src/app/api/weekly-summary/route';
import { GET as getTrend } from '../../src/app/api/kpi/trend/route';
import { GET as getRisk } from '../../src/app/api/stores-at-risk/route';
import { GET as getDataHealth } from '../../src/app/api/data-health/route';
import { GET as getPromotions } from '../../src/app/api/promotions/route';
import { GET as getPromoAttribution } from '../../src/app/api/promo-attribution/route';

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

  it('/api/promo-attribution returns array of attribution items (demo and non-demo cookie)', async () => {
    const url = 'http://test.local/api/promo-attribution?years=2024,2025&baselineWeeks=4';
    const requests = [req(url, true), req(url, false)];
    for (const r of requests) {
      const res = await getPromoAttribution(r);
      expect(res.ok).toBe(true);
      const ct = res.headers.get('content-type') || '';
      expect(ct.includes('application/json')).toBe(true);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        const item = body[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('startDate');
        expect(item).toHaveProperty('endDate');
        expect(item).toHaveProperty('metrics');
        expect(typeof item.metrics.baselineAvg).toBe('number');
        expect(typeof item.metrics.promoAvg).toBe('number');
        expect(typeof item.metrics.effectPct).toBe('number');
        expect(item).toHaveProperty('deltaRevenue');
        expect(typeof item.deltaRevenue).toBe('number');
        expect(item).toHaveProperty('targetSkuCount');
        expect(typeof item.targetSkuCount).toBe('number');
        expect(item).toHaveProperty('halo');
        expect(typeof item.halo.nonTargetEffectPct).toBe('number');
        expect(item).toHaveProperty('weeks');
        expect(Array.isArray(item.weeks)).toBe(true);
        if (item.weeks.length > 0) {
          expect(typeof item.weeks[0].isoWeek).toBe('string');
          expect(typeof item.weeks[0].revenue).toBe('number');
        }
      }
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
