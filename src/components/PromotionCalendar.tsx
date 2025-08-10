"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "./ui/card";

export type PromoItem = {
  id: string;
  name: string;
  description?: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  type?: string;
  tags?: string[];
  metrics: {
    baselineAvg: number;
    promoAvg: number;
    effectPct: number; // e.g. 12.3 means +12.3%
  };
  weeks: Array<{ isoWeek: string; revenue: number }>;
};

function fmtPct(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

// (fmtDate) removed: unused

function dateRange(a: string, b: string) {
  try {
    const aY = new Date(a).getFullYear();
    const bY = new Date(b).getFullYear();
    const sameYear = aY === bY;
    const left = new Date(a).toLocaleDateString(undefined, { month: "short", day: "2-digit" });
    const right = new Date(b).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: sameYear ? undefined : "numeric" });
    const suffix = sameYear ? `, ${aY}` : "";
    return `${left} – ${right}${suffix}`;
  } catch {
    return `${a} – ${b}`;
  }
}

function Sparkline({ data }: { data: Array<{ isoWeek: string; revenue: number }> }) {
  const d = data && data.length ? data : [{ isoWeek: "N/A", revenue: 0 }];
  const max = Math.max(...d.map((x) => x.revenue), 1);
  const min = Math.min(...d.map((x) => x.revenue), 0);
  return (
    <ResponsiveContainer width="100%" height={64}>
      <LineChart data={d} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <XAxis dataKey="isoWeek" hide tick={false} axisLine={false} />
        <YAxis domain={[min, max]} hide />
        <Tooltip
          contentStyle={{ background: "#0B0E14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
          labelStyle={{ color: "#B3BCD2" }}
          formatter={(v: number | string) => ["$" + Number(v).toLocaleString(), "Revenue"]}
        />
        <Line type="monotone" dataKey="revenue" stroke="#60A5FA" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function PromotionCalendar({ items, demoMode, error }: { items: PromoItem[]; demoMode: boolean; error?: string | null }) {
  const list = React.useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const byEffectDesc = React.useMemo(() => [...list].sort((a, b) => b.metrics.effectPct - a.metrics.effectPct), [list]);
  const bestId = byEffectDesc[0]?.id;
  const worstId = byEffectDesc[byEffectDesc.length - 1]?.id;

  return (
    <Card
      className="group transition-colors duration-200 hover:border-white/10"
      role="region"
      aria-label="Promotion Calendar"
      data-testid="promotion-calendar"
    >
      <CardHeader className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium text-white/80">Promotion Calendar</div>
        {demoMode ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-[11px]">
            Demo Data
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white/70 border border-white/15 px-2.5 py-0.5 text-[11px]">
            Live
          </span>
        )}
      </CardHeader>
      <CardContent>

      {error ? (
        <div
          className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 p-4"
          role="alert"
          aria-live="assertive"
          data-testid="promotion-calendar-error"
        >
          <div className="text-sm font-medium">Unable to load promotions</div>
          <div className="text-xs mt-1 opacity-90">{error}</div>
        </div>
      ) : list.length === 0 ? (
        <div>
          <p className="text-white/60 text-sm">No promotions found.</p>
          <ul className="mt-3 space-y-3" aria-live="polite">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="rounded-xl border border-white/5 bg-white/5 p-4">
                <div className="h-4 w-40 bg-white/10 rounded" />
                <div className="mt-2 h-3 w-56 bg-white/10 rounded" />
                <div className="mt-3 h-16 w-full bg-white/10 rounded" />
              </li>
            ))}
          </ul>
          <p className="sr-only">Promotion calendar skeleton state while data loads or when empty.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-live="polite">
          {list.map((p) => {
            const isBest = p.id === bestId && list.length > 1;
            const isWorst = p.id === worstId && list.length > 1;
            const eff = p.metrics.effectPct;
            const effColor = eff > 0 ? "text-emerald-300" : eff < 0 ? "text-rose-300" : "text-white/70";
            const effBg = eff > 0 ? "bg-emerald-500/15 border-emerald-500/30" : eff < 0 ? "bg-rose-500/15 border-rose-500/30" : "bg-white/10 border-white/15";
            return (
              <li
                key={p.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-white/20 focus-within:border-white/30 outline-none"
                role="article"
                aria-label={`${p.name}, ${dateRange(p.startDate, p.endDate)}`}
                data-testid="promo-card"
                data-promo-id={p.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-medium text-white/90">{p.name}</h3>
                      {isBest && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] px-2 py-0.5" data-testid="promo-badge-best">
                          Best
                        </span>
                      )}
                      {isWorst && (
                        <span className="inline-flex items-center rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] px-2 py-0.5" data-testid="promo-badge-worst">
                          Worst
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/60 mt-0.5">{dateRange(p.startDate, p.endDate)}</div>
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      {p.type && (
                        <span className="inline-flex items-center rounded-md bg-white/10 border border-white/15 text-white/70 text-[10px] px-1.5 py-0.5">
                          {p.type}
                        </span>
                      )}
                      {(p.tags || []).slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center rounded-md bg-white/5 border border-white/10 text-white/60 text-[10px] px-1.5 py-0.5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${effBg} ${effColor}`} data-testid="promo-effect">
                    {fmtPct(eff)}
                  </div>
                </div>
                <div className="mt-3 h-[64px]" data-testid="promo-sparkline">
                  <Sparkline data={p.weeks} />
                </div>
                {p.description ? <p className="mt-2 text-xs text-white/60 line-clamp-2">{p.description}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
      </CardContent>
    </Card>
  );
}
