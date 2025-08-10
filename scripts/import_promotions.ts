import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

// Promo JSON shape expected by /api/promotions
export type PromoJson = {
  id: string;
  name: string;
  description?: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;   // yyyy-mm-dd
  type?: string;
  tags: string[];
  skuUpcs: string[];
  status?: "confirmed" | "tentative";
};

const DEBUG = process.argv.includes("--debug");
function debugLog(...args: any[]) {
  if (DEBUG) console.log(...args);
}

function toDateStrUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function excelSerialToDateUTC(serial: number): Date {
  // Excel serial date (1900-based). 25569 = days from 1970-01-01 to 1899-12-31.
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
}

function parsePossibleDate(v: unknown): Date | null {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" && Number.isFinite(v)) return excelSerialToDateUTC(v);
  if (typeof v === "string") {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return new Date(t);
  }
  return null;
}

function inferYearFromFilename(fp: string): number | null {
  const m = path.basename(fp).match(/(20\d{2})/);
  if (m) {
    const yr = parseInt(m[1], 10);
    if (yr >= 2000 && yr <= 2100) return yr;
  }
  return null;
}

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeType(name: string, description?: string): string | undefined {
  const text = `${name} ${description ?? ""}`.toLowerCase();
  if (/\bfall\s+haul\b/.test(text)) return "Seasonal Sale";
  if (/\bbogo\b/.test(text) || /buy\s*one\s*get\s*one/i.test(text)) return "BOGO";
  if (/\bapp\s+event\b/.test(text)) return "App Promotion";
  if (/\bmailer\b/.test(text)) return "Mailer Offer";
  if (/\bunadvertised\b/.test(text) || /\buna\b/.test(text)) return "Unadvertised Offer";
  if (/\bonline\s*only\b/.test(text) || /\bdigital\b/.test(text)) return "Digital Offer";
  return undefined;
}

function normalizeTags(tagSet: Set<string>, name?: string, description?: string): string[] {
  const out = new Set<string>();
  const add = (t: string) => {
    const v = t.trim().toLowerCase();
    if (!v) return;
    // canonical synonym mapping
    if (["online", "online only", "dotcom", "ecom", "e-comm", "ecomm", "digital", "digital only"].includes(v)) {
      out.add("digital");
      return;
    }
    if (["in store", "instore", "in-store", "retail"].includes(v)) {
      out.add("in-store");
      return;
    }
    if (["app", "app event", "app-only", "app only"].includes(v)) {
      out.add("app-event");
      return;
    }
    if (["mailer", "magazine", "catalog", "catalogue"].includes(v)) {
      out.add("magazine");
      return;
    }
    out.add(v);
  };

  for (const t of tagSet) add(String(t));

  const text = `${name ?? ""} ${description ?? ""}`.toLowerCase();
  if (/\bonline\s*only\b/.test(text) || /\bdigital\b/.test(text)) out.add("digital");
  if (/\bapp\s*event\b/.test(text)) out.add("app-event");
  if (/\bmailer\b|\bmagazine\b|\bcatalog(ue)?\b/.test(text)) out.add("magazine");

  // If explicitly online-only, ensure we don't keep in-store
  if (out.has("digital") && /\bonline\s*only\b|\bdigital\s*only\b/.test(text)) {
    out.delete("in-store");
  }

  return Array.from(out);
}

function detectStatus(name?: string, description?: string): "confirmed" | "tentative" {
  const text = `${name ?? ""} ${description ?? ""}`.toLowerCase();
  if (/\b(tbd|tbc|tba|tentative)\b/.test(text)) return "tentative";
  return "confirmed";
}

function nameKey(n: string): string {
  return n.trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function preferPromo(a: PromoJson, b: PromoJson): PromoJson {
  // Prefer the one with more metadata (skuUpcs, tags, description length)
  const score = (p: PromoJson) =>
    (p.skuUpcs?.length ?? 0) * 3 + (p.tags?.length ?? 0) * 2 + (p.description ? p.description.length : 0);
  return score(a) >= score(b) ? a : b;
}

function findKey(keys: string[], candidates: string[]): string | undefined {
  const norm = keys.map((k) => ({ orig: k, n: normalizeHeader(k) }));
  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const f = norm.find((k) => k.n === cn);
    if (f) return f.orig;
  }
  // fuzzy contains fallback
  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const f = norm.find((k) => k.n.includes(cn));
    if (f) return f.orig;
  }
  return undefined;
}

