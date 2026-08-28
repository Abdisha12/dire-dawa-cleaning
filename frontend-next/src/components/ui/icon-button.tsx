import * as React from "react";
import { Button } from "./button";
import { Icons } from "./icon";

export function IconButton({
  "aria-label": ariaLabel,
  children,
  variant = "ghost",
  size = "sm",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  variant?: "ghost" | "outline" | "primary";
  size?: "sm" | "md";
}) {
  const sizeCls = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const variantCls =
    variant === "primary"
      ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-d)]"
      : variant === "outline"
        ? "border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--gray-100)]"
        : "bg-transparent hover:bg-[var(--gray-100)]";
  return (
    <button
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center rounded-[var(--r-sm)] p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20 disabled:opacity-50 ${sizeCls} ${variantCls}`}
      {...props}
    >
      {children}
    </button>
  );
}
