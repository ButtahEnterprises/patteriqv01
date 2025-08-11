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
  const details: Array<{ name: string; kind: 'store-totals' | 'allocator' | 'ignored'; rows: number }> = [];
  const storeTotals: StoreSalesRow[] = [];
  let skuAllStores: ReturnType<typeof parseUltaSalesInvPerfFromBuffer> | null = null;

  for (const f of files) {
    const name = f.name || '';
    const ab = await f.arrayBuffer();
    const buf = Buffer.from(ab);

    if (/Store-Sales_/i.test(name)) {
      const rows = parseUltaStoreSalesFromBuffer(buf, weekEndDate);
      storeTotals.push(...rows);
      details.push({ name, kind: 'store-totals', rows: rows.length });
      continue;
    }

    if (/Sales_Inv_Perf/i.test(name)) {
      // Use the first allocator workbook present in the upload
      if (!skuAllStores) {
        const alloc = parseUltaSalesInvPerfFromBuffer(buf, weekEndDate);
        skuAllStores = alloc;
        details.push({ name, kind: 'allocator', rows: alloc.length });
      } else {
        // Additional allocator files are ignored to avoid double counting
        details.push({ name, kind: 'ignored', rows: 0 });
      }
      continue;
    }

    // Ignore unrelated uploads
    details.push({ name, kind: 'ignored', rows: 0 });
  }

  if (storeTotals.length === 0) {
    return NextResponse.json({ ok: false, error: 'No Store-Sales files detected. Please upload one or more Store-Sales_*.xlsx files.' }, { status: 400 });
  }

  const allocated = allocateStoreSalesToSkus(storeTotals, skuAllStores ?? []);
  const res = await insertSalesFacts(allocated);

  return NextResponse.json({
    ok: true,
    files: files.length,
    rows: allocated.length,
    inserted: res.inserted,
    details,
  });
});
