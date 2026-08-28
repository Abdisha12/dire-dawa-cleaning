import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--r-md)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mb-4 flex items-center justify-between border-b border-[var(--gray-100)] pb-3",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[0.95rem] font-semibold", className)} {...props} />;
}

export function StatCard({
  label,
  value,
  sub,
  accent = "green",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "green" | "orange" | "red" | "blue" | "purple";
}) {
  const border = {
    green: "border-l-[var(--success)]",
    orange: "border-l-[var(--warning)]",
    red: "border-l-[var(--danger)]",
    blue: "border-l-[var(--information)]",
    purple: "border-l-[#7c3aed]",
  }[accent];
  return (
    <div
      className={cn(
        "rounded-[var(--r-md)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] border-l-4",
        border
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}
