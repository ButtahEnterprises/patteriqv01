import * as React from "react";
import { cn } from "../../lib/cn";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "destructive" | "outline";
};

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-white/10 text-white border border-white/10",
  success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  warning: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
  destructive: "bg-red-500/15 text-red-300 border border-red-500/30",
  outline: "bg-transparent text-white border border-white/20",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
