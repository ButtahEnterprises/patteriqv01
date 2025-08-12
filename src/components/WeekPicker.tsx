"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { latestCompleteIsoWeek, parseIsoWeek, shiftIsoWeek } from "../lib/week";

type WeekOption = {
  isoWeek: string;
  startDate: string;
  endDate: string;
};

function updateQuery(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: URLSearchParams | Readonly<URLSearchParams> | null,
  key: string,
  value?: string | null
) {
  const sp = new URLSearchParams((searchParams?.toString() ?? ""));
  if (value == null || value === "") sp.delete(key);
  else sp.set(key, value);
  const qs = sp.size ? `?${sp.toString()}` : "";
  router.push(`${pathname}${qs}`);
}

export default function WeekPicker({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const sp = useSearchParams();

  const weekFromUrl = sp?.get("week") || "";
  const weeksWindowFromUrl = sp?.get("weeks") || "";
  const [week, setWeek] = React.useState<string>(weekFromUrl);
  const [weeksWindow, setWeeksWindow] = React.useState<string>(weeksWindowFromUrl || "12");
  const [availableWeeks, setAvailableWeeks] = React.useState<WeekOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setWeek(weekFromUrl);
    if (weeksWindowFromUrl) setWeeksWindow(weeksWindowFromUrl);
  }, [weekFromUrl, weeksWindowFromUrl]);

  // Fetch available weeks from API
  React.useEffect(() => {
    const fetchWeeks = async () => {
      try {
        const response = await fetch('/api/weeks');
        if (response.ok) {
          const data = await response.json();
          if (data.weeks && Array.isArray(data.weeks)) {
            setAvailableWeeks(data.weeks.map((w: any) => ({
              isoWeek: w.iso,
              startDate: w.startDate,
              endDate: w.endDate
            })));
          }
        }
      } catch (error) {
        console.error('Failed to fetch weeks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeeks();
  }, []);

  const applyWeek = (value: string) => {
    const v = value.trim();
    if (v === "") {
      updateQuery(router, pathname, sp, "week", null);
      return;
    }
    const parsed = parseIsoWeek(v);
    if (parsed) {
      updateQuery(router, pathname, sp, "week", `${parsed.year}-W${String(parsed.week).padStart(2, "0")}`);
    }
  };

  const prevWeek = () => {
    const base = week || latestCompleteIsoWeek();
    const shifted = shiftIsoWeek(base, -1);
    updateQuery(router, pathname, sp, "week", shifted);
  };
  const nextWeek = () => {
    const base = week || latestCompleteIsoWeek();
    const shifted = shiftIsoWeek(base, 1);
    updateQuery(router, pathname, sp, "week", shifted);
  };
  const setLatest = () => {
    updateQuery(router, pathname, sp, "week", latestCompleteIsoWeek());
  };

  const applyWeeksWindow = (value: string) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1 || n > 104) return;
    const newSp = new URLSearchParams(sp?.toString() ?? "");
    newSp.set("weeks", String(n));
    const qs = newSp.size ? `?${newSp.toString()}` : "";
    router.push(`${pathname}${qs}`);
  };

  const formatWeekDisplay = (weekOption: WeekOption) => {
    const startDate = new Date(weekOption.startDate);
    const endDate = new Date(weekOption.endDate);
    return `${weekOption.isoWeek} (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  };

  const handleWeekChange = (selectedWeek: string) => {
    if (selectedWeek === "latest") {
      setLatest();
    } else {
      applyWeek(selectedWeek);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <label htmlFor="iso-week-select" className="sr-only">Select ISO Week</label>
        <button type="button" onClick={prevWeek} className="rounded-lg bg-white/10 hover:bg-white/15 text-white/80 px-2 py-1 text-xs border border-white/10" aria-label="Previous week">−</button>
        
        {isLoading ? (
          <div className="w-48 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white/50">
            Loading weeks...
          </div>
        ) : (
          <select
            id="iso-week-select"
            value={week || "latest"}
            onChange={(e) => handleWeekChange(e.target.value)}
            className="w-48 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="ISO week select"
          >
            <option value="latest">Latest Week</option>
            {availableWeeks.map((weekOption) => (
              <option key={weekOption.isoWeek} value={weekOption.isoWeek}>
                {formatWeekDisplay(weekOption)}
              </option>
            ))}
          </select>
        )}
        
        <button type="button" onClick={nextWeek} className="rounded-lg bg-white/10 hover:bg-white/15 text-white/80 px-2 py-1 text-xs border border-white/10" aria-label="Next week">+</button>
        <button type="button" onClick={setLatest} className="rounded-lg bg-white/10 hover:bg-white/15 text-white/80 px-2 py-1 text-xs border border-white/10" aria-label="Use latest completed week">Latest</button>
        <div className="ml-2 inline-flex items-center gap-1 text-white/70 text-xs">
          <label htmlFor="weeks-window" className="sr-only">Window</label>
          <select
            id="weeks-window"
            value={weeksWindow}
            onChange={(e) => { setWeeksWindow(e.target.value); applyWeeksWindow(e.target.value); }}
            className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Weeks window"
          >
            <option value="4">Last 4</option>
            <option value="8">Last 8</option>
            <option value="12">Last 12</option>
          </select>
        </div>
      </div>
    </div>
  );
}
