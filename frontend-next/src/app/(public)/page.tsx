"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function PublicLanding() {
  const [stats, setStats] = useState<{ kebeles: number; zones: number; workers: number; businesses: number } | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPublicStats()
      .then(setStats)
      .catch((e) => setStatsError(e instanceof Error ? e.message : "Stats unavailable"));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <div className="flex items-center gap-2 font-extrabold">
            <span className="grid h-8 w-8 place-items-center rounded bg-[var(--primary)] text-white" aria-hidden>
              🧹
            </span>
            <span>Dire Dawa Cleaning Department</span>
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

      <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="inline-block rounded-full bg-[var(--information-l)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
              Official Municipal System · 9 Kebeles
            </div>
            <h1 className="text-hero mt-4">Dire Dawa Cleaning Operations</h1>
            <p className="mt-3 max-w-xl text-[var(--text-muted)]">
              Ensuring cleanliness and public service across Dire Dawa’s 9 kebeles and 108 safer zones. Workers, inspections, payments and reports — managed transparently for the city.
            </p>
            <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)]">
              Service overview: daily inspections, worker attendance, business fee collection, zone reporting and operational oversight — role-scoped for Admin, Kebele Admin and Zone Leaders.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login">
                <Button>Sign in to operations →</Button>
              </Link>
              <a href="/frontend" className="inline-flex items-center text-sm font-medium text-[var(--text-muted)] hover:text-[var(--primary)]">
                Legacy frontend
              </a>
            </div>

            {/* 9-kebele context — visual, not filter */}
            <div className="mt-8">
              <h2 className="text-card-title">9 Kebeles — operational boundary</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {["K01", "K02", "K03", "K04", "K05", "K06", "K07", "K08", "K09"].map((c) => (
                  <div key={c} className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-center text-xs font-semibold">
                    {c}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">Each kebele contains 12 safer zones. Kebele Admin sees only their assigned kebele.</p>
            </div>
          </div>

          <Card className="flex flex-col gap-4">
            <h3 className="text-card-title">Live system overview</h3>
            {stats ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded bg-[var(--gray-50)] p-3">
                  <div className="text-label">Kebeles</div>
                  <div className="text-numerical">{stats.kebeles}</div>
                </div>
                <div className="rounded bg-[var(--gray-50)] p-3">
                  <div className="text-label">Safer Zones</div>
                  <div className="text-numerical">{stats.zones}</div>
                </div>
                <div className="rounded bg-[var(--gray-50)] p-3">
                  <div className="text-label">Workers</div>
                  <div className="text-numerical">{stats.workers}</div>
                </div>
                <div className="rounded bg-[var(--gray-50)] p-3">
                  <div className="text-label">Businesses</div>
                  <div className="text-numerical">{stats.businesses}</div>
                </div>
              </div>
            ) : statsError ? (
              <p className="text-sm text-[var(--text-muted)]" role="status">
                Live stats unavailable — {statsError}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-muted)]" aria-busy="true">
                Loading live stats from <code className="rounded bg-[var(--gray-100)] px-1">/api/public/stats</code>…
              </p>
            )}
            <p className="text-xs text-[var(--text-muted)]">Stats from existing API, not invented. Foundation shell / tokens / API client ready.</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
              <li>
                New: <code>frontend-next/</code> (Next.js + TS) coexists with <code>frontend/</code>
              </li>
              <li>Design tokens `styles/tokens.css` central</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}
