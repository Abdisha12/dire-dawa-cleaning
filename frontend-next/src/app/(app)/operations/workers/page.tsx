"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { workersApi, addETB } from "@/features/workers/services/workers-api";
import type { Worker, SaferZone } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { fmtETB, fmtDate, formatFaydaId } from "@/lib/utils";
import { WorkerCard } from "@/features/workers/components/worker-card";

// TanStack Query keys (item 28) — server-state caching, dedupe, invalidation
const zonesKey = ["zones"] as const;

// Lazy-load heavy dialogs (item 34) so their code is only fetched when opened
const WorkerFormModal = React.lazy(() =>
  import("@/features/workers/components/worker-dialogs").then((m) => ({ default: m.WorkerFormModal }))
);
const BulkAttendanceModal = React.lazy(() =>
  import("@/features/workers/components/worker-dialogs").then((m) => ({ default: m.BulkAttendanceModal }))
);
const AttendanceModal = React.lazy(() =>
  import("@/features/workers/components/worker-dialogs").then((m) => ({ default: m.AttendanceModal }))
);
const SalaryModal = React.lazy(() =>
  import("@/features/workers/components/worker-dialogs").then((m) => ({ default: m.SalaryModal }))
);
const IdCardModal = React.lazy(() =>
  import("@/features/workers/components/worker-dialogs").then((m) => ({ default: m.IdCardModal }))
);
const WorkerDetailsDrawer = React.lazy(() =>
  import("@/features/workers/components/worker-dialogs").then((m) => ({ default: m.WorkerDetailsDrawer }))
);

const DialogFallback = () => <div className="p-4 text-sm text-[var(--text-muted)]">Loading…</div>;

