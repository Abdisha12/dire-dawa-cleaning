"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { zoneReportsApi } from "@/features/zone-reports/services/zone-reports-api";
import type { ZoneReport, SaferZone } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { fmtETB, monthName } from "@/lib/utils";
import { ZoneReportCard } from "@/features/zone-reports/components/zone-report-card";

const ZoneReportFormModal = React.lazy(() =>
  import("@/features/zone-reports/components/zone-report-dialogs").then((m) => ({ default: m.ZoneReportFormModal }))
);
const ReviewModal = React.lazy(() =>
  import("@/features/zone-reports/components/zone-report-dialogs").then((m) => ({ default: m.ReviewModal }))
);
const ZoneReportDetailDrawer = React.lazy(() =>
  import("@/features/zone-reports/components/zone-report-dialogs").then((m) => ({ default: m.ZoneReportDetailDrawer }))
);
const DialogFallback = () => <div className="p-4 text-sm text-[var(--text-muted)]">Loading…</div>;

function statusBadge(s: string) {
  if (s === "draft") return <Badge variant="gray">Draft</Badge>;
  if (s === "submitted") return <Badge variant="orange">Submitted</Badge>;
  if (s === "reviewed") return <Badge variant="blue">Reviewed</Badge>;
  if (s === "approved") return <Badge variant="green">Approved</Badge>;
  return <Badge variant="gray">{s}</Badge>;
}

