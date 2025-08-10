#!/usr/bin/env node
const XLSX = require('xlsx');

function inspect(file) {
  const wb = XLSX.readFile(file, { cellDates: true });
  console.log(`\n===== FILE: ${file} =====`);
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
    console.log(`\n--- SHEET: ${sheetName} (showing first 80 rows) ---`);
    for (let i = 0; i < Math.min(rows.length, 80); i++) {
      const row = (rows[i] || []).map(v => (v === undefined ? '' : v));
      console.log(String(i).padStart(3, '0'), JSON.stringify(row));
    }
  }
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node scripts/inspect_xlsx.js <path-to-xlsx>');
    process.exit(1);
  }
  files.forEach(inspect);
}
main();