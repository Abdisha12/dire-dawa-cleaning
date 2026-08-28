import * as React from "react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap justify-end gap-1">
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          aria-label={`Go to page ${p}`}
          aria-current={p === page ? "page" : undefined}
          onClick={() => onPage(p)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20",
            p === page
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--gray-100)]"
          )}
        >
          {p}
        </button>
      ))}
    </nav>
  );
}
