"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { api, type DashboardOverview } from "@/lib/api";
import { KebeleSelector, KebeleSummary } from "@/features/kebeles/components/kebele-selector";
import { fmtETB, monthName } from "@/lib/utils";
import type { Business } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const { selectedKebele, kebeles, loading: kebeleLoading, error: kebeleError } = useKebele();
  const role = user?.role;
  const contextLabel =
    role === "admin" ? "All Kebeles — City-wide" : role === "collector" ? "My Kebele — locked" : role === "leader" ? "My Safer Zone" : "—";

  // Kebeles count from the authoritative backend dataset (GET /api/kebeles).
  const kebeleCount = kebeles.length;

  // Active workers count from backend, respecting role/kebele authorization.
  const [activeWorkerCount, setActiveWorkerCount] = React.useState<number | null>(null);
  const [activeWorkerLoading, setActiveWorkerLoading] = React.useState(true);
  const [activeWorkerError, setActiveWorkerError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const baseParams: Record<string, string> = { status: "active" };
    if (role === "admin") {
      // Admin: all active workers across all kebeles — no kebeleId filter
    } else if (role === "collector" && selectedKebele?.id) {
      // Kebele Admin: only active workers in their assigned kebele
      baseParams.kebeleId = String(selectedKebele.id);
    } else if (role === "leader") {
      // Leader: only active workers in their authorized zone
      if (selectedKebele?.id) baseParams.kebeleId = String(selectedKebele.id);
    }
    api.getWorkers(baseParams, {}).then((res) => {
      setActiveWorkerCount(res.length);
    }).catch(() => {
      setActiveWorkerCount(null);
    }).finally(() => setActiveWorkerLoading(false));
  }, [role, selectedKebele?.id]);

  // Safer zones count from backend, respecting role/kebele authorization.
  const [safeZoneCount, setSafeZoneCount] = React.useState<number | null>(null);
  const [safeZoneLoading, setSafeZoneLoading] = React.useState(true);
  const [safeZoneError, setSafeZoneError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const baseParams: Record<string, string> = {};
    if (role === "admin") {
      // Admin: all safer zones across Dire Dawa — no filter
    } else if (role === "collector" && selectedKebele?.id) {
      // Kebele Admin: only safer zones in their assigned kebele
      baseParams.kebeleId = String(selectedKebele.id);
    } else if (role === "leader") {
      // Leader: only safer zones in their authorized zone
      if (selectedKebele?.id) baseParams.kebeleId = String(selectedKebele.id);
    }
    api.getSaferZones(baseParams, {}).then((res) => {
      const zones = (res.zones || []).filter((z) => (z as { is_active?: boolean }).is_active !== false);
      setSafeZoneCount(zones.length);
    }).catch(() => {
      setSafeZoneCount(null);
    }).finally(() => setSafeZoneLoading(false));
  }, [role, selectedKebele?.id]);

  // Businesses count from backend, respecting role/kebele authorization.
  const [businessCount, setBusinessCount] = React.useState<number | null>(null);
  const [businessLoading, setBusinessLoading] = React.useState(true);
  const [businessError, setBusinessError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const baseParams: Record<string, string> = { status: "active" };
    if (role === "admin") {
      // Admin: all active businesses across Dire Dawa — no kebeleId filter
    } else if (role === "collector" && selectedKebele?.id) {
      // Kebele Admin: only active businesses in their assigned kebele
      baseParams.kebeleId = String(selectedKebele.id);
    } else if (role === "leader") {
      // Leader: only active businesses in their authorized zone
      if (selectedKebele?.id) baseParams.kebeleId = String(selectedKebele.id);
    }
    api.getBusinesses(baseParams, {}).then((res) => {
      const r = res as unknown as { businesses?: Business[]; data?: Business[] } | Business[];
      const arr: Business[] = Array.isArray(r) ? r : (r?.businesses || r?.data || []);
      setBusinessCount(arr.filter((b) => b.is_active !== false).length);
    }).catch(() => {
      setBusinessCount(null);
    }).finally(() => setBusinessLoading(false));
  }, [role, selectedKebele?.id]);

  // Operational overview — single role-scoped backend aggregation.
  // The server scopes by the authenticated user (admin=city, collector=kebele, leader=zone),
  // so the client never constructs or guesses its own scope.
  const [overview, setOverview] = React.useState<DashboardOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = React.useState(true);
  const [overviewError, setOverviewError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const ctrl = new AbortController();
    setOverviewLoading(true);
    setOverviewError(null);
    api.getDashboardOverview({}, { signal: ctrl.signal })
      .then((res) => setOverview(res))
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setOverviewError(e instanceof Error ? e.message : "Failed to load operational overview");
      })
      .finally(() => setOverviewLoading(false));
    return () => ctrl.abort();
  }, []);

  const comparisonTitle =
    role === "admin" || role === "viewer"
      ? "9-Kebele Operational Comparison"
      : role === "collector"
        ? "Kebele Operational Overview"
        : "My Kebele — Operational Overview";
  const comparisonBadge =
    role === "admin" || role === "viewer" ? "City-wide" : role === "collector" ? "My Kebele" : "My Safer Zone";

  type KebeleRow = DashboardOverview["kebeles"][number];
  const comparisonColumns: Column<KebeleRow>[] = [
    { key: "name", header: "Kebele", priority: 1, render: (k) => `${k.name} — ${k.code}` },
    { key: "zones", header: "Zones", priority: 2, render: (k) => k.zones },
    { key: "workers", header: "Workers", priority: 2, render: (k) => k.workerCount },
    { key: "businesses", header: "Businesses", priority: 2, render: (k) => k.businessCount },
    { key: "collected", header: "Collected", priority: 1, render: (k) => fmtETB(k.collected) },
    ...(overview && overview.kebeles.some((k) => k.target !== null && k.target !== "") ? [
      {
        key: "achievement",
        header: "Achievement %",
        priority: 2,
        render: (k: KebeleRow) => (k.achievementPct !== null ? `${k.achievementPct.toFixed(1)}%` : "—"),
      },
    ] as Column<KebeleRow>[] : []),
    {
      key: "attendance",
      header: "Attendance %",
      priority: 2,
      render: (k: KebeleRow) => (k.attendanceRate !== null ? `${k.attendanceRate.toFixed(1)}%` : "—"),
    },
    { key: "inspections", header: "Inspections", priority: 2, render: (k) => k.inspectionTotal },
  ];

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
        <StatCard label="Kebeles" value={kebeleLoading ? "—" : kebeleError ? "—" : String(kebeleCount)} sub={kebeleLoading ? "Loading…" : kebeleError ? "Unavailable" : "Dire Dawa"} accent="blue" />
        <StatCard label="Safer Zones" value={safeZoneCount ?? "—"} sub={safeZoneLoading ? "Loading…" : safeZoneError ? "Unavailable" : "via /api/safer-zones"} accent="purple" />
        <StatCard label="Active Workers" value={activeWorkerCount ?? "—"} sub={activeWorkerLoading ? "Loading…" : activeWorkerError ? "Unavailable" : "via /api/workers"} accent="green" />
        <StatCard label="Businesses" value={businessCount ?? "—"} sub={businessLoading ? "Loading…" : businessError ? "Unavailable" : "via /api/businesses"} accent="orange" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational overview</CardTitle>
          <Badge variant="blue">{comparisonBadge}</Badge>
        </CardHeader>
        {overviewLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-[var(--r-md)] bg-[var(--gray-100)]" />)}
          </div>
        ) : overviewError ? (
          <Alert variant="danger">{overviewError}</Alert>
        ) : overview ? (
          <div className="space-y-5">
            <section aria-label="Revenue overview">
              <h3 className="text-sm font-semibold">Revenue</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Collected" value={fmtETB(overview.revenue.totalCollected)} sub="Paid" accent="green" />
                <StatCard label="Pending" value={fmtETB(overview.revenue.totalPending)} sub="Awaiting" accent="orange" />
                <StatCard label="Overdue" value={fmtETB(overview.revenue.totalOverdue)} sub="Overdue" accent="red" />
                <StatCard
                  label="Target"
                  value={overview.revenue.target !== null ? fmtETB(overview.revenue.target) : "—"}
                  sub={overview.revenue.achievementPct !== null ? `Achievement ${overview.revenue.achievementPct.toFixed(1)}%` : "No target data"}
                  accent="blue"
                />
              </div>

              <div className="mt-4">
                <div className="text-label">Monthly collection trend</div>
                <div className="mt-2" aria-hidden>
                  {overview.revenue.monthly.length > 0 ? (
                    <div className="flex h-32 items-end gap-1">
                      {(() => {
                        const max = Math.max(1, ...overview.revenue.monthly.map((t) => Number(t.collected || 0)));
                        return overview.revenue.monthly.map((t) => {
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
                  <p className="mt-1 text-[var(--text-muted)]" role="region" aria-live="polite">
                    {overview.revenue.monthly.map((t) => `${monthName(t.month)}: ${fmtETB(t.collected)}`).join(" · ") || "No data"}
                  </p>
                </details>
              </div>
            </section>

            <section aria-label="Attendance overview">
              <h3 className="text-sm font-semibold">Attendance</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Present" value={overview.attendance.presentCount} sub="Worker-days" accent="green" />
                <StatCard label="Absent" value={overview.attendance.absentCount} sub="Worker-days" accent="red" />
                <StatCard
                  label="Attendance rate"
                  value={overview.attendance.attendanceRate !== null ? `${overview.attendance.attendanceRate}%` : "No data"}
                  sub={overview.attendance.attendanceRate !== null ? `${overview.attendance.totalRecords} records` : "No attendance records this period"}
                  accent="blue"
                />
              </div>
            </section>

            <section aria-label="Inspection overview">
              <h3 className="text-sm font-semibold">Inspections</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Inspections" value={overview.inspections.total} sub="This period" accent="blue" />
                <StatCard label="Active" value={overview.inspections.active} sub="Clean" accent="green" />
                <StatCard label="Warning" value={overview.inspections.warning} sub="Needs attention" accent="orange" />
                <StatCard label="Danger" value={overview.inspections.danger} sub="Critical" accent="red" />
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Inspection counts are real. An expected-vs-actual inspection % is not computed — no authoritative baseline exists.
              </p>
            </section>
          </div>
        ) : null}
      </Card>

      {!overviewLoading && !overviewError && overview && (
        <Card>
          <CardHeader>
            <CardTitle>{comparisonTitle}</CardTitle>
            <Badge variant="blue">{comparisonBadge}</Badge>
          </CardHeader>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            Real per-kebele data from <code>/api/dashboard/overview</code>. Achievement % shown only where a monthly target exists; attendance % only where records exist — never fabricated.
          </p>
          <DataTable
            columns={comparisonColumns as Column<Record<string, unknown>>[]}
            data={overview.kebeles as unknown as Record<string, unknown>[]}
            loading={false}
            ariaLabel={comparisonTitle}
            emptyTitle="No kebele data"
            emptyDescription="Backend returned no kebele rows for your scope."
            getRowKey={(r: Record<string, unknown>, i: number) => String(r.id ?? i)}
          />
        </Card>
      )}
    </div>
  );
}