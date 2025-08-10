"use client";

import * as React from "react";
import { cn } from "../../lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);

  function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
    if (!container) return [];
    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>(
        [
          "a[href]",
          "button:not([disabled])",
          "textarea:not([disabled])",
          "input:not([disabled])",
          "select:not([disabled])",
          "[tabindex]:not([tabindex='-1'])",
        ].join(",")
      )
    );
    return nodes.filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1 && el.offsetParent !== null);
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      // remember the element that had focus before opening
      lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
      document.addEventListener("keydown", onKey);
      // move initial focus to the first focusable element, or dialog itself
      setTimeout(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = getFocusableElements(dialog);
        (focusables[0] ?? dialog).focus();
      }, 0);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // restore focus to the previously focused trigger, if any
      if (lastFocusedRef.current) {
        setTimeout(() => lastFocusedRef.current?.focus(), 0);
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={description ? "modal-description" : undefined}
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const dialog = dialogRef.current;
          if (!dialog) return;
          const focusables = getFocusableElements(dialog);
          if (focusables.length === 0) {
            e.preventDefault();
            dialog.focus();
            return;
          }
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const active = document.activeElement as HTMLElement | null;
          if (e.shiftKey) {
            if (active === first || active === dialog) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (active === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#141720] p-5 text-white shadow-lg",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
          className
        )}
      >
        {title ? (
          <h2 id="modal-title" className="text-base font-semibold text-white">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p id="modal-description" className="mt-1 text-sm text-white/70">
            {description}
          </p>
        ) : null}
        <div className="mt-3">{children}</div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
