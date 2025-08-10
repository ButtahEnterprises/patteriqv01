import * as XLSX from 'xlsx';
import { z } from 'zod';
import { NormalizedRow } from '../db/ingest_helpers';

const HEADER_CANDIDATES = {
  upc: ['UPC', 'Upc', 'UPC Code', 'Item UPC'],
  units: ['Units Sold', 'Units', 'Sales Units'],
  revenue: ['Net Sales $', 'Retail $', 'Net Sales', 'Sales $', 'Sales'],
  skuName: ['Description', 'Item Description', 'Product Name'],
};

function findHeaderIndex(rows: unknown[][]): { idx: number, map: Record<string, number> } | null {
  // scan first 50 rows for a header that contains at least UPC + one metric
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const row = rows[i]?.map((v) => String(v ?? '').trim());
    if (!row || row.every((c) => c === '')) continue;

    const map: Record<string, number> = {};
    const getIndex = (candidates: string[]) => {
      const lc = row.map((c) => c.toLowerCase());
      for (const cand of candidates) {
        const j = lc.indexOf(cand.toLowerCase());
        if (j >= 0) return j;
      }
      return -1;
    };

    const upcIdx = getIndex(HEADER_CANDIDATES.upc);
    const unitsIdx = getIndex(HEADER_CANDIDATES.units);
    const revenueIdx = getIndex(HEADER_CANDIDATES.revenue);
    const nameIdx = getIndex(HEADER_CANDIDATES.skuName);

    if (upcIdx >= 0 && (unitsIdx >= 0 || revenueIdx >= 0)) {
      if (upcIdx >= 0) map['upc'] = upcIdx;
      if (unitsIdx >= 0) map['units'] = unitsIdx;
      if (revenueIdx >= 0) map['revenue'] = revenueIdx;
      if (nameIdx >= 0) map['skuName'] = nameIdx;
      return { idx: i, map };
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

function parseWorkbook(wb: XLSX.WorkBook, weekEndDate: Date): NormalizedRow[] {
  // Helpers for robust detection
  function normCell(x: unknown): string {
    return String(x ?? '').replace(/\s+/g, ' ').trim();
  }
  function toNumber(v: unknown): number | undefined {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'number' && isFinite(v)) return v;
    const n = Number(String(v).replace(/[^0-9.-]/g, ''));
    return isFinite(n) ? n : undefined;
  }
  function detectHeader(norm: string[]): { upc: number; name?: number; units?: number; dollars?: number } | null {
    const upcIdx = norm.findIndex((c) => c.toLowerCase() === 'upc');
    if (upcIdx < 0) return null;
    const reUnits = /sales\s*ty.*units|total\s*sales.*units|\bunits\b/i;
    const reDollars = /sales\s*ty.*\$\$?|total\s*sales.*\$\$?|net\s*sales/i;
    const nameIdx = norm.findIndex((c) => /ulta\s*item.*description/i.test(c));
    const unitsIdx = norm.findIndex((c) => reUnits.test(c));
    const dollarsIdx = norm.findIndex((c) => reDollars.test(c));
    if (unitsIdx >= 0 || dollarsIdx >= 0) {
      return {
        upc: upcIdx,
        name: nameIdx >= 0 ? nameIdx : undefined,
        units: unitsIdx >= 0 ? unitsIdx : undefined,
        dollars: dollarsIdx >= 0 ? dollarsIdx : undefined,
      };
    }
    return null;
  }
  function findHeader(rows: unknown[][]): { idx: number; upc: number; name?: number; units?: number; dollars?: number } | null {
    const MAX_SCAN = Math.min(rows.length, 220);
    for (let r = 0; r < MAX_SCAN; r++) {
      const norm = (rows[r] || []).map(normCell);
      if (norm.every((c) => c === '')) continue;
      const hit = detectHeader(norm);
      if (hit) return { idx: r, ...hit };
    }
    // last resort: UPC and ULTA Item Description on same row
    for (let r = 0; r < Math.min(rows.length, 300); r++) {
      const norm = (rows[r] || []).map(normCell);
      const upcIdx = norm.findIndex((c) => c.toLowerCase() === 'upc');
      const nameIdx = norm.findIndex((c) => /ulta\s*item.*description/i.test(c));
      if (upcIdx >= 0 && nameIdx >= 0) {
        return { idx: r, upc: upcIdx, name: nameIdx };
      }
    }
    return null;
  }

  const prefer = ['Last Closed Week', 'Period to Date', 'Quarter to Date', 'Year to Date'];
  const sheetNames = [
    ...prefer.filter((n) => wb.SheetNames.includes(n)),
    ...wb.SheetNames.filter((n) => !prefer.includes(n)),
  ];

  const out: NormalizedRow[] = [];

  // Try robust multi-sheet parsing
  for (const sheetName of sheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false, defval: '' });
    if (!rows || rows.length === 0) continue;

    const hdr2 = findHeader(rows);
    if (!hdr2) continue;

    for (let r = hdr2.idx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const upcCell = normCell(row[hdr2.upc]);
      if (!upcCell) continue;
      if (upcCell.toLowerCase().includes('overall result')) continue;

      const upc = upcCell.replace(/\D/g, '') || upcCell;
      if (!upc || upc.length < 6) continue;

      const skuName = hdr2.name !== undefined ? normCell(row[hdr2.name]) : undefined;
      const units = hdr2.units !== undefined ? toNumber(row[hdr2.units]) : undefined;
      const revenue = hdr2.dollars !== undefined ? toNumber(row[hdr2.dollars]) : undefined;

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

  if (out.length > 0) return out;

  // Fallback: original candidate-based header on first sheet only
  const firstSheetName = wb.SheetNames[0];
  const firstWs = wb.Sheets[firstSheetName];
  const rows1: unknown[][] = XLSX.utils.sheet_to_json(firstWs, { header: 1, raw: true });
  const hdr = findHeaderIndex(rows1);
  if (!hdr) {
    console.warn(`[WARN] Could not find header in workbook first sheet: ${firstSheetName}`);
    return [];
  }

  for (let r = hdr.idx + 1; r < rows1.length; r++) {
    const row = rows1[r];
    if (!row || row.length === 0) continue;

    const get = (key: keyof typeof hdr.map) => {
      const j = hdr.map[key as string];
      return j === undefined ? '' : row[j];
    };

    const upcRaw = String(get('upc') ?? '').trim();
    if (!upcRaw) continue;
    const upc = upcRaw.replace(/\D/g, '') || upcRaw;
    const units = Number(String(get('units') ?? '').replace(/[^0-9.-]/g, ''));
    const revenue = Number(String(get('revenue') ?? '').replace(/[^0-9.-]/g, ''));
    const skuName = String(get('skuName') ?? '').trim() || undefined;

    const parsed = RowSchema.safeParse({
      upc,
      units: isFinite(units) ? units : undefined,
      revenue: isFinite(revenue) ? revenue : undefined,
      skuName,
    });
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

  return out;
}

export function parseUltaSalesInvPerfFromBuffer(data: ArrayBuffer | Buffer, weekEndDate: Date): NormalizedRow[] {
  const wb = XLSX.read(data, { type: 'buffer', cellDates: true });
  return parseWorkbook(wb, weekEndDate);
}

export function parseUltaSalesInvPerf(filePath: string, weekEndDate: Date): NormalizedRow[] {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  return parseWorkbook(wb, weekEndDate);
}