function detectHeader(ws: XLSX.Sheet): { headerIndex: number; headerKeys: string[] } | null {
  const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: null });
  // Scan first 30 rows to find a header-like row containing likely labels
  const candidates = new Set<string>([
    "name","promotion","promotion name","promo","campaign","event","title","program","program name",
    "start","start date","begin","from","promo start","in-store start","week start","start week","launch date",
    "end","end date","through","to","promo end","in-store end","week end","end week",
    "weeks","duration","duration weeks","length","length (weeks)",
    "description","desc","notes","note","details","detail",
    "type","promo type","event type","campaign type","category",
    "tags","tag","channels","channel","focus","theme",
    "sku upcs","skuupcs","upcs","upc","upc(s)","sku","skus","upc list","sku list",
    // Additional header cues for calendar-style sheets
    "month","ulta promotion",
  ].map((s) => normalizeHeader(s)));

  const maxScan = Math.min(30, arr.length);
  let bestIdx = -1;
  let bestScore = 0;
  let bestKeys: string[] = [];
  for (let i = 0; i < maxScan; i++) {
    const row = (arr[i] || []).map((v) => (typeof v === "string" ? v : v == null ? "" : String(v)));
    const score = row.reduce((acc, cell) => (candidates.has(normalizeHeader(cell)) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      // Create header keys, ensuring uniqueness and non-empty
      const keys: string[] = [];
      const seen = new Set<string>();
      for (let c = 0; c < row.length; c++) {
        let key = String(row[c] ?? "").trim();
        if (!key) key = `COL_${c + 1}`;
        // sanitize
        key = key.replace(/\n/g, " ").trim();
        let k = key;
        let n = 2;
        while (seen.has(k)) k = `${key}_${n++}`;
        seen.add(k);
        keys.push(k);
      }
      bestKeys = keys;
    }
  }
  if (bestIdx >= 0 && bestKeys.length) return { headerIndex: bestIdx, headerKeys: bestKeys };
  return null;
}