export default function ZoneReportsPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const { toast } = useToast();
  const role = user?.role;
  const zone = user?.zone as SaferZone | null | undefined;
  const isLeader = role === "leader";
  const canReview = role === "admin" || role === "collector";

  const now = new Date();
  const [reports, setReports] = React.useState<ZoneReport[]>([]);
  const [zones, setZones] = React.useState<SaferZone[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [monthFilter, setMonthFilter] = React.useState<string>(String(now.getMonth() + 1));
  const [yearFilter, setYearFilter] = React.useState<string>(String(now.getFullYear()));
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [zoneFilter, setZoneFilter] = React.useState<string>("");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;

  const visibleZones = React.useMemo(() => {
    if (role === "leader" && zone) return zones.filter((z) => z.id === zone.id);
    if (role === "collector" && kebeleId) return zones.filter((z) => z.kebele_id === kebeleId);
    return zones;
  }, [zones, role, zone, kebeleId]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<ZoneReport | null>(null);
  const [reviewing, setReviewing] = React.useState<ZoneReport | null>(null);
  const [detail, setDetail] = React.useState<ZoneReport | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (debouncedSearch) params.search = debouncedSearch;
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;
      if (statusFilter) params.status = statusFilter;
      if (zoneFilter) params.zoneId = zoneFilter;
      const [z, rRes] = await Promise.all([
        zoneReportsApi.getZones(undefined, { signal: ctrl.signal }),
        zoneReportsApi.getAll(params, { signal: ctrl.signal }),
      ]);
      setZones(z);
      const isPaginated = rRes && typeof rRes === "object" && "data" in (rRes as unknown as Record<string, unknown>);
      const raw = rRes as unknown;
      let data: ZoneReport[] = [];
      let meta: { total: number; pages: number } = { total: 0, pages: 1 };
      if (isPaginated) {
        const pag = raw as { data: ZoneReport[]; total: number; pages: number };
        data = pag.data || [];
        meta = { total: pag.total, pages: pag.pages };
      } else if (Array.isArray(raw)) {
        data = raw;
        meta = { total: data.length, pages: 1 };
      } else if (raw && typeof raw === "object" && "reports" in (raw as Record<string, unknown>)) {
        data = (raw as { reports: ZoneReport[] }).reports || [];
        meta = { total: data.length, pages: 1 };
      }
      setReports(data);
      if (isPaginated) {
        setTotal(meta.total);
        setPages(meta.pages);
      } else {
        setTotal(data.length);
        setPages(1);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, debouncedSearch, monthFilter, yearFilter, statusFilter, zoneFilter]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = React.useMemo(() => {
    const total = reports.length;
    const draft = reports.filter((r) => r.status === "draft").length;
    const submitted = reports.filter((r) => r.status === "submitted").length;
    const approved = reports.filter((r) => r.status === "approved").length;
    return { total, draft, submitted, approved };
  }, [reports]);

  const handleSubmit = async (id: number) => {
    try {
      await zoneReportsApi.update(id, { status: "submitted" });
      toast("Report submitted to collector!", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Submit failed", "error");
    }
  };
  const handleApprove = async (id: number) => {
    try {
      await zoneReportsApi.review(id, { status: "approved", reviewerNotes: "Approved" });
      toast("Report approved!", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Approve failed", "error");
    }
  };

  const columns: Column<ZoneReport>[] = [
    { key: "zone_name", header: "Zone", render: (r) => <strong>{r.zone_name}</strong> },
    { key: "kebele_name", header: "Kebele", render: (r) => r.kebele_name || "—" },
    { key: "period", header: "Period", render: (r) => `${monthName(r.report_month)} ${r.report_year}` },
    { key: "leader_name", header: "Leader", render: (r) => r.leader_name || "—" },
    { key: "status", header: "Status", render: (r) => statusBadge(r.status) },
    { key: "workers", header: "Workers", render: (r) => `✅${r.workers_present ?? 0} ❌${r.workers_absent ?? 0}` },
    { key: "collection", header: "Collection", render: (r) => fmtETB(r.collection_total) },
    { key: "reviewer_name", header: "Reviewed By", render: (r) => r.reviewer_name || "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Zone Reports</h1>
          <p className="text-sm text-[var(--text-muted)]">draft → submitted → reviewed → approved {isLeader && zone ? `— ${zone.name}` : ""}</p>
        </div>
        <div className="flex gap-2">
          {isLeader && <Button onClick={() => { setEditing(null); setShowForm(true); }}>＋ New Report</Button>}
          {canReview && <Button variant="outline" onClick={() => { setStatusFilter("submitted"); setPage(1); }}>Pending Review ({reports.filter((r) => r.status === "submitted").length})</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-[#bfdbfe] bg-[var(--blue-l)] p-3 text-sm text-[var(--primary)]">
        <strong>How Zone Reports Work:</strong> Zone Leaders create and submit reports → Collectors review → Admin approves.
      </div>

      <div className="flex items-center justify-between gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs sm:text-sm" role="list" aria-label="Report workflow">
        {(["draft", "submitted", "reviewed", "approved"] as const).map((s, i) => {
          const label = s.charAt(0).toUpperCase() + s.slice(1);
          const isCurrent = statusFilter === s;
          return (
            <React.Fragment key={s}>
              <div role="listitem" className={`flex flex-col items-center gap-1 rounded px-2 py-1 ${isCurrent ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"}`} aria-current={isCurrent ? "step" : undefined}>
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${isCurrent ? "bg-white text-[var(--primary)]" : "bg-[var(--gray-100)]"}`}>{i + 1}</span>
                <span>{label}</span>
              </div>
              {i < 3 && <div className="h-0.5 flex-1 bg-[var(--border)]" aria-hidden />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={stats.total} sub="Reports" accent="blue" />
        <StatCard label="Draft" value={stats.draft} sub="draft" accent="purple" />
        <StatCard label="Submitted" value={stats.submitted} sub="awaiting review" accent="orange" />
        <StatCard label="Approved" value={stats.approved} sub="approved" accent="green" />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="zr-month">Month</Label>
          <Select id="zr-month" value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }} className="w-[110px]" aria-label="Filter by month">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>{monthName(i + 1)}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="zr-year">Year</Label>
          <Input id="zr-year" type="number" value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }} className="w-[90px]" aria-label="Filter by year" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="zr-status">Status</Label>
          <Select id="zr-status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-[130px]" aria-label="Filter by status">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
          </Select>
        </div>
        {role === "collector" && kebeleId && (
          <div className="flex flex-col gap-1">
            <Label>Kebele</Label>
            <div className="rounded bg-[var(--information-l)] px-3 py-2 text-sm font-medium text-[var(--primary)]">My Kebele — locked</div>
          </div>
        )}
        {!isLeader && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="zr-zone">Zone</Label>
            <Select id="zr-zone" value={zoneFilter} onChange={(e) => { setZoneFilter(e.target.value); setPage(1); }} className="w-[200px]" aria-label="Filter by zone">
              <option value="">All Zones</option>
              {visibleZones.map((z) => (
                <option key={z.id} value={String(z.id)}>{z.name} ({z.kebele_name})</option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="zr-search">Search</Label>
          <Input id="zr-search" placeholder="Zone, kebele, leader…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-[200px]" aria-label="Search reports" />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={reports}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No reports"
          emptyDescription="No zone reports for this period."
          getRowKey={(r) => String(r.id)}
          page={page}
          pages={pages}
          onPage={(p) => setPage(p)}
          rowActions={(r) => (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setDetail(r)} aria-label={`View report ${r.id}`}><Icons.view size={16} /></Button>
              {isLeader && r.status === "draft" && <Button size="sm" variant="outline" onClick={() => handleSubmit(r.id)} aria-label={`Submit report ${r.id}`}>Submit</Button>}
              {canReview && r.status === "submitted" && <Button size="sm" variant="outline" onClick={() => setReviewing(r)} aria-label={`Review report ${r.id}`}>Review</Button>}
              {canReview && r.status === "reviewed" && <Button size="sm" variant="outline" onClick={() => handleApprove(r.id)} aria-label={`Approve report ${r.id}`}>Approve</Button>}
              {isLeader && r.status === "draft" && <Button size="sm" variant="outline" onClick={() => { setEditing(r); setShowForm(true); }} aria-label={`Edit report ${r.id}`}><Icons.edit size={16} /></Button>}
            </div>
          )}
        />
      </div>

      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-[var(--gray-100)]" />)}</div>
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No reports found</p>
          </div>
        ) : (
          reports.map((r) => (
            <ZoneReportCard key={r.id} report={r} isLeader={!!isLeader} canReview={!!canReview} onView={() => setDetail(r)} onEdit={() => { setEditing(r); setShowForm(true); }} onSubmit={() => handleSubmit(r.id)} onReview={() => setReviewing(r)} onApprove={() => handleApprove(r.id)} />
          ))
        )}
        {!loading && reports.length > 0 && (
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <span className="px-3 py-2 text-xs text-[var(--text-muted)]">Page {page} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      {showForm && (
        <React.Suspense fallback={<DialogFallback />}>
          <ZoneReportFormModal report={editing} zones={zones} myZone={isLeader ? (zone as SaferZone | null) : null} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData(); }} />
        </React.Suspense>
      )}
      {reviewing && (
        <React.Suspense fallback={<DialogFallback />}>
          <ReviewModal report={reviewing} onClose={() => setReviewing(null)} onReviewed={() => { setReviewing(null); fetchData(); }} />
        </React.Suspense>
      )}
      {detail && (
        <React.Suspense fallback={<DialogFallback />}>
          <ZoneReportDetailDrawer report={detail} onClose={() => setDetail(null)} />
        </React.Suspense>
      )}
    </div>
  );
}
