"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--gray-900)] px-2 py-1 text-xs text-white shadow"
        >
          {content}
        </span>
      )}
    </span>
  );
}
