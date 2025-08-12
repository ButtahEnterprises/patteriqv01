import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createServer } from '../helpers/testServer';
import prisma from '../../lib/prisma';
import { GET as getWeeks } from '../../src/app/api/weeks/route';
import { mondayOfISOWeek, toISOWeekKey, addWeeksUTC, parseIsoWeek } from '../../src/lib/week';

const HAS_DB = !!process.env.DATABASE_URL;

function req(url: string, cookieDemo = false) {
  const headers = new Headers();
  if (cookieDemo) headers.set('cookie', `piq_demo_mode=true`);
  return new Request(url, { headers });
}

(HAS_DB ? describe : describe.skip)('GET /api/weeks filters out future weeks', () => {
  let server: ReturnType<typeof createServer> | undefined;

  beforeAll(async () => {
    process.env.DEMO_MODE = 'false';
    process.env.USE_DB = 'true';
    server = createServer();
    await new Promise<void>((resolve) => server!.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  });

  it('does not include future week rows', async () => {
    const now = new Date();

    // Base off the current ISO week to avoid flakiness around calendar year boundaries
    const currIso = toISOWeekKey(now);
    const currParsed = parseIsoWeek(currIso)!;
    const currMonday = mondayOfISOWeek(currParsed.year, currParsed.week);

    // Create a past week ~10 weeks ago (relative to current ISO week)
    const pastMonday = addWeeksUTC(currMonday, -10);
    const pastIso = toISOWeekKey(pastMonday);
    await prisma.week.upsert({
      where: { iso: pastIso },
      update: {},
      create: {
        iso: pastIso,
        year: pastMonday.getUTCFullYear(),
        startDate: pastMonday,
        endDate: addWeeksUTC(pastMonday, 1),
      },
    });

    // Create a future week ~10 weeks ahead (relative to current ISO week)
    const futMonday = addWeeksUTC(currMonday, 10);
    const futIso = toISOWeekKey(futMonday);
    await prisma.week.upsert({
      where: { iso: futIso },
      update: {},
      create: {
        iso: futIso,
        year: futMonday.getUTCFullYear(),
        startDate: futMonday,
        endDate: addWeeksUTC(futMonday, 1),
      },
    });

    const res = await getWeeks(req('http://test.local/api/weeks'));
    expect(res.ok).toBe(true);
    const body = await res.json();
    const weeks: Array<{ iso: string; startDate: string } > = body.weeks || [];
    // Should not include any week whose startDate is in the future
    const futureIncluded = weeks.some(w => new Date(w.startDate).getTime() > now.getTime());
    expect(futureIncluded).toBe(false);
    // Should include the past week (unless truncated by take=20 and other pre-existing data)
    const includesPast = weeks.some(w => w.iso === pastIso);
    expect(includesPast).toBe(true);
    // Should exclude our future iso
    const includesFutureIso = weeks.some(w => w.iso === futIso);
    expect(includesFutureIso).toBe(false);
  });
});
