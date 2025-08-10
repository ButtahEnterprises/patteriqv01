"use client";

import * as React from "react";
import { cn } from "../../lib/cn";

export type Tab = { value: string; label: string; content: React.ReactNode; disabled?: boolean };

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: Tab[];
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({ className, tabs, defaultValue, onValueChange, ...props }: TabsProps) {
  const enabledTabs = tabs.filter((t) => !t.disabled);
  const initial = defaultValue ?? enabledTabs[0]?.value ?? tabs[0]?.value ?? "";
  const [value, setValue] = React.useState(initial);

  React.useEffect(() => {
    if (defaultValue != null) setValue(defaultValue);
  }, [defaultValue]);

  function select(val: string) {
    setValue(val);
    onValueChange?.(val);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const currentIndex = enabledTabs.findIndex((t) => t.value === value);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = enabledTabs[(currentIndex + 1) % enabledTabs.length];
      if (next) select(next.value);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = enabledTabs[(currentIndex - 1 + enabledTabs.length) % enabledTabs.length];
      if (prev) select(prev.value);
    }
  }

  return (
    <div className={cn(className)} {...props}>
      <div
        role="tablist"
        aria-label="Tabs"
        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1"
        onKeyDown={onKeyDown}
      >
        {tabs.map((t) => {
          const selected = t.value === value;
          const disabled = !!t.disabled;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${t.value}`}
              id={`tab-${t.value}`}
              disabled={disabled}
              tabIndex={selected ? 0 : -1}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                selected ? "bg-emerald-600 text-white" : "text-white/80 hover:bg-white/10",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !disabled && select(t.value)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tabs.map((t) => (
        <div
          key={t.value}
          role="tabpanel"
          id={`panel-${t.value}`}
          aria-labelledby={`tab-${t.value}`}
          hidden={t.value !== value}
          className="mt-3"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
