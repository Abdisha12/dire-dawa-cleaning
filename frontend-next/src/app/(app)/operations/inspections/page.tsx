"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { inspectionsApi } from "@/features/inspections/services/inspections-api";
import type { Inspection, SaferZone, Kebele } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/utils";
import { InspectionCard } from "@/features/inspections/components/inspection-card";

const InspectionFormModal = React.lazy(() =>
  import("@/features/inspections/components/inspection-dialogs").then((m) => ({ default: m.InspectionFormModal }))
);
const InspectionDetailDrawer = React.lazy(() =>
  import("@/features/inspections/components/inspection-dialogs").then((m) => ({ default: m.InspectionDetailDrawer }))
);
const PhotoGalleryModal = React.lazy(() =>
  import("@/features/inspections/components/inspection-dialogs").then((m) => ({ default: m.PhotoGalleryModal }))
);
const DialogFallback = () => <div className="p-4 text-sm text-[var(--text-muted)]">Loading…</div>;

function statusBadge(s: string) {
  if (s === "active") return <Badge variant="green">Active</Badge>;
  if (s === "warning") return <Badge variant="orange">Warning</Badge>;
  if (s === "danger") return <Badge variant="red">Danger</Badge>;
  return <Badge variant="gray">{s}</Badge>;
}