async function parseSheet(fp: string, ws: XLSX.Sheet): Promise<PromoJson[]> {
  // Detect header row and keys
  const detected = detectHeader(ws);
  let rows: any[];
  if (detected) {
    rows = XLSX.utils.sheet_to_json(ws, {
      defval: null,
      range: detected.headerIndex,
      header: detected.headerKeys,
    });
  } else {
    rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  }
  if (!rows.length) return [];

  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  debugLog(`  [parser] ${path.basename(fp)} keys: ${keys.join(" | ")}`);

  // Compute base/source tag early so both normal and fallback logic can use it
  const base = path.basename(fp).toLowerCase();
  const sourceTag = base.includes("in store") || base.includes("instore")
    ? "in-store"
    : base.includes("retail")
    ? "retail"
    : undefined;

  const nameKey = findKey(keys, [
    "name",
    "promotion name",
    "promotion",
    "promo",
    "campaign",
    "event",
    "title",
    "program",
    "program name",
  ]);
  const startKey = findKey(keys, [
    "start",
    "start date",
    "startdate",
    "begin",
    "begin date",
    "from",
    "promo start",
    "in-store start",
    "week start",
    "start week",
    "launch date",
    "start of promo",
  ]);
  const endKey = findKey(keys, [
    "end",
    "end date",
    "enddate",
    "through",
    "to",
    "promo end",
    "in-store end",
    "week end",
    "end week",
    "end of promo",
  ]);
  const durationKey = findKey(keys, [
    "weeks",
    "duration",
    "duration weeks",
    "length",
    "length (weeks)",
  ]);
  const descKey = findKey(keys, [
    "description",
    "desc",
    "notes",
    "note",
    "details",
    "detail",
  ]);
  const typeKey = findKey(keys, [
    "type",
    "promo type",
    "event type",
    "campaign type",
    "category",
  ]);
  const tagsKey = findKey(keys, [
    "tags",
    "tag",
    "channels",
    "channel",
    "focus",
    "theme",
  ]);
  const skuKey = findKey(keys, [
    "sku upcs",
    "skuupcs",
    "upcs",
    "upc",
    "upc(s)",
    "sku",
    "skus",
    "upc list",
    "sku list",
  ]);

  const monthKey = findKey(keys, ["month"]);
  const ultaPromoKey = findKey(keys, ["ulta promotion"]);
  if (path.basename(fp).toLowerCase().includes("ulta2025")) {
    debugLog(`  [parser] monthKey=${String(monthKey)} ultaPromoKey=${String(ultaPromoKey)} startKey=${String(startKey)} endKey=${String(endKey)}`);
  }
  if (!startKey && !endKey && monthKey && ultaPromoKey) {
    debugLog(`  Detected calendar-style layout (month + ulta promotion) in ${path.basename(fp)}`);
    const out: PromoJson[] = [];
    const used = new Set<string>();
    const sigSet = new Set<string>();
    let currentYear = inferYearFromFilename(fp) ?? new Date().getUTCFullYear();

    const dateRangeRe = /(\d{1,2})\s*\/\s*(\d{1,2})\s*-\s*(\d{1,2})\s*\/\s*(\d{1,2})/g;

    for (const r of rows) {
      const monthVal = r[monthKey];
      const textRaw = r[ultaPromoKey];
      if (typeof monthVal === "number" && Number.isInteger(monthVal) && monthVal >= 2000 && monthVal <= 2100) {
        currentYear = monthVal; // a row like '2026' resets parsing year
        continue;
      }
      const text = typeof textRaw === "string" ? textRaw.replace(/\r\n?/g, "\n") : "";
      if (!text.trim()) continue;

      const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      // Scan lines; extract one or more date ranges per line and pair each with title text
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches: Array<{ index: number; len: number; sm: number; sd: number; em: number; ed: number }> = [];
        let m: RegExpExecArray | null;
        dateRangeRe.lastIndex = 0;
        while ((m = dateRangeRe.exec(line)) !== null) {
          const [, sm, sd, em, ed] = m;
          matches.push({ index: m.index, len: m[0].length, sm: parseInt(sm, 10), sd: parseInt(sd, 10), em: parseInt(em, 10), ed: parseInt(ed, 10) });
        }
        if (!matches.length) continue;

        for (let k = 0; k < matches.length; k++) {
          const mm = matches[k];
          const sYear = currentYear;
          const eYear = mm.em < mm.sm ? currentYear + 1 : currentYear;
          const start = new Date(Date.UTC(sYear, mm.sm - 1, mm.sd));
          const end = new Date(Date.UTC(eYear, mm.em - 1, mm.ed));

          const segStart = mm.index + mm.len;
          const segEnd = k + 1 < matches.length ? matches[k + 1].index : line.length;
          let title = line.slice(segStart, segEnd).trim();
          if (!title) {
            // Fall back to subsequent lines until next date line
            let j = i + 1;
            const acc: string[] = [];
            while (j < lines.length) {
              const next = lines[j];
              if (dateRangeRe.test(next)) break;
              if (next) acc.push(next);
              j++;
            }
            title = acc.join(" ").trim();
          }

          const name = title || "ULTA Promotion";
          const year = start.getUTCFullYear();
          const slug = name
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 16);
          const sig = `${toDateStrUTC(start)}|${toDateStrUTC(end)}|${slug}`;
          if (sigSet.has(sig)) continue;
          sigSet.add(sig);
          const idBase = `P${String(year).slice(-2)}-${slug || "PROMO"}`;
          let id = idBase;
          let n = 2;
          while (used.has(id)) id = `${idBase}-${n++}`;
          used.add(id);

          const tagSet = new Set<string>();
          if (sourceTag) tagSet.add(sourceTag);
          tagSet.add("ulta");
          const mappedType = normalizeType(name);
          const tags = normalizeTags(tagSet, name);
          const status = detectStatus(name);

          out.push({
            id,
            name,
            description: name,
            startDate: toDateStrUTC(start),
            endDate: toDateStrUTC(end),
            type: mappedType,
            tags,
            skuUpcs: [],
            status,
          });
        }
      }
    }

    // sort by start date
    out.sort((a, b) => a.startDate.localeCompare(b.startDate));
    debugLog(`    Extracted ${out.length} promos via calendar-style parser`);
    return out;
  }

  const out: PromoJson[] = [];
  const used = new Set<string>();

  for (const r of rows) {
    const rawName = nameKey ? String(r[nameKey] ?? "").trim() : "";
    const sVal = startKey ? r[startKey] : null;
    const eVal = endKey ? r[endKey] : null;
    let sd = parsePossibleDate(sVal);
    let ed = parsePossibleDate(eVal);

    if (!ed && sd && durationKey && r[durationKey] != null) {
      const w = Number(r[durationKey]);
      if (Number.isFinite(w) && w > 0) {
        ed = new Date(sd);
        ed.setUTCDate(ed.getUTCDate() + Math.round(w * 7) - 1);
      }
    }

    if (!sd || !ed || !rawName) continue;

    const name = rawName;
    const description = descKey ? (r[descKey] ? String(r[descKey]).trim() : undefined) : undefined;
    const explicitType = typeKey ? (r[typeKey] ? String(r[typeKey]).trim() : undefined) : undefined;
    const mappedType = normalizeType(name, description);
    const type = explicitType || mappedType;

    const tagSet = new Set<string>();
    if (tagsKey && r[tagsKey]) {
      String(r[tagsKey])
        .split(/[;,|]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((t) => tagSet.add(t));
    }
    if (sourceTag) tagSet.add(sourceTag);

    const upcSet = new Set<string>();
    if (skuKey && r[skuKey]) {
      String(r[skuKey])
        .split(/[^0-9]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 8)
        .forEach((u) => upcSet.add(u));
    }

    const startDate = toDateStrUTC(sd);
    const endDate = toDateStrUTC(ed);
    const tags = normalizeTags(tagSet, name, description);
    const status = detectStatus(name, description);

    const year = sd.getUTCFullYear();
    const slug = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 16);
    const idBase = `P${String(year).slice(-2)}-${slug || "PROMO"}`;
    let id = idBase;
    let i = 2;
    while (used.has(id)) id = `${idBase}-${i++}`;
    used.add(id);

    out.push({
      id,
      name,
      description: description || name,
      startDate,
      endDate,
      type,
      tags,
      skuUpcs: Array.from(upcSet),
      status,
    });
  }

  // sort by start date
  out.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return out;
}

