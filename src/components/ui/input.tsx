"use client";

import * as React from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-10 w-full rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/40",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
          invalid ? "border-red-500/50" : "",
          className
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
