"use client";
import { useState } from "react";

export default function IngestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch("/api/ingest/ulta", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Upload failed (${res.status})`);
      }
      setResult(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="rounded-2xl bg-gradient-to-br from-[#151925] to-[#0F131C] border border-white/5 p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-lg font-semibold">Ulta Ingestion</div>
              <div className="text-white/60 text-sm">Upload one or more Ulta XLSX files for a specific week end date.</div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl">
          <form onSubmit={onSubmit} className="space-y-5" encType="multipart/form-data" aria-busy={loading} aria-describedby={error ? "ingest-error" : undefined}>
            <div>
              <label className="block text-sm font-medium mb-1 text-white/80">Week End Date</label>
              <input
                name="weekEndDate"
                type="date"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus-visible:ring-2 focus-visible:ring-white/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-white/80">Files (.xlsx)</label>
              <input
                name="file"
                type="file"
                multiple
                accept=".xlsx,.xls"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-1.5 file:text-white hover:file:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 hover:border-white/30 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-50"
            >
              {loading ? "Uploading…" : "Upload & Ingest"}
            </button>
          </form>

          {error && (
            <div id="ingest-error" role="alert" aria-live="assertive" className="mt-4 text-sm text-rose-300">{error}</div>
          )}

          {result != null && (
            <div className="mt-6 text-sm" role="status" aria-live="polite">
              <div className="font-medium mb-2">Ingest Result</div>
              <pre className="rounded-xl border border-white/10 bg-[#111521] p-3 overflow-auto text-xs text-white/80">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
