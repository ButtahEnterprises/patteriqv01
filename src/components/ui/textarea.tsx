"use client";

import * as React from "react";
import { cn } from "../../lib/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, rows = 4, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
