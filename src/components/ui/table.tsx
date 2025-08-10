import * as React from "react";
import { cn } from "../../lib/cn";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full text-sm text-left text-white/80", className)} {...props} />;
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("text-white/90", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-white/5", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
        className
      )}
      {...props}
    />
  );
}

type ThScope = React.ThHTMLAttributes<HTMLTableCellElement>["scope"];

export function TableHead({ className, scope = "col" as ThScope, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cn("px-3 py-2 font-medium first:pl-4 last:pr-4", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2 first:pl-4 last:pr-4", className)} {...props} />;
}

export function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption className={cn("mt-2 text-xs text-white/60 text-left", className)} {...props} />
  );
}
