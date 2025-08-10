import prisma from '../prisma';
import { startOfISOWeek, endOfISOWeek, getISOWeek, getISOWeekYear } from 'date-fns';

export type NormalizedRow = {
  weekEndDate: Date;          // Derived from filename (e.g., 2025-01-05)
  storeCode: string;          // For step 1 we’ll use 'ULTA-ALL'
  storeName?: string;
  upc: string;
  skuName?: string;
  units: number;
  revenue: number;
};

export function isoFromDate(d: Date): string {
  const year = getISOWeekYear(d);
  const wk = getISOWeek(d);
  return `${year}-W${String(wk).padStart(2, '0')}`;
}

export async function ensureWeek(weekEndDate: Date) {
  const iso = isoFromDate(weekEndDate);
  const startDate = startOfISOWeek(weekEndDate);
  const endDate = endOfISOWeek(weekEndDate);
  return prisma.week.upsert({
    where: { iso },
    update: {},
    create: {
      iso,
      year: startDate.getUTCFullYear(),
      startDate,
      endDate,
    },
  });
}

export async function ensureStore(code: string, name?: string, city?: string, state?: string) {
  return prisma.store.upsert({
    where: { code },
    update: {},
    create: { code, name: name ?? code, city: city ?? null, state: state ?? null },
  });
}

export async function ensureSku(upc: string, name?: string) {
  const existing = await prisma.sku.findFirst({ where: { upc } });
  if (existing) return existing;
  return prisma.sku.create({ data: { upc, name: name ?? upc } });
}

export async function insertSalesFacts(rows: NormalizedRow[]) {
  if (!rows.length) return { inserted: 0 };

  // Group by ISO week to avoid recomputing
  const byIso = new Map<string, NormalizedRow[]>();
  for (const r of rows) {
    const iso = isoFromDate(r.weekEndDate);
    if (!byIso.has(iso)) byIso.set(iso, []);
    byIso.get(iso)!.push(r);
  }

  let inserted = 0;

  for (const batch of byIso.values()) {
    const weekEndDate = batch[0].weekEndDate;
    const week = await ensureWeek(weekEndDate);

    // Ensure all stores and skus first, cache IDs
    const storeMap = new Map<string, number>(); // code -> id
    const skuMap = new Map<string, number>();   // upc -> id
    for (const r of batch) {
      if (!storeMap.has(r.storeCode)) {
        const s = await ensureStore(r.storeCode, r.storeName);
        storeMap.set(r.storeCode, s.id);
      }
      if (!skuMap.has(r.upc)) {
        const s = await ensureSku(r.upc, r.skuName);
        skuMap.set(r.upc, s.id);
      }
    }

    // Load existing pairs for this week to make operation idempotent
    const existing = await prisma.salesFact.findMany({
      where: { weekId: week.id },
      select: { storeId: true, skuId: true },
    });
    const seen = new Set(existing.map((e) => `${e.storeId}:${e.skuId}`));

    for (const r of batch) {
      const storeId = storeMap.get(r.storeCode)!;
      const skuId = skuMap.get(r.upc)!;
      const key = `${storeId}:${skuId}`;
      if (seen.has(key)) continue; // skip duplicates

      await prisma.salesFact.create({
        data: {
          units: Number.isFinite(r.units) ? r.units : 0,
          revenue: Number.isFinite(r.revenue) ? r.revenue : 0,
          week:  { connect: { id: week.id } },
          store: { connect: { id: storeId } },
          sku:   { connect: { id: skuId } },
        },
      });
      seen.add(key);
      inserted++;
    }
  }
  return { inserted };
}