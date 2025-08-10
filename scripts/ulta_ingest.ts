import * as XLSX from 'xlsx';
import { z } from 'zod';
import { NormalizedRow } from '../lib/db/ingest_helpers';
import { parseUltaStoreSales, allocateStoreSalesToSkus } from '../lib/parsers/ulta_store_sales';
import type { PrismaClient, Prisma } from '@prisma/client';

const PARSER_VERSION = 'ulta-sales-perf v4';

function toNumber(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number' && isFinite(v)) return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : undefined;
}

function normCell(x: unknown): string {
  return String(x ?? '').replace(/\s+/g, ' ').trim();
}

function detectHeader(norm: string[]): { upc: number; name?: number; units?: number; dollars?: number } | null {
  const upcIdx = norm.findIndex((c) => c.toLowerCase() === 'upc');
  if (upcIdx < 0) return null;

  // Regex-based detection to tolerate punctuation / multi-line headers
  const reUnits = /sales\s*ty.*units|total\s*sales.*units|\bunits\b/i;
  const reDollars = /sales\s*ty.*\$\$?|total\s*sales.*\$\$?|net\s*sales/i;

  const nameIdx = norm.findIndex((c) => /ulta\s*item.*description/i.test(c));
  const unitsIdx = norm.findIndex((c) => reUnits.test(c));
  const dollarsIdx = norm.findIndex((c) => reDollars.test(c));

  if (unitsIdx >= 0 || dollarsIdx >= 0) {
    return { upc: upcIdx, name: nameIdx >= 0 ? nameIdx : undefined, units: unitsIdx >= 0 ? unitsIdx : undefined, dollars: dollarsIdx >= 0 ? dollarsIdx : undefined };
  }
  return null;
}

function findHeader(rows: unknown[][], sheetName: string): { idx: number; upc: number; name?: number; units?: number; dollars?: number } | null {
  const MAX_SCAN = Math.min(rows.length, 220);
  for (let r = 0; r < MAX_SCAN; r++) {
    const norm = (rows[r] || []).map(normCell);
    if (norm.every((c) => c === '')) continue;
    const hit = detectHeader(norm);
    if (hit) {
      console.log(`[DEBUG] ${PARSER_VERSION} header on "${sheetName}" row ${r}: upc=${hit.upc} name=${hit.name} units=${hit.units} dollars=${hit.dollars}`);
      return { idx: r, ...hit };
    }
  }
  // last resort: search a wide range for a row containing UPC and ULTA Item Description anywhere
  for (let r = 0; r < Math.min(rows.length, 300); r++) {
    const norm = (rows[r] || []).map(normCell);
    const upcIdx = norm.findIndex((c) => c.toLowerCase() === 'upc');
    const nameIdx = norm.findIndex((c) => /ulta\s*item.*description/i.test(c));
    if (upcIdx >= 0 && nameIdx >= 0) {
      console.log(`[DEBUG] ${PARSER_VERSION} fallback header on "${sheetName}" row ${r}`);
      return { idx: r, upc: upcIdx, name: nameIdx };
    }
  }
  return null;
}

const RowSchema = z.object({
  upc: z.string().min(6),
  units: z.number().optional(),
  revenue: z.number().optional(),
  skuName: z.string().optional(),
});