async function parseWorkbook(fp: string): Promise<PromoJson[]> {
  const wb = XLSX.readFile(fp, { cellDates: true });
  debugLog(`Parsing workbook: ${path.basename(fp)} -> sheets: ${wb.SheetNames.join(", ")}`);
  const all: PromoJson[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const promos = await parseSheet(fp, ws);
    debugLog(`  Sheet '${sheetName}': ${promos.length} promos`);
    all.push(...promos);
  }
  return all;
}

async function main() {
  const dir = path.join(process.cwd(), "data", "promotions");
  const entries = await fs.readdir(dir);
  const xlsxFiles = entries.filter((f) => f.toLowerCase().endsWith(".xlsx"));
  if (!xlsxFiles.length) {
    console.error("No .xlsx files found in data/promotions");
    process.exit(1);
  }

  const yearMap = new Map<number, PromoJson[]>();

  for (const f of xlsxFiles) {
    const fp = path.join(dir, f);
    const promos = await parseWorkbook(fp);
    for (const p of promos) {
      const y = new Date(p.startDate).getUTCFullYear();
      if (!yearMap.has(y)) yearMap.set(y, []);
      yearMap.get(y)!.push(p);
    }
  }

  // Merge and sort per year
  for (const [y, arr] of yearMap) {
    // Deduplicate by (startDate|endDate|nameKey)
    const map = new Map<string, PromoJson>();
    for (const p of arr) {
      const key = `${p.startDate}|${p.endDate}|${nameKey(p.name)}`;
      const existing = map.get(key);
      map.set(key, existing ? preferPromo(existing, p) : p);
    }
    const deduped = Array.from(map.values());
    deduped.sort((a, b) => a.startDate.localeCompare(b.startDate));
    // Optional: debug check for week boundaries Sun-Sat
    if (DEBUG) {
      for (const p of deduped) {
        const s = new Date(p.startDate + "T00:00:00Z");
        const e = new Date(p.endDate + "T00:00:00Z");
        const sDow = s.getUTCDay(); // 0=Sun
        const eDow = e.getUTCDay(); // 6=Sat
        if (!(sDow === 0 && eDow === 6)) {
          console.warn(`  [warn] Non Sun-Sat range: ${p.startDate}..${p.endDate} - '${p.name}'`);
        }
      }
    }
    yearMap.set(y, deduped);
  }

  // Write out JSON for 2024 and 2025
  for (const y of [2024, 2025]) {
    const arr = yearMap.get(y) || [];
    const outPath = path.join(dir, `promotions_${y}.json`);
    await fs.writeFile(outPath, JSON.stringify(arr, null, 2) + "\n", "utf-8");
    console.log(`Wrote ${arr.length} promos -> ${path.relative(process.cwd(), outPath)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
