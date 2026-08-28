"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center" role="alert">
      <h2 className="text-lg font-semibold text-[var(--danger)]">Something went wrong</h2>
      <p className="mt-1 max-w-md text-sm text-[var(--text-muted)]">{error.message || "Unexpected error"}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-d)]"
      >
        Retry
      </button>
    </div>
  );
}
