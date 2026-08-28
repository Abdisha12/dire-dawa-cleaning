import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  // Foundation placeholder — real data fetching in Phase 4
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#ddd6fe] bg-[#ede9fe] p-3 text-sm">
        🏷️ <strong>Foundation Shell</strong> — Dashboard context will be <strong>City → My Kebele → My Zone</strong> per Phase 2 §5. Data fetching via TanStack Query in next phase.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kebeles" value="9" sub="Dire Dawa" accent="blue" />
        <StatCard label="Safer Zones" value="108" sub="12 × 9" accent="purple" />
        <StatCard label="Active Workers" value="—" sub="via /api/workers" accent="green" />
        <StatCard label="Businesses" value="—" sub="via /api/businesses" accent="orange" />
      </div>

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
