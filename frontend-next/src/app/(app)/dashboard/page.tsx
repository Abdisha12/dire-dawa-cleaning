"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { api } from "@/lib/api";
import { KebeleSelector, KebeleSummary } from "@/features/kebeles/components/kebele-selector";
import type { Business } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const { selectedKebele, kebeles, loading: kebeleLoading, error: kebeleError } = useKebele();
  const role = user?.role;
  const contextLabel =
    role === "admin" ? "All Kebeles — City-wide" : role === "collector" ? "My Kebele — locked" : role === "leader" ? "My Safer Zone" : "—";

  // Kebeles count from the authoritative backend dataset (GET /api/kebeles).
  // The kebeles endpoint is NOT role-scoped: it returns the full municipal roster
  // (all authorized records K01–K09) for every authenticated role. KebeleProvider
  // already loads this set, so the KPI reuses kebeles.length — no new endpoint, no hardcode.
  const kebeleCount = kebeles.length;

  // Active workers count from backend, respecting role/kebele authorization.
  // Uses /workers?status=active which the backend filters by w.is_active=TRUE.
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
    // api.getWorkers already returns the flattened roster (Worker[]).
    api.getWorkers(baseParams, {}).then((res) => {
      setActiveWorkerCount(res.length);
    }).catch(() => {
      setActiveWorkerCount(null);
    }).finally(() => setActiveWorkerLoading(false));
  }, [role, selectedKebele?.id]);

  // Safer zones count from backend, respecting role/kebele authorization.
  // Uses /api/safer-zones which returns the authoritative zone records.
  // Admins see all safer zones across Dire Dawa; Kebele Admins see only their kebele's; Leaders see their zone.
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
    // api.getSaferZones already normalizes to { zones: SaferZone[] }.
    api.getSaferZones(baseParams, {}).then((res) => {
      const zones = (res.zones || []).filter((z) => (z as { is_active?: boolean }).is_active !== false);
      setSafeZoneCount(zones.length);
    }).catch(() => {
      setSafeZoneCount(null);
    }).finally(() => setSafeZoneLoading(false));
  }, [role, selectedKebele?.id]);

  // Businesses count from backend, respecting role/kebele authorization.
  // Uses /api/businesses?status=active which the backend filters by b.is_active=TRUE.
  // Admins see all active businesses; Kebele Admins see only their kebele's; Leaders see their zone.
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
    // Backend returns an array or paginated {data,total,page,pages} (or {businesses}).
    api.getBusinesses(baseParams, {}).then((res) => {
      const r = res as unknown as { businesses?: Business[]; data?: Business[] } | Business[];
      const arr: Business[] = Array.isArray(r) ? r : (r?.businesses || r?.data || []);
      setBusinessCount(arr.filter((b) => b.is_active !== false).length);
    }).catch(() => {
      setBusinessCount(null);
    }).finally(() => setBusinessLoading(false));
  }, [role, selectedKebele?.id]);

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
          {Array.from({ length: 9 }).map((_, i) => {
            const kebeleId = i + 1;
            const k = kebeles.find((k) => k.id === kebeleId);
            const kebeleName = k?.name || `Kebele ${String(i + 1).padStart(2, "0")}`;
            const kebeleCode = k?.code || `K${String(i + 1).padStart(2, "0")}`;
            const zoneCount = k?.zones_count !== undefined ? String(k.zones_count) : "Unavailable";

            return (
              <div key={i} className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-sm font-semibold">{kebeleName} — {kebeleCode}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">{zoneCount} Safer Zones</div>
                <div className="mt-1 text-xs">Workers: Unavailable</div>
                <div className="mt-1 text-xs">Payments: {/* paymentAch */}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">Worker counts from kebele context. Inspection % unavailable — no authoritative expected-inspection baseline exists.</p>
      </Card>
    </div>
  );
}
