import * as XLSX from 'xlsx';
import { NormalizedRow } from '../db/ingest_helpers';

export type StoreSalesRow = {
  weekEndDate: Date;
  storeCode: string;
  storeName: string;
  units: number;
  revenue: number;
  inventory?: number; // Not present in sample; kept for compatibility
};

function normCell(x: unknown): string {
  return String(x ?? '').replace(/\s+/g, ' ').trim();
}

function toNumber(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number' && isFinite(v)) return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : undefined;
}

function findHeader(rows: unknown[][]): { idx: number; colStoreNum: number; colStoreName: number; colUnits: number; colSales: number } | null {
  const MAX_SCAN = Math.min(rows.length, 60);
  for (let i = 0; i < MAX_SCAN; i++) {
    const row = (rows[i] || []).map(normCell);
    if (row.every((c) => c === '')) continue;

    const lc = row.map((c) => c.toLowerCase());
    const colStoreNum = lc.findIndex((c) => /store\s*number/.test(c));
    const colStoreName = lc.findIndex((c) => /store\s*name/.test(c));
    const colUnits = lc.findIndex((c) => /total\s*units|sales\s*units/.test(c));
    const colSales = lc.findIndex((c) => /net\s*sales|sales\s*\$|sales\s*\$\$/.test(c));

    if (colStoreNum >= 0 && colStoreName >= 0 && (colUnits >= 0 || colSales >= 0)) {
      return { idx: i, colStoreNum, colStoreName, colUnits, colSales };
    }
  }
  return null;
}

export function parseUltaStoreSales(filePath: string, weekEndDate: Date): StoreSalesRow[] {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  return parseStoreSalesWorkbook(wb, weekEndDate);
}

function parseStoreSalesWorkbook(wb: XLSX.WorkBook, weekEndDate: Date): StoreSalesRow[] {
  const ws = wb.Sheets['StoreSalesReport'];
  if (!ws) return [];

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false, defval: '' });
  if (!rows || rows.length === 0) return [];

  const hdr = findHeader(rows);
  if (!hdr) return [];

  const out: StoreSalesRow[] = [];

  for (let r = hdr.idx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const storeCode = normCell(row[hdr.colStoreNum]);
    const storeName = normCell(row[hdr.colStoreName]);

    // Stop at totals/footer or blank
    if (!storeCode || /^total\s*:/i.test(storeName)) break;

    // store codes appear as zero-padded strings (e.g., "0007"); keep as-is
    const units = hdr.colUnits >= 0 ? toNumber(row[hdr.colUnits]) : undefined;
    const revenue = hdr.colSales >= 0 ? toNumber(row[hdr.colSales]) : undefined;

    if (!storeCode || !storeName) continue;

    out.push({
      weekEndDate,
      storeCode,
      storeName,
      units: Number.isFinite(units) ? (units as number) : 0,
      revenue: Number.isFinite(revenue) ? (revenue as number) : 0,
    });
  }

  return out;
}

export function parseUltaStoreSalesFromBuffer(data: ArrayBuffer | Buffer, weekEndDate: Date): StoreSalesRow[] {
  const wb = XLSX.read(data, { type: 'buffer', cellDates: true });
  return parseStoreSalesWorkbook(wb, weekEndDate);
}
export function allocateStoreSalesToSkus(storeTotals: StoreSalesRow[], skuAllStores: NormalizedRow[]): NormalizedRow[] {
  if (!storeTotals.length) return [];

  // If we have no SKU-level totals, fall back to a single pseudo-SKU per store
  if (!skuAllStores.length) {
    return storeTotals.map((s) => ({
      weekEndDate: s.weekEndDate,
      storeCode: s.storeCode,
      storeName: s.storeName,
      upc: 'ALL',
      skuName: 'All SKUs',
      units: Math.round(s.units || 0),
      revenue: s.revenue || 0,
    }));
  }

  const totalUnits = skuAllStores.reduce((acc, r) => acc + (Number.isFinite(r.units) ? (r.units as number) : 0), 0);
  const totalRevenue = skuAllStores.reduce((acc, r) => acc + (Number.isFinite(r.revenue) ? (r.revenue as number) : 0), 0);

  // Build shares; if total is 0, fall back to equal shares across SKUs
  const equalShare = 1 / skuAllStores.length;

  const unitShares = skuAllStores.map((r) => (totalUnits > 0 ? (r.units || 0) / totalUnits : equalShare));
  const revenueShares = skuAllStores.map((r) => (totalRevenue > 0 ? (r.revenue || 0) / totalRevenue : equalShare));

  const out: NormalizedRow[] = [];
  for (const s of storeTotals) {
    for (let i = 0; i < skuAllStores.length; i++) {
      const sku = skuAllStores[i];
      const u = Math.round((s.units || 0) * unitShares[i]);
      const rev = (s.revenue || 0) * revenueShares[i];
      out.push({
        weekEndDate: s.weekEndDate,
        storeCode: s.storeCode,
        storeName: s.storeName,
        upc: sku.upc,
        skuName: sku.skuName,
        units: u,
        revenue: rev,
      });
    }
  }
  return out;
}
