import { NextResponse } from 'next/server';
import { withApi } from '../../../../../lib/api';
import { insertSalesFacts } from '../../../../../lib/db/ingest_helpers';
import { parseUltaSalesInvPerfFromBuffer } from '../../../../../lib/parsers/ulta_sales_perf';
import { allocateStoreSalesToSkus, parseUltaStoreSalesFromBuffer } from '../../../../../lib/parsers/ulta_store_sales';
import type { StoreSalesRow } from '../../../../../lib/parsers/ulta_store_sales';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApi(async (req: Request) => {
  const form = await req.formData();
  const when = String(form.get('weekEndDate') || '').trim();
  if (!when) {
    return NextResponse.json({ ok: false, error: 'Missing weekEndDate (YYYY-MM-DD)' }, { status: 400 });
  }
  const weekEndDate = new Date(when);
  if (isNaN(weekEndDate.getTime())) {
    return NextResponse.json({ ok: false, error: 'Invalid weekEndDate, expected YYYY-MM-DD' }, { status: 400 });
  }

  const files = form.getAll('file') as File[];
  if (!files || files.length === 0) {
    return NextResponse.json({ ok: false, error: 'No files provided (field name: file)' }, { status: 400 });
  }

  // New strategy: parse Store-Sales (per-store totals) and optionally Sales_Inv_Perf for allocation shares
  const details: Array<{ name: string; kind: 'store-totals' | 'allocator' | 'ignored' | 'error'; rows: number; message?: string }> = [];
  const storeTotals: StoreSalesRow[] = [];
  let skuAllStores: ReturnType<typeof parseUltaSalesInvPerfFromBuffer> | null = null;
  const warnings: string[] = [];

  for (const f of files) {
    const name = f.name || '';
    let buf: Buffer | null = null;
    try {
      const ab = await f.arrayBuffer();
      buf = Buffer.from(ab);
    } catch (e) {
      details.push({ name, kind: 'error', rows: 0, message: 'Failed to read file buffer' });
      warnings.push(`Failed to read file ${name}`);
      continue;
    }

    // Accept hyphens, underscores, or spaces in filenames
    const isStoreTotals = /(store[ _-]?sales)/i.test(name) || /storesales/i.test(name);
    const isAllocator = /(sales[ _-]?inv[ _-]?perf)/i.test(name) || /salesinvperf/i.test(name);

    if (isStoreTotals) {
      try {
        const rows = parseUltaStoreSalesFromBuffer(buf!, weekEndDate);
        storeTotals.push(...rows);
        details.push({ name, kind: 'store-totals', rows: rows.length });
        if (rows.length === 0) warnings.push(`No rows parsed from Store-Sales workbook ${name}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown parse error';
        details.push({ name, kind: 'error', rows: 0, message: msg });
        warnings.push(`Error parsing Store-Sales workbook ${name}: ${msg}`);
      }
      continue;
    }

    if (isAllocator) {
      // Use the first allocator workbook present in the upload
      if (!skuAllStores) {
        try {
          const alloc = parseUltaSalesInvPerfFromBuffer(buf!, weekEndDate);
          skuAllStores = alloc;
          details.push({ name, kind: 'allocator', rows: alloc.length });
          if (alloc.length === 0) warnings.push(`No rows parsed from Sales_Inv_Perf workbook ${name}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown parse error';
          details.push({ name, kind: 'error', rows: 0, message: msg });
          warnings.push(`Error parsing Sales_Inv_Perf workbook ${name}: ${msg}`);
        }
      } else {
        // Additional allocator files are ignored to avoid double counting
        details.push({ name, kind: 'ignored', rows: 0 });
        warnings.push(`Ignoring additional allocator workbook ${name} (already using first)`);
      }
      continue;
    }

    // Ignore unrelated uploads
    details.push({ name, kind: 'ignored', rows: 0 });
  }

  if (storeTotals.length === 0) {
    return NextResponse.json({ ok: false, error: 'No Store-Sales files detected. Please upload one or more Store-Sales_*.xlsx files.' }, { status: 400 });
  }

  if (!skuAllStores || skuAllStores.length === 0) {
    warnings.push('No Sales_Inv_Perf workbook detected; allocating totals to pseudo-UPC ALL per store');
  }
  const allocated = allocateStoreSalesToSkus(storeTotals, skuAllStores ?? []);
  const res = await insertSalesFacts(allocated);

  return NextResponse.json({
    ok: true,
    files: files.length,
    rows: allocated.length,
    inserted: res.inserted,
    details,
    warnings,
  });
});
