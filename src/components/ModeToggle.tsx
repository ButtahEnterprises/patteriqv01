"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function ModeToggle({ initialDemo }: { initialDemo: boolean }) {
  const [demo, setDemo] = useState<boolean>(initialDemo);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function setMode(nextDemo: boolean) {
    setDemo(nextDemo);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoMode: nextDemo }),
      });
      if (!res.ok) throw new Error("Failed to update mode");
    } catch {
      // revert on error
      setDemo(!nextDemo);
    } finally {
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-white/60">Mode</div>
      <button
        onClick={() => setMode(!demo)}
        disabled={pending}
        className="relative inline-flex h-7 w-28 items-center rounded-full border border-white/15 bg-white/10 px-1 text-xs transition-all disabled:opacity-60 hover:border-white/25 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        aria-pressed={demo}
        aria-busy={pending}
        aria-label="Toggle Demo Mode"
        title={demo ? "Demo Mode" : "Live Mode"}
      >
        <span
          className={`pointer-events-none absolute inset-1 inline-flex w-[calc(50%-0.125rem)] items-center justify-center rounded-full border transition-all ${demo ? "translate-x-[calc(100%+0.25rem)] bg-emerald-500/30 border-emerald-500/40 text-emerald-100" : "translate-x-0 bg-white/15 border-white/20 text-white/90"}`}
        >
          {demo ? "Demo" : "Live"}
        </span>
        <span className="w-1/2 text-center opacity-0">Live</span>
        <span className="w-1/2 text-center opacity-0">Demo</span>
      </button>
    </div>
  );
}
