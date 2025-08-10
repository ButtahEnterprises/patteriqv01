import 'dotenv/config';
import prisma from '../lib/prisma';
import { PSEUDO_UPC } from '../lib/constants';

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

async function main() {
  const asCsv = process.argv.includes('--csv');

  // Find all weeks that actually have SalesFact rows
  const weeks = await prisma.week.findMany({
    where: { sales: { some: {} } },
    select: { id: true, iso: true, startDate: true },
    orderBy: { startDate: 'asc' },
  });

  if (!weeks.length) {
    console.log('No SalesFact data found.');
    return;
  }

  type Row = { week: string; totalStores: number; pseudoStores: number; pctFullyAllocated: number };
  const rows: Row[] = [];

  for (const w of weeks) {
    // Distinct stores with any sales in this week
    const totalStores = (
      await prisma.salesFact.findMany({
        where: { weekId: w.id },
        distinct: ['storeId'],
        select: { storeId: true },
      })
    ).length;

    // Distinct stores that used pseudo-SKU fallback (Sku.upc === 'ALL') for this week
    const pseudoStores = (
      await prisma.salesFact.findMany({
        where: { weekId: w.id, sku: { upc: PSEUDO_UPC } },
        distinct: ['storeId'],
        select: { storeId: true },
      })
    ).length;

    const fully = Math.max(0, totalStores - pseudoStores);
    const pct = totalStores > 0 ? (fully / totalStores) * 100 : 0;

    rows.push({ week: w.iso, totalStores, pseudoStores, pctFullyAllocated: pct });
  }

  if (asCsv) {
    console.log('week,total_stores,pseudo_sku_stores,pct_fully_allocated');
    for (const r of rows) {
      console.log(`${r.week},${r.totalStores},${r.pseudoStores},${r.pctFullyAllocated.toFixed(1)}`);
    }
  } else {
    // Simple table output
    const headers = ['Week', 'Total Stores', 'Pseudo-SKU Stores', '% Fully Allocated'];
    const col1 = Math.max(headers[0].length, ...rows.map((r) => r.week.length));
    const col2 = Math.max(headers[1].length, ...rows.map((r) => String(r.totalStores).length));
    const col3 = Math.max(headers[2].length, ...rows.map((r) => String(r.pseudoStores).length));
    const col4 = Math.max(headers[3].length, ...rows.map((r) => fmtPct(r.pctFullyAllocated).length));

    const pad = (s: string, w: number) => s.padEnd(w, ' ');
    const line = (a: string, b: string, c: string, d: string) =>
      `${pad(a, col1)}  ${pad(b, col2)}  ${pad(c, col3)}  ${pad(d, col4)}`;

    console.log(line(headers[0], headers[1], headers[2], headers[3]));
    console.log('-'.repeat(col1 + col2 + col3 + col4 + 6));
    for (const r of rows) {
      console.log(line(r.week, String(r.totalStores), String(r.pseudoStores), fmtPct(r.pctFullyAllocated)));
    }
  }
}

(async () => {
  try {
    await main();
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
})();
