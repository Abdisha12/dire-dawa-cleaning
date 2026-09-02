"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { fmtETB } from "@/lib/utils";
import Link from "next/link";

type ZoneLeaderboardRow = { zone_id: number; zone_name: string; total_collected: string; total_workers: number };

export default function PerformancePage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const role = user?.role;

  const [data, setData] = React.useState<{
    byKebele: { kebele: string; code: string; collected: string; target: string }[];
    zones?: ZoneLeaderboardRow[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const now = new Date();
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const baseParams: Record<string, string> = { year, month };
    if (role === "collector" && kebeleId) baseParams.kebeleId = String(kebeleId);

    Promise.all([
      api.getAnalyticsZones(baseParams, { signal: ctrl.signal }).catch(() => []),
      api.getDashboardSummary(baseParams, { signal: ctrl.signal }).catch(() => null),
    ]).then(([zones, dash]) => {
      const d = dash as { byKebele?: { kebele: string; code: string; collected: string; target: string }[] } | null;
      setData({
        byKebele: d?.byKebele || [],
        zones: (Array.isArray(zones) ? zones : []) as ZoneLeaderboardRow[],
      });
    }).catch((e) => {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "Failed to load");
    }).finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [year, month, role, kebeleId]);

  // No fabricated ranking formula. Only explicit dimensions from backend:
  // - collection total per kebele (if backend returns it)
  // - target vs actual achievement (only if both present)
  const hasTargets = (data?.byKebele || []).some((k) => k.target && Number(k.target) > 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-section">Performance</h1>
        <p className="text-sm text-[var(--text-muted)]">Operational performance view, city → kebele → zone, only for dimensions the existing backend exposes.
          {role === "collector" && kebeleId ? " — My Kebele" : role === "leader" ? " — Your Zone" : " — City-wide"}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
        <div className="flex gap-3 text-sm">
          <div>
            <label htmlFor="perf-year" className="text-xs font-semibold">Year</label>
            <input id="perf-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-sm w-[100px]" />
          </div>
          <div>
            <label htmlFor="perf-month" className="text-xs font-semibold">Month</label>
            <input id="perf-month" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-sm w-[80px]" />
          </div>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading && <div className="h-32 animate-pulse rounded bg-[var(--gray-100)]" />}

      {!loading && (
        <>
          <Card className="p-4">
            <h2 className="text-sm font-semibold">City → Kebele hierarchy</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Dire Dawa → 9 Kebeles → 108 Safer Zones. Use the kebele selector or Reports → Analytics to drill down.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.byKebele || []).length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">No data for this period.</div>
              ) : (
                (data?.byKebele || []).map((k, i) => (
                  <div key={i} className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-sm font-semibold">{k.kebele} <span className="text-[var(--text-muted)]">({k.code})</span></div>
                    <div className="mt-1 text-xs">Collected: <span className="font-bold">{fmtETB(k.collected)}</span></div>
                    {hasTargets && k.target && Number(k.target) > 0 ? (
                      <div className="text-xs">Target: {fmtETB(k.target)} · {((Number(k.collected) / Number(k.target)) * 100).toFixed(1)}%</div>
                    ) : null}
                    <div className="mt-2 flex gap-2 text-xs">
                      <Link href="/reports" className="text-[var(--primary)] underline">Reports</Link>
                      <Link href="/reports/analytics" className="text-[var(--primary)] underline">Analytics</Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {data?.zones && data.zones.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Safer Zone Ranking (by collected)</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Ranked strictly by collection_total from <code>GET /analytics/zones</code>. No composite formula fabricated.</p>
              <ol className="mt-3 space-y-1 text-sm">
                {data.zones
                  .slice()
                  .sort((a, b) => Number(b.total_collected) - Number(a.total_collected))
                  .map((z, i) => (
                    <li key={z.zone_id} className="flex items-center justify-between border-b border-[var(--border)] pb-1">
                      <span><span className="font-mono mr-2">{i + 1}.</span> {z.zone_name}</span>
                      <span className="font-mono">{fmtETB(z.total_collected)}</span>
                    </li>
                  ))}
              </ol>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