export default function WorkersPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const { toast } = useToast();
  const role = user?.role;
  const zone = user?.zone as SaferZone | null | undefined;
  const canEdit = role === "admin" || role === "collector" || role === "leader";
  const isAdmin = role === "admin" || role === "collector";

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [zoneFilter, setZoneFilter] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>(""); // active | inactive | ""
  const [kebeleFilter, setKebeleFilter] = React.useState<string>(() => (kebeleId ? String(kebeleId) : ""));
  const [page, setPage] = React.useState(1);
  const limit = 25;

  // Modals
  const [editing, setEditing] = React.useState<Worker | null>(null);
  const [showWorkerModal, setShowWorkerModal] = React.useState(false);
  const [showBulk, setShowBulk] = React.useState(false);
  const [attendWorker, setAttendWorker] = React.useState<Worker | null>(null);
  const [salaryWorker, setSalaryWorker] = React.useState<Worker | null>(null);
  const [idCardWorker, setIdCardWorker] = React.useState<Worker | null>(null);
  const [detailWorker, setDetailWorker] = React.useState<Worker | null>(null);

  const queryClient = useQueryClient();

  // Zones — GET /safer-zones singleton (item 28): cached, deduped, keyed
  const { data: zones = [] } = useQuery({
    queryKey: [...zonesKey],
    queryFn: () => workersApi.getZones(),
    staleTime: 300_000,
  });

  // Workers — server page query keyed by every filter + page (item 28)
  const workerParams = React.useMemo(() => {
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter;
    if (kebeleFilter) params.kebeleId = kebeleFilter;
    if (zoneFilter) params.zoneId = zoneFilter;
    return params;
  }, [page, limit, debouncedSearch, statusFilter, kebeleFilter, zoneFilter]);

  const workersQuery = useQuery({
    queryKey: ["workers", workerParams],
    queryFn: () => workersApi.getAll(workerParams),
    placeholderData: (prev) => prev,
  });
  const workers: Worker[] = (workersQuery.data
    ? (Array.isArray(workersQuery.data) ? workersQuery.data : (workersQuery.data as { data: Worker[] }).data || [])
    : []
  ).map((r) => {
    if (r.custom_attributes && typeof r.custom_attributes === "string") {
      try {
        return { ...r, custom_attributes: JSON.parse(r.custom_attributes as unknown as string) };
      } catch {
        return r;
      }
    }
    return r;
  });
  const meta = Array.isArray(workersQuery.data)
    ? { total: workers.length, pages: 1 }
    : (workersQuery.data as { total: number; pages: number; page: number } | undefined) || { total: workers.length, pages: 1 };
  const total = meta.total;
  const pages = meta.pages;
  const loading = workersQuery.isLoading;
  const error = workersQuery.isError ? (workersQuery.error instanceof Error ? workersQuery.error.message : "Failed to load") : null;

  // Summary — active/inactive counts + total wage (item 28)
  const { data: summary = null } = useQuery({
    queryKey: ["workers-summary", workerParams],
    queryFn: async () => {
      const activeParams = { ...workerParams, status: "active", page: "1", limit: "1" };
      const inactiveParams = { ...workerParams, status: "inactive", page: "1", limit: "1" };
      const [activeRes, inactiveRes] = await Promise.all([
        workersApi.getAll(activeParams).catch(() => ({ total: 0 } as unknown as Worker[])),
        workersApi.getAll(inactiveParams).catch(() => ({ total: 0 } as unknown as Worker[])),
      ]);
      const activeTotal = Array.isArray(activeRes) ? (activeRes as Worker[]).length : (activeRes as { total: number }).total || 0;
      const inactiveTotal = Array.isArray(inactiveRes) ? (inactiveRes as Worker[]).length : (inactiveRes as { total: number }).total || 0;
      const wage = workers.filter((w) => w.is_active).reduce((s, w) => addETB(s, Number(w.daily_wage)), 0);
      return { total, active: activeTotal, inactive: inactiveTotal, totalWage: wage };
    },
    enabled: !!workersQuery.data,
  });
  const stats = summary || { total: workers.length, active: workers.filter((w) => w.is_active).length, inactive: workers.filter((w) => !w.is_active).length, totalWage: workers.filter((w) => w.is_active).reduce((s, w) => s + Number(w.daily_wage), 0) };

  const refetchWorkers = () => queryClient.invalidateQueries({ queryKey: ["workers"] });

  // Mutations (item 28)
  const deleteMutation = useMutation({
    mutationFn: (id: number) => workersApi.delete(id),
    onSuccess: () => {
      toast("Worker deleted", "success");
      refetchWorkers();
      queryClient.invalidateQueries({ queryKey: ["workers-summary"] });
    },
    onError: (e: Error) => toast(e.message || "Delete failed", "error"),
  });

  const handleDelete = React.useCallback(
    (id: number) => {
      if (!confirm("Delete this worker and all records?")) return;
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  // For collector: filter zones to their kebele (client side, backend also enforces)
  const visibleZones = React.useMemo(() => {
    if (role === "leader" && zone) return zones.filter((z) => z.id === zone.id);
    if (role === "collector" && kebeleId) return zones.filter((z) => z.kebele_id === kebeleId);
    if (kebeleFilter) return zones.filter((z) => String(z.kebele_id) === kebeleFilter);
    return zones;
  }, [zones, role, zone, kebeleId, kebeleFilter]);

  // Debounce search 300ms + reset page
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Keep kebeleFilter in sync with context for Admin (All Kebeles), locked for collector
  React.useEffect(() => {
    if (kebeleId) setKebeleFilter(String(kebeleId));
  }, [kebeleId, role]);

  const columns: Column<Worker>[] = [
    {
      key: "full_name",
      header: "Name",
      render: (w) => <strong>{w.full_name}</strong>,
    },
    { key: "contact", header: "Contact", render: (w) => w.contact || "—" },
    {
      key: "fayda_id",
      header: "Fayda/ID",
      render: (w) => (w.fayda_id ? formatFaydaId(w.fayda_id) : "—"),
    },
    {
      key: "zone_name",
      header: "Zone",
      render: (w) => (w.zone_name ? <Badge variant="purple">{w.zone_name}</Badge> : "—"),
    },
    {
      key: "daily_wage",
      header: "Daily Wage",
      render: (w) => `${fmtETB(w.daily_wage)}/day`,
    },
    {
      key: "is_active",
      header: "Status",
      render: (w) => (w.is_active ? <StatusBadge status="active" /> : <Badge variant="gray">Inactive</Badge>),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Workers Management</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Daily-wage roster {role === "collector" && kebeleId ? "— My Kebele" : role === "leader" && zone ? `— ${zone.name}` : "— City-wide"}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulk(true)}>
              <Icons.bulkAttendance size={18} /> Bulk Attendance
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setShowWorkerModal(true);
              }}
            >
              ＋ Add Worker
            </Button>
          </div>
        )}
      </div>

      {/* Workforce summary — respects scope, API-supported only */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={stats.total} sub="Workers in scope" accent="blue" />
        <StatCard label="Active" value={stats.active} sub="is_active=true" accent="green" />
        <StatCard label="Inactive" value={stats.inactive} sub="is_active=false" accent="orange" />
        <StatCard label="Daily Wage Total" value={fmtETB(stats.totalWage)} sub="Active workers" accent="purple" />
      </div>

      {/* Reusable filter system — role-aware */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        {/* Kebele — Admin can select, Kebele Admin locked, Leader read-only */}
        {role === "admin" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="f-kebele">Kebele</Label>
            <Select
              id="f-kebele"
              value={kebeleFilter}
              onChange={(e) => { setKebeleFilter(e.target.value); setZoneFilter(""); setPage(1); }}
              className="w-[160px]"
              aria-label="Filter by kebele"
            >
              <option value="">All Kebeles</option>
              {/* Use actual kebele records? Derive from zones' kebele_name uniqueness */}
              {Array.from(new Map(zones.map((z) => [z.kebele_id, z.kebele_name])).entries()).map(([id, name]) => (
                <option key={String(id)} value={String(id)}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {role === "collector" && kebeleId && (
          <div className="flex flex-col gap-1">
            <Label>Kebele</Label>
            <div className="rounded bg-[var(--information-l)] px-3 py-2 text-sm font-medium text-[var(--primary)]">My Kebele — locked</div>
          </div>
        )}
        {role !== "leader" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="f-zone">Safer Zone</Label>
            <Select
              id="f-zone"
              value={zoneFilter}
              onChange={(e) => { setZoneFilter(e.target.value); setPage(1); }}
              className="w-[200px]"
              aria-label="Filter by zone"
            >
              <option value="">All Zones</option>
              {visibleZones.map((z) => (
                <option key={z.id} value={String(z.id)}>
                  {z.name} ({z.kebele_name})
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-status">Status</Label>
          <Select id="f-status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-[140px]" aria-label="Filter by status">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="f-search">Search</Label>
          <Input
            id="f-search"
            placeholder="Name, phone, Fayda…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-[280px]"
            aria-label="Search workers"
          />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      {/* Table — server-side pagination 25/page (hidden on mobile, card list below) */}
      <div className="hidden sm:block">
      <DataTable
        columns={columns}
        data={workers}
        loading={loading}
        error={error}
        onRetry={refetchWorkers}
        emptyTitle="No workers"
        emptyDescription={canEdit ? "Add your first worker to get started." : "No workers in this scope."}
        getRowKey={(w) => String(w.id)}
        page={page}
        pages={pages}
        onPage={(p) => setPage(p)}
        rowActions={
          canEdit
            ? (w) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setDetailWorker(w)} aria-label={`View ${w.full_name}`}>
                    <Icons.view size={16} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(w); setShowWorkerModal(true); }} aria-label={`Edit ${w.full_name}`}>
                    <Icons.edit size={16} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIdCardWorker(w)} aria-label={`ID card ${w.full_name}`}>
                    <Icons.idcard size={16} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAttendWorker(w)} aria-label={`Attendance ${w.full_name}`}>
                    <Icons.attendance size={16} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSalaryWorker(w)} aria-label={`Salary ${w.full_name}`}>
                    <Icons.salary size={16} />
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="danger" onClick={() => handleDelete(w.id)} aria-label={`Delete ${w.full_name}`}>
                      <Icons.trash size={16} />
                    </Button>
                  )}
                </div>
              )
            : undefined
        }
      />
      </div>

      {/* Mobile card list — visible below sm: breakpoint */}
      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--gray-100)]" />
            ))}
          </div>
        ) : workers.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">{canEdit ? "No workers yet. Add your first worker." : "No workers in this scope."}</p>
          </div>
        ) : (
          workers.map((w) => (
            <WorkerCard
              key={w.id}
              worker={w}
              canEdit={canEdit}
              isAdmin={isAdmin}
              onView={() => setDetailWorker(w)}
              onEdit={() => { setEditing(w); setShowWorkerModal(true); }}
              onAttendance={() => setAttendWorker(w)}
              onIdCard={() => setIdCardWorker(w)}
              onSalary={() => setSalaryWorker(w)}
              onDelete={() => handleDelete(w.id)}
            />
          ))
        )}
      </div>

      {/* Modals — lazy-loaded, rendered on demand */}
      {showWorkerModal && (
        <React.Suspense fallback={<DialogFallback />}>
          <WorkerFormModal
            worker={editing}
            zones={visibleZones}
            myZone={role === "leader" ? (zone as SaferZone | undefined) : undefined}
            isCollector={role === "collector"}
            onClose={() => setShowWorkerModal(false)}
            onSaved={() => {
              setShowWorkerModal(false);
              refetchWorkers();
            }}
          />
        </React.Suspense>
      )}
      {showBulk && (
        <React.Suspense fallback={<DialogFallback />}>
          <BulkAttendanceModal
            workers={workers.filter((w) => w.is_active)}
            onClose={() => setShowBulk(false)}
            onSaved={() => {
              setShowBulk(false);
              toast("Attendance saved!", "success");
            }}
          />
        </React.Suspense>
      )}
      {attendWorker && (
        <React.Suspense fallback={<DialogFallback />}>
          <AttendanceModal worker={attendWorker} onClose={() => setAttendWorker(null)} />
        </React.Suspense>
      )}
      {salaryWorker && (
        <React.Suspense fallback={<DialogFallback />}>
          <SalaryModal worker={salaryWorker} onClose={() => { setSalaryWorker(null); refetchWorkers(); }} />
        </React.Suspense>
      )}
      {idCardWorker && (
        <React.Suspense fallback={<DialogFallback />}>
          <IdCardModal worker={idCardWorker} onClose={() => setIdCardWorker(null)} />
        </React.Suspense>
      )}
      {detailWorker && (
        <React.Suspense fallback={<DialogFallback />}>
          <WorkerDetailsDrawer worker={detailWorker} onClose={() => setDetailWorker(null)} />
        </React.Suspense>
      )}
    </div>
  );
}
