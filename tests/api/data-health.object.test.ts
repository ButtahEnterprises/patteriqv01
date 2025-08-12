import { describe, it, expect, beforeAll } from 'vitest';
import { GET as getDataHealth } from '../../src/app/api/data-health/route';

function req(url: string, cookieDemo = true) {
  const headers = new Headers();
  if (cookieDemo) headers.set('cookie', `piq_demo_mode=true`);
  return new Request(url, { headers });
}

describe('GET /api/data-health (object response with issues, demo)', () => {
  beforeAll(() => {
    process.env.DEMO_MODE = 'true';
    process.env.USE_DB = 'false';
  });

  it('returns { data, issues } when includeIssues=1', async () => {
    const res = await getDataHealth(req('http://test.local/api/data-health?weeks=4&includeIssues=1'));
    expect(res.ok).toBe(true);
    const ct = res.headers.get('content-type') || '';
    expect(ct.includes('application/json')).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(Array.isArray(body.issues)).toBe(true);
    if (body.data.length > 0) {
      const r = body.data[0];
      expect(r).toHaveProperty('isoWeek');
      expect(r).toHaveProperty('pctFullAllocated');
    }
  });
});
