"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { api } from "@/lib/api";
import { Card, StatCard } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert } from "@/components/ui/alert";
import { Icons } from "@/components/ui/icon";
import { fmtETB, monthName } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const role = user?.role;
  const router = useRouter();

  const now = new Date();
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [, setKebeles] = React.useState<{ id: number; name: string; code: string }[]>([]);
  const [dashboard, setDashboard] = React.useState<{ totals: { total_collected: string; total_pending: string; total_overdue: string }; byKebele: { kebele: string; code: string; collected: string; target: string }[]; monthly: { month: number; collected: string }[] } | null>(null);
  const [trends, setTrends] = React.useState<{ month: number; collected: string }[]>([]);
  const [kebeleCompare, setKebeleCompare] = React.useState<{ kebele: string; code: string; collected: string; target: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.getKebeles({}).then((r) => {
      const list = Array.isArray(r) ? r : (r as { kebeles: { id: number; name: string; code: string }[] }).kebeles || [];
      setKebeles(list);
    }).catch(() => {});
  }, []);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    try {
      // Collect target: dashboard endpoint (kebele & month scoped) is the most authoritative; falls back to trends
      const baseParams: Record<string, string> = { year };
      if (role === "collector" && kebeleId) baseParams.kebeleId = String(kebeleId);

      const [dashRes, trendsRes] = await Promise.all([
        api.getDashboardSummary(baseParams, { signal: ctrl.signal }).catch(() => null),
        api.getAnalyticsTrends(baseParams, { signal: ctrl.signal }).catch(() => []),
      ]);
      if (dashRes) {
        const d = dashRes as { totals: { total_collected: string; total_pending: string; total_overdue: string }; byKebele: { kebele: string; code: string; collected: string; target: string }[]; monthly: { month: number; collected: string }[] };
        setDashboard(d);
        setKebeleCompare(d.byKebele || []);
        setTrends(d.monthly || []);
      } else {
        setKebeleCompare([]);
        setDashboard(null);
        setTrends(Array.isArray(trendsRes) ? (trendsRes as { month: number; collected: string }[]) : []);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [year, role, kebeleId]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // No fake target/achievement: only display what backend exposes.
  // Achievement is shown ONLY when both `collected` and `target` are non-null from dashboard.
  const hasTargets = kebeleCompare.some((k) => k.target !== null && k.target !== undefined && k.target !== "");

  const compareColumns: Column<typeof kebeleCompare[number]>[] = [
    { key: "kebele", header: "Kebele", render: (k) => k.kebele },
    { key: "code", header: "Code", render: (k) => k.code || "—" },
    { key: "collected", header: "Collected", render: (k) => fmtETB(k.collected) },
    ...(hasTargets ? [
      { key: "target", header: "Target", render: (k: typeof kebeleCompare[number]) => fmtETB(k.target) },
      {
        key: "achievement",
        header: "Achievement %",
        render: (k: typeof kebeleCompare[number]) => {
          const t = Number(k.target);
          const c = Number(k.collected);
          if (!isFinite(t) || t <= 0) return "—";
          const pct = (c / t) * 100;
          return `${pct.toFixed(1)}%`;
        },
      },
    ] as Column<typeof kebeleCompare[number]>[] : []),
  ];

  // Accessible text alternative for trend chart
  const trendText = trends.map((t) => `${monthName(t.month)}: ${fmtETB(t.collected)}`).join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-section">Analytics</h1>
          <p className="text-sm text-[var(--text-muted)]">Trends and comparisons from existing backend APIs.
            {role === "collector" && kebeleId ? " — My Kebele" : role === "leader" ? " — Your Zone" : " — City-wide"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/reports")} aria-label="Open Reports"><Icons.receipt size={16} /> Reports</Button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="ana-year">Year</Label>
            <input id="ana-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm w-[100px]" aria-label="Analytics year" />
          </div>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0,1,2,3].map((i) => <div key={i} className="h-24 animate-pulse rounded-[var(--r-md)] bg-[var(--gray-100)]" />)}
        </div>
      ) : (
        <>
          {dashboard ? (
            <section aria-label="Summary KPI">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Collected" value={fmtETB(dashboard.totals.total_collected)} sub="Paid" accent="green" />
                <StatCard label="Pending" value={fmtETB(dashboard.totals.total_pending)} sub="Awaiting" accent="orange" />
                <StatCard label="Overdue" value={fmtETB(dashboard.totals.total_overdue)} sub="Overdue" accent="red" />
                <StatCard label="Kebeles" value={kebeleCompare.length} sub="With data" accent="blue" />
              </div>
            </section>
          ) : (
            <Alert>Dashboard summary unavailable for this period. No data shown rather than fabricated.</Alert>
          )}

          {/* Trend chart with text alternative */}
          <section aria-label="Monthly Collection Trend">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Monthly Collection Trend</h2>
                <span className="text-xs text-[var(--text-muted)]">{trends.length} months</span>
              </div>
              <div className="mt-3" aria-hidden>
                {trends.length > 0 ? (
                  <div className="flex h-32 items-end gap-1">
                    {(() => {
                      const max = Math.max(1, ...trends.map((t) => Number(t.collected || 0)));
                      return trends.map((t) => {
                        const h = (Number(t.collected || 0) / max) * 100;
                        return (
                          <div key={t.month} className="flex flex-1 flex-col items-center">
                            <div className="w-full rounded-t bg-[var(--primary)]" style={{ height: `${h}%` }} title={`${monthName(t.month)}: ${fmtETB(t.collected)}`} />
                            <span className="mt-1 text-[10px] text-[var(--text-muted)]">{monthName(t.month)}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No monthly data available.</p>
                )}
              </div>
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-[var(--text-muted)]">Text alternative</summary>
                <p className="mt-1 text-[var(--text-muted)]" role="region" aria-live="polite">{trendText || "No data"}</p>
              </details>
            </Card>
          </section>

          {/* 9-Kebele comparison */}
          <section aria-label="9-Kebele Comparison">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">9-Kebele Comparison</h2>
                <span className="text-xs text-[var(--text-muted)]">{kebeleCompare.length} kebeles</span>
              </div>
              {hasTargets ? (
                <p className="mt-1 text-xs text-[var(--text-muted)]">Target and achievement shown only for kebeles with available target data.</p>
              ) : (
                <p className="mt-1 text-xs text-[var(--text-muted)]">No target data available — only collected shown. No achievement % fabricated.</p>
              )}
              <div className="mt-3">
                <DataTable
                  columns={compareColumns as Column<Record<string, unknown>>[]}
                  data={kebeleCompare as unknown as Record<string, unknown>[]}
                  loading={false}
                  emptyTitle="No kebele data"
                  emptyDescription="Backend returned no byKebele rows for this period."
                  getRowKey={(_r: Record<string, unknown>, i: number) => String(i)}
                />
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
