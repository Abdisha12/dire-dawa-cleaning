import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded bg-[var(--gray-100)]", className)}
      aria-hidden
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-[var(--r-md)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
