import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "green" | "orange" | "red" | "blue" | "purple" | "gray";

const map: Record<BadgeVariant, string> = {
  green: "bg-[var(--success-l)] text-[var(--success)]",
  orange: "bg-[var(--warning-l)] text-[var(--warning)]",
  red: "bg-[var(--danger-l)] text-[var(--danger)]",
  blue: "bg-[var(--information-l)] text-[var(--information)]",
  purple: "bg-[#ede9fe] text-[#7c3aed]",
  gray: "bg-[var(--gray-100)] text-[var(--gray-700)]",
};

export function Badge({
  variant = "gray",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        map[variant],
        className
      )}
      {...props}
    />
  );
}

// StatusBadge mirrors utils.js statusBadge but typed
export function StatusBadge({ status }: { status: string }) {
  const entry: Record<string, { v: BadgeVariant; label: string }> = {
    paid: { v: "green", label: "✓ Paid" },
    pending: { v: "orange", label: "⏳ Pending" },
    overdue: { v: "red", label: "⚠ Overdue" },
    active: { v: "green", label: "● Active" },
    warning: { v: "orange", label: "⚠ Warning" },
    danger: { v: "red", label: "🔴 Danger" },
    draft: { v: "gray", label: "Draft" },
    submitted: { v: "blue", label: "Submitted" },
    reviewed: { v: "orange", label: "Reviewed" },
    approved: { v: "green", label: "Approved" },
    good: { v: "green", label: "Good" },
    fair: { v: "orange", label: "Fair" },
    poor: { v: "red", label: "Poor" },
    broken: { v: "red", label: "Broken" },
  };
  const found = entry[status];
  if (!found) return <Badge variant="gray">{status}</Badge>;
  return <Badge variant={found.v}>{found.label}</Badge>;
}