export default function InspectionsPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const { toast } = useToast();
  const role = user?.role;
  const zone = user?.zone as SaferZone | null | undefined;
  const canEdit = role === "admin" || role === "collector" || role === "leader";
  const isAdmin = role === "admin" || role === "collector";

  const [inspections, setInspections] = React.useState<Inspection[]>([]);
  const [zones, setZones] = React.useState<SaferZone[]>([]);
  const [kebeles, setKebeles] = React.useState<Kebele[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [kebeleFilter, setKebeleFilter] = React.useState<string>(() => (kebeleId ? String(kebeleId) : ""));
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [fromFilter, setFromFilter] = React.useState<string>("");
  const [toFilter, setToFilter] = React.useState<string>("");
  const [zoneFilter, setZoneFilter] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;

  const [editing, setEditing] = React.useState<Inspection | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [gallery, setGallery] = React.useState<Inspection | null>(null);
  const [detail, setDetail] = React.useState<Inspection | null>(null);
  const [summary, setSummary] = React.useState<{ total: number; today: number; warning: number; danger: number } | null>(null);

  const visibleZones = React.useMemo(() => {
    if (role === "leader" && zone) return zones.filter((z) => z.id === zone.id);
    if (kebeleFilter) return zones.filter((z) => String(z.kebele_id) === kebeleFilter);
    return zones;
  }, [zones, role, zone, kebeleFilter]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    if (kebeleId) setKebeleFilter(String(kebeleId));
    else if (role === "admin") setKebeleFilter((prev) => prev);
  }, [kebeleId, role]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (debouncedSearch) params.search = debouncedSearch;
      if (kebeleFilter) params.kebeleId = kebeleFilter;
      if (zoneFilter) params.zoneId = zoneFilter;
      if (statusFilter) params.status = statusFilter;
      if (fromFilter) params.from = fromFilter;
      if (toFilter) params.to = toFilter;

      const [z, k, iRes] = await Promise.all([
        inspectionsApi.getZones(undefined, { signal: ctrl.signal }),
        inspectionsApi.getKebeles({ signal: ctrl.signal } as never),
        inspectionsApi.getAll(params, { signal: ctrl.signal }),
      ]);
      setZones(z);
      setKebeles(k as unknown as Kebele[]);
      const isPaginated = iRes && typeof iRes === "object" && "data" in (iRes as unknown as Record<string, unknown>);
      const raw = iRes as unknown;
      let data: Inspection[] = [];
      let meta: { total: number; pages: number } = { total: 0, pages: 1 };
      if (isPaginated) {
        const pag = raw as { data: Inspection[]; total: number; pages: number };
        data = pag.data || [];
        meta = { total: pag.total, pages: pag.pages };
      } else if (Array.isArray(raw)) {
        data = raw;
        meta = { total: data.length, pages: 1 };
      } else if (raw && typeof raw === "object" && "inspections" in (raw as Record<string, unknown>)) {
        data = (raw as { inspections: Inspection[] }).inspections || [];
        meta = { total: data.length, pages: 1 };
      }
      setInspections(data);
      if (isPaginated) {
        setTotal(meta.total);
        setPages(meta.pages);
      } else {
        setTotal(data.length);
        setPages(1);
      }
      // summary from fetched page (or total if paginated via separate counts)
      const todayStr = new Date().toISOString().slice(0, 10);
      const today = data.filter((x) => x.date?.slice(0, 10) === todayStr).length;
      const warning = data.filter((x) => x.status === "warning").length;
      const danger = data.filter((x) => x.status === "danger").length;
      setSummary({ total: isPaginated ? meta.total : data.length, today, warning, danger });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, debouncedSearch, kebeleFilter, zoneFilter, statusFilter, fromFilter, toFilter]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = summary || { total: inspections.length, today: 0, warning: 0, danger: 0 };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this inspection and all photos?")) return;
    try {
      await inspectionsApi.delete(id);
      toast("Inspection deleted", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const columns: Column<Inspection>[] = [
    { key: "date", header: "Date", render: (r) => <strong>{fmtDate(r.date)}</strong> },
    { key: "kebele_name", header: "Kebele", render: (r) => (r.kebele_name ? `${r.kebele_name} (${r.kebele_code || ""})` : "—") },
    { key: "zone_name", header: "Zone", render: (r) => r.zone_name || "—" },
    { key: "status", header: "Status", render: (r) => statusBadge(r.status) },
    { key: "inspector_name", header: "Inspector", render: (r) => r.inspector_name || "—" },
    { key: "photos", header: "Photos", render: (r) => (r.photos?.length ? `${r.photos.length}` : "None") },
    { key: "notes", header: "Notes", render: (r) => (r.notes ? (r.notes.length > 40 ? r.notes.slice(0, 40) + "…" : r.notes) : "—") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Inspections</h1>
          <p className="text-sm text-[var(--text-muted)]">Monitor field inspections and service conditions {role === "leader" && zone ? `— ${zone.name}` : role === "collector" && kebeleId ? "— My Kebele" : "— City-wide"}</p>
        </div>
        {canEdit && <Button onClick={() => { setEditing(null); setShowForm(true); }}>＋ Add Inspection</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={stats.total} sub="Inspections" accent="blue" />
        <StatCard label="Today" value={stats.today} sub="Inspected today" accent="green" />
        <StatCard label="Warning" value={stats.warning} sub="status warning" accent="orange" />
        <StatCard label="Danger" value={stats.danger} sub="status danger" accent="red" />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        {role === "admin" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="i-kebele">Kebele</Label>
            <Select id="i-kebele" value={kebeleFilter} onChange={(e) => { setKebeleFilter(e.target.value); setZoneFilter(""); setPage(1); }} className="w-[160px]" aria-label="Filter by kebele">
              <option value="">All Kebeles</option>
              {kebeles.map((k) => (
                <option key={k.id} value={String(k.id)}>{k.name}</option>
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
            <Label htmlFor="i-zone">Zone</Label>
            <Select id="i-zone" value={zoneFilter} onChange={(e) => { setZoneFilter(e.target.value); setPage(1); }} className="w-[200px]" aria-label="Filter by zone">
              <option value="">All Zones</option>
              {visibleZones.map((z) => (
                <option key={z.id} value={String(z.id)}>{z.name} ({z.kebele_name})</option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Label htmlFor="i-status">Status</Label>
          <Select id="i-status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-[130px]" aria-label="Filter by status">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="warning">Warning</option>
            <option value="danger">Danger</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="i-from">From</Label>
          <Input id="i-from" type="date" value={fromFilter} onChange={(e) => { setFromFilter(e.target.value); setPage(1); }} className="w-[150px]" aria-label="From date" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="i-to">To</Label>
          <Input id="i-to" type="date" value={toFilter} onChange={(e) => { setToFilter(e.target.value); setPage(1); }} className="w-[150px]" aria-label="To date" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="i-search">Search</Label>
          <Input id="i-search" placeholder="Notes, inspector…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-[220px]" aria-label="Search inspections" />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={inspections}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No inspections"
          emptyDescription={canEdit ? "Create your first inspection." : "No inspections in this scope."}
          getRowKey={(r) => String(r.id)}
          page={page}
          pages={pages}
          onPage={(p) => setPage(p)}
          rowActions={(r) => (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setDetail(r)} aria-label={`View inspection ${r.id}`}><Icons.view size={16} /></Button>
              {canEdit && <Button size="sm" variant="outline" onClick={() => { setEditing(r); setShowForm(true); }} aria-label={`Edit inspection ${r.id}`}><Icons.edit size={16} /></Button>}
              {r.photos?.length ? (
                <Button size="sm" variant="outline" onClick={() => setGallery(r)} aria-label={`Photos ${r.id}`}><Icons.view size={16} /> {r.photos.length}</Button>
              ) : null}
              {isAdmin && (
                <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)} aria-label={`Delete inspection ${r.id}`}><Icons.trash size={16} /></Button>
              )}
            </div>
          )}
        />
      </div>

      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--gray-100)]" />)}</div>
        ) : inspections.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No inspections yet.</p>
          </div>
        ) : (
          inspections.map((r) => <InspectionCard key={r.id} inspection={r} canEdit={canEdit} isAdmin={isAdmin} onEdit={() => { setEditing(r); setShowForm(true); }} onDelete={() => handleDelete(r.id)} onViewPhotos={() => setGallery(r)} onView={() => setDetail(r)} />)
        )}
        {!loading && inspections.length > 0 && (
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <span className="px-3 py-2 text-xs text-[var(--text-muted)]">Page {page} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      {showForm && (
        <React.Suspense fallback={<DialogFallback />}>
          <InspectionFormModal inspection={editing} kebeles={kebeles} zones={zones} myZone={role === "leader" ? (zone as SaferZone | null) : null} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData(); }} />
        </React.Suspense>
      )}
      {gallery && (
        <React.Suspense fallback={<DialogFallback />}>
          <PhotoGalleryModal inspection={gallery} onClose={() => setGallery(null)} />
        </React.Suspense>
      )}
      {detail && (
        <React.Suspense fallback={<DialogFallback />}>
          <InspectionDetailDrawer inspection={detail} onClose={() => setDetail(null)} />
        </React.Suspense>
      )}
    </div>
  );
}