export function parseUltaSalesInvPerf(filePath: string, weekEndDate: Date): NormalizedRow[] {
  console.log(`[DEBUG] ${PARSER_VERSION} scanning: ${filePath}`);
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const prefer = ['Last Closed Week', 'Period to Date', 'Quarter to Date', 'Year to Date'];
  const sheetNames = [...prefer.filter((n) => wb.SheetNames.includes(n)), ...wb.SheetNames.filter((n) => !prefer.includes(n))];

  const out: NormalizedRow[] = [];

  for (const sheetName of sheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false, defval: '' });
    if (!rows || rows.length === 0) continue;

    const hdr = findHeader(rows, sheetName);
    if (!hdr) {
      console.log(`[DEBUG] ${PARSER_VERSION} no header on sheet "${sheetName}"`);
      continue;
    }

    for (let r = hdr.idx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const upcCell = normCell(row[hdr.upc]);
      if (!upcCell) continue;
      if (upcCell.toLowerCase().includes('overall result')) continue;

      const upc = upcCell.replace(/\D/g, '') || upcCell;
      if (!upc || upc.length < 6) continue;

      const skuName = hdr.name !== undefined ? normCell(row[hdr.name]) : undefined;
      const units = hdr.units !== undefined ? toNumber(row[hdr.units]) : undefined;
      const revenue = hdr.dollars !== undefined ? toNumber(row[hdr.dollars]) : undefined;

      const parsed = RowSchema.safeParse({ upc, units, revenue, skuName });
      if (!parsed.success) continue;

      out.push({
        weekEndDate,
        storeCode: 'ULTA-ALL',
        upc: parsed.data.upc,
        skuName: parsed.data.skuName,
        units: parsed.data.units ?? 0,
        revenue: parsed.data.revenue ?? 0,
      });
    }

    if (out.length > 0) break;
  }

  if (out.length === 0) {
    console.warn(`[WARN] ${PARSER_VERSION} could not find header in any sheet for ${filePath}`);
  }

  return out;
}

