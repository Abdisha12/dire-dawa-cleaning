"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return <div>{React.Children.map(children, (child) => {
    if (React.isValidElement(child)) return React.cloneElement(child as React.ReactElement<{ value: string; onValueChange: (v: string) => void }>, { value, onValueChange });
    return child;
  })}</div>;
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={cn("flex gap-1 border-b border-[var(--border)]", className)} {...props} />;
}

export function TabsTrigger({
  value,
  current,
  onSelect,
  children,
}: {
  value: string;
  current: string;
  onSelect: (v: string) => void;
  children: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(value);
        }
      }}
      className={cn(
        "border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-none",
        active ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ when, current, children }: { when: string; current: string; children: React.ReactNode }) {
  if (when !== current) return null;
  return (
    <div role="tabpanel" className="pt-4">
      {children}
    </div>
  );
}
