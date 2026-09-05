"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { businessesApi, addETB } from "@/features/businesses/services/businesses-api";
import type { Business, SaferZone } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { fmtETB } from "@/lib/utils";
import { BusinessCard } from "@/features/businesses/components/business-card";

const BusinessFormModal = React.lazy(() =>
  import("@/features/businesses/components/business-dialogs").then((m) => ({ default: m.BusinessFormModal }))
);
const BusinessDetailsDrawer = React.lazy(() =>
  import("@/features/businesses/components/business-dialogs").then((m) => ({ default: m.BusinessDetailsDrawer }))
);
const PaymentFormModal = React.lazy(() =>
  import("@/features/businesses/components/payment-dialogs").then((m) => ({ default: m.PaymentFormModal }))
);
const GatewayCheckoutModal = React.lazy(() =>
  import("@/features/businesses/components/payment-dialogs").then((m) => ({ default: m.GatewayCheckoutModal }))
);

const DialogFallback = () => <div className="p-4 text-sm text-[var(--text-muted)]">Loading…</div>;
const TYPES = ["shop","cafe","hotel","restaurant","pharmacy","market","workshop","office","school","clinic","other"] as const;

export default function BusinessesPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const { toast } = useToast();
  const role = user?.role;
  const zone = user?.zone as SaferZone | null | undefined;
  const canEdit = role === "admin" || role === "collector" || role === "leader";
  const isAdmin = role === "admin"; // delete only admin per backend

  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [zones, setZones] = React.useState<SaferZone[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [kebeleFilter, setKebeleFilter] = React.useState<string>(() => (kebeleId ? String(kebeleId) : ""));
  const [zoneFilter, setZoneFilter] = React.useState<string>("");
  const [typeFilter, setTypeFilter] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;

  const [editing, setEditing] = React.useState<Business | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [detailBiz, setDetailBiz] = React.useState<Business | null>(null);
  const [payBiz, setPayBiz] = React.useState<Business | null>(null);
  const [gatewayRes, setGatewayRes] = React.useState<{ id: number; receiptNumber: string; paymentUrl: string | null; gatewayName: string | null } | null>(null);

  const [summary, setSummary] = React.useState<{ total: number; active: number; pending: number; totalTarget: number } | null>(null);

  const visibleZones = React.useMemo(() => {
    if (role === "leader" && zone) return zones.filter((z) => z.id === zone.id);
    if (role === "collector" && kebeleId) return zones.filter((z) => z.kebele_id === kebeleId);
    if (kebeleFilter) return zones.filter((z) => String(z.kebele_id) === kebeleFilter);
    return zones;
  }, [zones, role, zone, kebeleId, kebeleFilter]);

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
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (kebeleFilter) params.kebeleId = kebeleFilter;
      if (zoneFilter) params.saferZoneId = zoneFilter;

      const [z, bRes] = await Promise.all([
        businessesApi.getZones(undefined, { signal: ctrl.signal }),
        businessesApi.getAll(params, { signal: ctrl.signal }),
      ]);
      setZones(z);

      const isPaginated = bRes && typeof bRes === "object" && "data" in (bRes as Record<string, unknown>);
      const bData: Business[] = isPaginated ? (bRes as { data: Business[] })?.data || [] : (bRes as Business[]) || [];
      const meta = isPaginated ? (bRes as { total: number; pages: number }) : { total: bData.length, pages: 1 };
      setBusinesses(bData);
      if (isPaginated) {
        setTotal(meta.total);
        setPages(meta.pages);
      } else {
        setTotal(bData.length);
        setPages(1);
      }

      // Summary: active/inactive + total monthly target (derived)
      // For accurate total, fetch active count via status filter when paginated
      if (isPaginated) {
        const activeParams = { ...params, status: "active", page: "1", limit: "1" };
        const inactiveParams = { ...params, status: "inactive", page: "1", limit: "1" };
        const [activeRes, inactiveRes] = await Promise.all([
          businessesApi.getAll(activeParams, { signal: ctrl.signal }).catch(() => ({ total: 0 } as unknown as Business[])),
          businessesApi.getAll(inactiveParams, { signal: ctrl.signal }).catch(() => ({ total: 0 } as unknown as Business[])),
        ]);
        const activeTotal = Array.isArray(activeRes) ? (activeRes as Business[]).length : (activeRes as { total: number }).total || 0;
        const inactiveTotal = Array.isArray(inactiveRes) ? (inactiveRes as Business[]).length : (inactiveRes as { total: number }).total || 0;
        const target = bData.filter((b) => b.is_active).reduce((s, b) => addETB(s, Number(b.monthly_target)), 0);
        setSummary({ total: meta.total, active: activeTotal, pending: inactiveTotal, totalTarget: target });
      } else {
        const active = bData.filter((b) => b.is_active).length;
        const inactive = bData.filter((b) => !b.is_active).length;
        const target = bData.filter((b) => b.is_active).reduce((s, b) => addETB(s, Number(b.monthly_target)), 0);
        setSummary({ total: bData.length, active, pending: inactive, totalTarget: target });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, debouncedSearch, statusFilter, typeFilter, kebeleFilter, zoneFilter]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = summary || {
    total: businesses.length,
    active: businesses.filter((b) => b.is_active).length,
    pending: businesses.filter((b) => !b.is_active).length,
    totalTarget: businesses.filter((b) => b.is_active).reduce((s, b) => addETB(s, Number(b.monthly_target)), 0),
  };

  const handleDelete = React.useCallback(async (id: number, name: string) => {
    if (!confirm(`Delete business "${name}" and all its payment records?`)) return;
    try {
      await businessesApi.delete(id);
      toast("Business deleted", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }, [fetchData, toast]);

  const handlePaymentSuccess = (res: unknown) => {
    const r = res as { status?: string; paymentUrl?: string | null; gatewayName?: string | null; receiptNumber?: string; id?: number };
    if (r.status === "pending" && r.paymentUrl) {
      setGatewayRes({ id: r.id as number, receiptNumber: r.receiptNumber as string, paymentUrl: r.paymentUrl, gatewayName: r.gatewayName as string | null });
    } else {
      setPayBiz(null);
      toast(`Payment recorded! Receipt: ${r.receiptNumber || ""}`, "success");
      fetchData();
    }
  };

  const columns: Column<Business>[] = [
    { key: "name", header: "Business", render: (b) => <strong>{b.name}</strong> },
    { key: "type", header: "Type", render: (b) => <Badge variant="gray">{b.type}</Badge> },
    { key: "owner_name", header: "Owner", render: (b) => <span>{b.owner_name}<br /><small className="text-[var(--text-muted)]">{b.owner_fayda_id || ""}</small></span> },
    { key: "kebele_name", header: "Kebele", render: (b) => (b as unknown as { kebele_name?: string }).kebele_name || "—" },
    { key: "safer_zone_name", header: "Safer Zone", render: (b) => (b as unknown as { safer_zone_name?: string }).safer_zone_name || "—" },
    { key: "monthly_target", header: "Monthly Target", render: (b) => fmtETB(b.monthly_target) },
    { key: "is_active", header: "Status", render: (b) => (b.is_active ? <StatusBadge status="active" /> : <Badge variant="gray">Inactive</Badge>) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Businesses</h1>
          <p className="text-sm text-[var(--text-muted)]">Manage registered businesses and service activity {role === "collector" && kebeleId ? "— My Kebele" : role === "leader" && zone ? `— ${zone.name}` : "— City-wide"}</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>＋ Add Business</Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={stats.total} sub="Businesses in scope" accent="blue" />
        <StatCard label="Active" value={stats.active} sub="is_active=true" accent="green" />
        <StatCard label="Inactive" value={stats.pending} sub="is_active=false" accent="orange" />
        <StatCard label="Monthly Target" value={fmtETB(stats.totalTarget)} sub="Active businesses" accent="purple" />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        {role === "admin" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="b-kebele">Kebele</Label>
            <Select id="b-kebele" value={kebeleFilter} onChange={(e) => { setKebeleFilter(e.target.value); setZoneFilter(""); setPage(1); }} className="w-[160px]" aria-label="Filter by kebele">
              <option value="">All Kebeles</option>
              {Array.from(new Map(zones.map((z) => [z.kebele_id, z.kebele_name])).entries()).map(([id, name]) => (
                <option key={String(id)} value={String(id)}>{name as string}</option>
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
            <Label htmlFor="b-zone">Safer Zone</Label>
            <Select id="b-zone" value={zoneFilter} onChange={(e) => { setZoneFilter(e.target.value); setPage(1); }} className="w-[160px]" aria-label="Filter by zone">
              <option value="">All Zones</option>
              {visibleZones.map((z) => (
                <option key={z.id} value={String(z.id)}>{z.name} ({z.kebele_name})</option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Label htmlFor="b-type">Type</Label>
          <Select id="b-type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="w-[140px]" aria-label="Filter by type">
            <option value="">All Types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="b-status">Status</Label>
          <Select id="b-status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-[130px]" aria-label="Filter by status">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="b-search">Search</Label>
          <Input id="b-search" placeholder="Name, owner, Fayda…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-[260px]" aria-label="Search businesses" />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={businesses}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No businesses"
          emptyDescription={canEdit ? "Add your first business to get started." : "No businesses in this scope."}
          getRowKey={(b) => String(b.id)}
          page={page}
          pages={pages}
          onPage={(p) => setPage(p)}
          rowActions={
            canEdit
              ? (b) => (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setDetailBiz(b)} aria-label={`View ${b.name}`}><Icons.view size={16} /></Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(b); setShowForm(true); }} aria-label={`Edit ${b.name}`}><Icons.edit size={16} /></Button>
                    <Button size="sm" variant="outline" onClick={() => setPayBiz(b)} aria-label={`Pay ${b.name}`}><Icons.payments size={16} /></Button>
                    {isAdmin && (
                      <Button size="sm" variant="danger" onClick={() => handleDelete(b.id, b.name)} aria-label={`Delete ${b.name}`}><Icons.trash size={16} /></Button>
                    )}
                  </div>
                )
              : undefined
          }
        />
      </div>

      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-[var(--gray-100)]" />)}</div>
        ) : businesses.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">{canEdit ? "No businesses yet. Add your first business." : "No businesses in this scope."}</p>
          </div>
        ) : (
          businesses.map((b) => (
            <BusinessCard key={b.id} business={b} canEdit={canEdit} isAdmin={isAdmin} onView={() => setDetailBiz(b)} onEdit={() => { setEditing(b); setShowForm(true); }} onPay={() => setPayBiz(b)} onDelete={() => handleDelete(b.id, b.name)} />
          ))
        )}
        {!loading && businesses.length > 0 && (
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <span className="px-3 py-2 text-xs text-[var(--text-muted)]">Page {page} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      {showForm && (
        <React.Suspense fallback={<DialogFallback />}>
          <BusinessFormModal business={editing} zones={zones} myZone={role === "leader" ? (zone as SaferZone | undefined) : undefined} isCollector={role === "collector"} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData(); }} />
        </React.Suspense>
      )}
      {detailBiz && (
        <React.Suspense fallback={<DialogFallback />}>
          <BusinessDetailsDrawer business={detailBiz} onClose={() => setDetailBiz(null)} />
        </React.Suspense>
      )}
      {payBiz && !gatewayRes && (
        <React.Suspense fallback={<DialogFallback />}>
          <PaymentFormModal preselectedBusinessId={payBiz.id} onClose={() => setPayBiz(null)} onSaved={handlePaymentSuccess} />
        </React.Suspense>
      )}
      {gatewayRes && payBiz && (
        <React.Suspense fallback={<DialogFallback />}>
          <GatewayCheckoutModal res={gatewayRes} businessName={payBiz.name} amount={payBiz.monthly_target} onClose={() => { setGatewayRes(null); setPayBiz(null); }} onVerified={() => { setGatewayRes(null); setPayBiz(null); fetchData(); }} />
        </React.Suspense>
      )}
    </div>
  );
}
