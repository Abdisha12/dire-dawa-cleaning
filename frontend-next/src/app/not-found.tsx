import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="text-4xl">🚧</div>
      <h2 className="mt-3 text-lg font-semibold">Page not found</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">The municipal page you’re looking for doesn’t exist.</p>
      <Link href="/dashboard" className="mt-4 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">
        Back to dashboard
      </Link>
    </div>
  );
}