// -----------------------------
// CLI runner
// -----------------------------
async function main() {
  // load env
  await import('dotenv/config');

  const { default: fg } = await import('fast-glob');
  const path = await import('node:path');
  const prismaMod = await import('../lib/prisma');
  const prisma: PrismaClient = prismaMod.default as unknown as PrismaClient;
  const helpers: typeof import('../lib/db/ingest_helpers') = await import('../lib/db/ingest_helpers');

  const pattern = process.argv[2] || 'data/**/Store-Sales_*.xlsx';
  const files: string[] = await fg(pattern, { onlyFiles: true, absolute: true });
  if (!files.length) {
    console.log(`[INGEST] No files matched pattern: ${pattern}`);
    return;
  }

  console.log(`[INGEST] Found ${files.length} files. Starting…`);

  const insertedByIso = new Map<string, number>();
  const seenIso = new Set<string>();
  const missingAllocByIso = new Map<string, number>();

  function extractWeek(file: string): Date | null {
    const base = path.basename(file);
    // Accept optional trailing _<number> after the date (e.g., -2025-05-31_1.xlsx)
    const m = base.match(/-(\d{4}-\d{2}-\d{2})(?:_\d+)?\.xlsx$/i);
    if (!m) return null;
    const d = new Date(m[1]);
    return isNaN(+d) ? null : d;
  }

  for (const f of files) {
    const weekEndDate = extractWeek(f);
    if (!weekEndDate) {
      console.warn(`[WARN] Could not parse weekEndDate from filename: ${f}`);
      continue;
    }
    const iso = helpers.isoFromDate(weekEndDate);
    seenIso.add(iso);

    const base = path.basename(f);
    let rows: NormalizedRow[] = [];

    if (/Store-Sales_/i.test(base)) {
      // Parse per-store totals, then allocate to SKUs using the matching Sales_Inv_Perf workbook
      const storeTotals = parseUltaStoreSales(f, weekEndDate);
      let skuAllStores: NormalizedRow[] = [];
      const dir = path.dirname(f);
      // Extract date allowing optional _<number> suffix
      const m = base.match(/-(\d{4}-\d{2}-\d{2})(?:_\d+)?\.xlsx$/i);
      const dateStr = m ? m[1] : undefined;
      if (dateStr) {
        // Look for allocator workbook with or without a trailing suffix
        const perfPattern = path.join(dir, `Sales_Inv_Perf__*-${dateStr}*.xlsx`);
        const perfFiles: string[] = await fg(perfPattern, { onlyFiles: true, absolute: true });
        if (perfFiles.length) {
          skuAllStores = parseUltaSalesInvPerf(perfFiles[0], weekEndDate);
        } else {
          console.warn(`[WARN] No matching Sales_Inv_Perf workbook found for ${base}; allocating evenly across a single pseudo-SKU.`);
          // QA: track weeks missing allocation and include store count for visibility
          missingAllocByIso.set(iso, (missingAllocByIso.get(iso) || 0) + storeTotals.length);
        }
      }

      rows = allocateStoreSalesToSkus(storeTotals, skuAllStores);
    } else {
      // Skip non Store-Sales files (used only as allocators)
      continue;
    }

    const res = await helpers.insertSalesFacts(rows);
    insertedByIso.set(iso, (insertedByIso.get(iso) || 0) + res.inserted);
    console.log(`[INGEST] ${path.basename(f)} → rows: ${rows.length}, inserted: ${res.inserted}`);
  }

  // Confirm DB row counts per week
  const isoList = Array.from(seenIso);
  if (isoList.length) {
    type WeekSlim = { id: number; iso: string; startDate: Date };
    const weeks: WeekSlim[] = await prisma.week.findMany({ where: { iso: { in: isoList } }, select: { id: true, iso: true, startDate: true } });
    const byIso = new Map<string, WeekSlim>(weeks.map((w) => [w.iso, w]));
    const counts = await prisma.salesFact.groupBy({
      by: ['weekId'] as const,
      where: { weekId: { in: weeks.map((w) => w.id) } },
      orderBy: { weekId: 'asc' },
      _count: { _all: true },
    } satisfies Prisma.SalesFactGroupByArgs);
    const countByWeek = new Map<number, number>(counts.map((c) => [c.weekId, c._count._all]));

    const summary = isoList
      .map((iso) => ({ iso, start: byIso.get(iso)?.startDate, total: byIso.get(iso) ? (countByWeek.get(byIso.get(iso)!.id) || 0) : 0, inserted: insertedByIso.get(iso) || 0 }))
      .sort((a, b) => (a.start && b.start ? a.start.getTime() - b.start.getTime() : a.iso.localeCompare(b.iso)));

    console.log(`[INGEST] Per-week DB counts:`);
    for (const s of summary) {
      console.log(`  ${s.iso}: total=${s.total} (this run inserted=${s.inserted})`);
    }

    // Per-store row counts for verification (limit output)
    const perStore = await prisma.salesFact.groupBy({
      by: ['weekId', 'storeId'] as const,
      where: { weekId: { in: weeks.map((w) => w.id) } },
      orderBy: [{ weekId: 'asc' }, { storeId: 'asc' }],
      _count: { _all: true },
    } satisfies Prisma.SalesFactGroupByArgs);
    const storeIds = Array.from(new Set(perStore.map((g) => g.storeId)));
    type StoreSlim = { id: number; name: string | null; code: string };
    const stores: StoreSlim[] = await prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true, code: true } });
    const nameById = new Map<number, string>(stores.map((s) => [s.id, s.name || s.code]));

    console.log(`[INGEST] Per-store DB counts (first 15 per week):`);
    for (const s of summary) {
      const wk = byIso.get(s.iso);
      if (!wk) continue;
      const rowsForWeek = perStore.filter((g) => g.weekId === wk.id);
      console.log(`  ${s.iso}: distinctStores=${rowsForWeek.length}`);
      const toShow = rowsForWeek.slice(0, 15);
      for (const r of toShow) {
        console.log(`    ${nameById.get(r.storeId) || r.storeId}: ${r._count._all}`);
      }
      if (rowsForWeek.length > toShow.length) {
        console.log(`    …and ${rowsForWeek.length - toShow.length} more stores`);
      }
    }
  }

  // QA summary for missing allocator weeks
  if (missingAllocByIso.size > 0) {
    const items = Array.from(missingAllocByIso.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([iso, count]) => `${iso} (stores=${count})`);
    console.log(`[INGEST] Weeks missing Sales_Inv_Perf allocation: ${items.join(', ')}`);
  }

  console.log(`[INGEST] Done.`);
}

// Execute when run via tsx
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
  console.error(`[INGEST] Error:`, err);
  process.exit(1);
});
