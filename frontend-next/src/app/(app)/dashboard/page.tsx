"use client";

import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KebeleSelector, KebeleSummary } from "@/features/kebeles/components/kebele-selector";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";

export default function DashboardPage() {
  const { user } = useAuth();
  const { selectedKebele } = useKebele();
  const role = user?.role;
  const contextLabel =
    role === "admin" ? "All Kebeles — City-wide" : role === "collector" ? "My Kebele — locked" : role === "leader" ? "My Safer Zone" : "—";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-[#ddd6fe] bg-[#ede9fe] p-3">
        <div className="text-sm">
          <strong>Operational Context:</strong> {contextLabel} {selectedKebele ? `· ${selectedKebele.name}` : ""}
          <div className="text-xs text-[var(--text-muted)]">Backend is authoritative — selector is UX only (kebeles.collector_id / zone.leader_id).</div>
        </div>
        <div className="min-w-[260px] flex-1 max-w-sm">
          <KebeleSelector />
        </div>
      </div>
      <KebeleSummary />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kebeles" value="9" sub="Dire Dawa" accent="blue" />
        <StatCard label="Safer Zones" value="108" sub="12 × 9" accent="purple" />
        <StatCard label="Active Workers" value="—" sub="via /api/workers" accent="green" />
        <StatCard label="Businesses" value="—" sub="via /api/businesses" accent="orange" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational overview</CardTitle>
          <Badge variant="blue">Placeholder — charts later</Badge>
        </CardHeader>
        {/* Skeletons for future dashboard charts — not migrated yet */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-label">Monthly revenue (future chart)</div>
            <div className="h-32 rounded bg-[var(--gray-100)] animate-pulse" aria-hidden />
          </div>
          <div className="space-y-2">
            <div className="text-label">Attendance (future)</div>
            <div className="h-32 rounded bg-[var(--gray-100)] animate-pulse" aria-hidden />
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">Charts and detailed statistics will be migrated in a later phase. Backend remains authoritative.</p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>9-Kebele Overview (admin)</CardTitle>
          <Badge variant="blue">City-wide</Badge>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-sm font-semibold">Kebele {String(i + 1).padStart(2, "0")} — K{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">12 zones · collector —</div>
              <div className="mt-2 h-2 rounded-full bg-[var(--gray-100)]">
                <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${20 + i * 7}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">Phase 2 §6: compare worker counts, inspection %, payment achievement.</p>
      </Card>
    </div>
  );
}
