import * as React from "react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]",
        className
      )}
      aria-label="Loading"
    />
  );
}

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 p-8 text-sm text-[var(--text-muted)]"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner /> {message}
    </div>
  );
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-[var(--text-muted)]">
      <div className="mb-3 text-4xl" aria-hidden>
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center" role="alert">
      <p className="text-sm text-[var(--danger)]">⚠️ {message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm hover:bg-[var(--gray-100)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}
