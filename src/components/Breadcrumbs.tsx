import React from "react";

export type Crumb = {
  label: string;
  href?: string;
  srLabel?: string;
};

export default function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  return (
    <nav
      aria-label="Breadcrumbs"
      className={className}
      data-testid="breadcrumbs"
      role="navigation"
    >
      <ol className="flex flex-wrap items-center gap-1 text-xs sm:text-sm text-white/60">
        {safeItems.map((it, idx) => {
          const isLast = idx === safeItems.length - 1;
          const content = (
            <span
              className={isLast ? "text-white/90" : "hover:text-white transition-colors"}
              aria-current={isLast ? "page" : undefined}
              data-testid="breadcrumb-item"
            >
              {it.label}
              {it.srLabel ? <span className="sr-only"> {it.srLabel}</span> : null}
            </span>
          );
          return (
            <li key={`${it.label}-${idx}`} className="inline-flex items-center gap-1">
              {it.href && !isLast ? (
                <a href={it.href} className="focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded">
                  {content}
                </a>
              ) : (
                content
              )}
              {!isLast ? (
                <span className="px-1 text-white/30" aria-hidden>
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
