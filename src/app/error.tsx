"use client";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string } ; reset: () => void; }) {
  return (
    <main className="min-h-dvh bg-[#0C0F15] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-2xl mb-4">!
        </div>
        <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-white/70 mb-6">{error?.message || "An unexpected error occurred."}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => reset()} className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm hover:bg-white/15">Try again</button>
          <Link href="/" className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm hover:bg-white/15">Go home</Link>
        </div>
      </div>
    </main>
  );
}
