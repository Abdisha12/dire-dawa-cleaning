import * as React from "react";
import { cn } from "@/lib/utils";

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border-[var(--border-strong)] bg-[var(--surface)] text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Radio({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="radio"
      className={cn(
        "h-4 w-4 border-[var(--border-strong)] text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          !disabled && onCheckedChange(!checked);
        }
      }}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20 disabled:opacity-50",
        checked ? "bg-[var(--primary)]" : "bg-[var(--gray-200)]"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}
