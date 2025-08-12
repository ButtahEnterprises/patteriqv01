"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export default function PromoOverlayToggle({ initialOn = false }: { initialOn?: boolean }) {
  const [on, setOn] = useState<boolean>(initialOn);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  function toggle() {
    const next = !on;
    setOn(next);
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    if (next) {
      sp.set("promo", "1");
    } else {
      sp.delete("promo");
    }
    const qs = sp.toString();
    const path = pathname || "/";
    startTransition(() => {
      router.replace(qs ? `${path}?${qs}` : path);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2" aria-label="Promo Overlay Toggle">
      <div className="text-xs text-white/60">Promo</div>
      <button
        onClick={toggle}
        disabled={pending}
        className="relative inline-flex h-7 w-28 items-center rounded-full border border-white/15 bg-white/10 px-1 text-xs transition-all disabled:opacity-60 hover:border-white/25 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        aria-pressed={on}
        aria-busy={pending}
        aria-label="Toggle Promo Overlay"
        data-testid="promo-overlay-toggle"
        title={on ? "Promo On" : "Promo Off"}
      >
        <span
          className={`pointer-events-none absolute inset-1 inline-flex w-[calc(50%-0.125rem)] items-center justify-center rounded-full border transition-all ${on ? "translate-x-[calc(100%+0.25rem)] bg-amber-500/25 border-amber-500/40 text-amber-100" : "translate-x-0 bg-white/15 border-white/20 text-white/90"}`}
        >
          {on ? "On" : "Off"}
        </span>
        <span className="w-1/2 text-center opacity-0">Off</span>
        <span className="w-1/2 text-center opacity-0">On</span>
      </button>
    </div>
  );
}
