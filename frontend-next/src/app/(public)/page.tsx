import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PublicLanding() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <div className="flex items-center gap-2 font-extrabold">
            <span className="text-xl">🧹</span> Dire Dawa Cleaning
          </div>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/login" className="font-medium text-[var(--text-muted)] hover:text-[var(--primary)]">
              Sign in
            </Link>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="inline-block rounded-full bg-[var(--information-l)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
            Official Municipal System
          </div>
          <h1 className="mt-4 bg-gradient-to-r from-[var(--primary)] to-[#7c3aed] bg-clip-text text-4xl font-extrabold leading-tight text-transparent">
            Dire Dawa Cleaning Operations Platform
          </h1>
          <p className="mt-4 max-w-xl text-[var(--text-muted)]">
            9 kebeles · 108 safer zones · workers, inspections, payments, and reports. New Next.js foundation (Phase 3) alongside the intact Vanilla JS frontend at{" "}
            <code className="rounded bg-[var(--gray-100)] px-1">/frontend</code>.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/login">
              <Button>Go to operations →</Button>
            </Link>
            <a href="/frontend/" target="_blank" rel="noreferrer">
              <Button variant="outline">Legacy frontend</Button>
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
            <span className="rounded bg-[var(--gray-100)] px-2 py-1 font-semibold">Dire Dawa</span> →
            <span className="rounded bg-[var(--gray-100)] px-2 py-1 font-semibold">9 Kebeles</span> →
            <span className="rounded bg-[var(--gray-100)] px-2 py-1 font-semibold">108 Zones</span> →
            <span className="rounded bg-[var(--gray-100)] px-2 py-1 font-semibold">Operations</span>
          </div>
        </div>
        <Card className="flex min-h-[280px] flex-col justify-center">
          <h3 className="font-semibold">Phase 3 Foundation</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Design tokens, shell (245px sidebar + 60px top/bottom), role-aware nav, API client `x-session-token`, loading/error/not-found.</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
            <li> Tokens: `src/styles/tokens.css` central</li>
            <li> Shell: `components/layout/shell.tsx` responsive</li>
            <li> Auth: `lib/auth.ts` + `lib/api.ts`</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
