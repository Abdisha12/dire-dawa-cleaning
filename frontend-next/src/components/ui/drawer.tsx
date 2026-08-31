"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icons } from "./icon";
import { useFocusTrap } from "@/hooks/use-focus-trap";

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useFocusTrap(open, onClose);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex" role="dialog" aria-modal="true" aria-label={title}>
      <div aria-hidden="true" onClick={onClose} className="flex-1 cursor-pointer bg-black/40" />
      <div ref={ref} className="flex h-full w-full max-w-md flex-col bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close drawer" className="rounded p-1 hover:bg-[var(--gray-100)]">
            <Icons.close size={18} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
