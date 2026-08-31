"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icons } from "./icon";
import { useFocusTrap } from "@/hooks/use-focus-trap";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useFocusTrap(open, onClose);

  if (!open) return null;

  const maxW = size === "sm" ? "max-w-[360px]" : size === "lg" ? "max-w-[740px]" : "max-w-[560px]";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={cn("flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[10px] bg-[var(--surface)] shadow-[var(--shadow-lg)]", maxW)}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <h3 className="text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 hover:bg-[var(--gray-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20"
          >
            <Icons.close size={18} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
