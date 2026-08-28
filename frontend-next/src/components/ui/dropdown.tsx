"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Dropdown({
  trigger,
  children,
  align = "end",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 min-w-[180px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-md)]",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-[var(--gray-100)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
