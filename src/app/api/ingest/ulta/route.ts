import { NextResponse } from 'next/server';
import { withApi } from '../../../../../lib/api';
import { insertSalesFacts } from '../../../../../lib/db/ingest_helpers';
import { parseUltaSalesInvPerfFromBuffer } from '../../../../../lib/parsers/ulta_sales_perf';

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

  let totalRows = 0;
  let inserted = 0;
  const details: Array<{ name: string; rows: number }> = [];

  for (const f of files) {
    const ab = await f.arrayBuffer();
    const buf = Buffer.from(ab);

    const rows = parseUltaSalesInvPerfFromBuffer(buf, weekEndDate);
    totalRows += rows.length;

    const res = await insertSalesFacts(rows);
    inserted += res.inserted;

    details.push({ name: f.name, rows: rows.length });
  }

  return NextResponse.json({ ok: true, files: files.length, rows: totalRows, inserted, details });
});
