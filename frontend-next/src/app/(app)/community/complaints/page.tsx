"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { StatCard } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import type { Complaint, ComplaintStatus } from "@/types";

const CATEGORY_LABELS: Record<string, string> = {
  illegal_dumping: "Illegal Dumping",
  litter: "Litter",
  blocked_drain: "Blocked Drain",
  hazard: "Hazard",
  other: "Other",
};

const STATUS_BADGE: Record<string, "blue" | "orange" | "green"> = {
  new: "blue",
  in_progress: "orange",
  resolved: "green",
};

function complaintList(res: unknown): Complaint[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === "object" && "data" in (res as Record<string, unknown>)) {
    return (res as { data: Complaint[] }).data || [];
  }
  return [];
}

function complaintPagination(res: unknown) {
  if (res && typeof res === "object" && "total" in (res as Record<string, unknown>)) {
    const p = res as { total: number; page: number; pages: number };
    return { total: p.total, page: p.page, pages: p.pages };
  }
  return { total: 0, page: 1, pages: 1 };
}

export default function ComplaintsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "collector" || user?.role === "leader";
  const isAdmin = user?.role === "admin";

  const [complaints, setComplaints] = React.useState<Complaint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState({ total: 0, new: 0, in_progress: 0, resolved: 0 });
  const [statusFilter, setStatusFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState({ total: 0, page: 1, pages: 1 });
  const limit = 20;

  // Create modal
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    title: "",
    description: "",
    category: "other",
    saferZoneId: "",
    reporterName: "",
    reporterPhone: "",
  });
  const [zones, setZones] = React.useState<{ id: number; name: string }[]>([]);
  const [zonesLoading, setZonesLoading] = React.useState(false);

  // Detail modal
  const [selected, setSelected] = React.useState<Complaint | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [statusForm, setStatusForm] = React.useState({ status: "", resolutionNotes: "", assignedTo: "" });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const [listRes, summaryRes] = await Promise.all([
        api.getComplaints(params, { signal: ctrl.signal }),
        api.getComplaintSummary({ signal: ctrl.signal }),
      ]);
      setComplaints(complaintList(listRes));
      setPagination(complaintPagination(listRes));
      setSummary(summaryRes as typeof summary);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load complaints");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, statusFilter, search]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const loadZones = React.useCallback(async () => {
    setZonesLoading(true);
    try {
      const res = await api.getSaferZones();
      const list = Array.isArray((res as { zones?: unknown }).zones) ? (res as { zones: { id: number; name: string }[] }).zones : (Array.isArray(res) ? (res as { id: number; name: string }[]) : []);
      setZones(list);
    } catch {
      setZones([]);
    } finally {
      setZonesLoading(false);
    }
  }, []);

  const handleCreateOpen = () => {
    setCreateForm({ title: "", description: "", category: "other", saferZoneId: "", reporterName: "", reporterPhone: "" });
    setShowCreate(true);
    loadZones();
  };

  const handleCreateSubmit = async () => {
    if (!createForm.title.trim() || !createForm.description.trim() || !createForm.saferZoneId) {
      toast("Title, description, and zone are required", "error");
      return;
    }
    setCreating(true);
    try {
      await api.createComplaint({
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        category: createForm.category,
        saferZoneId: Number(createForm.saferZoneId),
        reporterName: createForm.reporterName.trim() || null,
        reporterPhone: createForm.reporterPhone.trim() || null,
      });
      toast("Complaint created", "success");
      setShowCreate(false);
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selected || !statusForm.status) return;
    setUpdating(true);
    try {
      const payload: Record<string, unknown> = { status: statusForm.status };
      if (statusForm.resolutionNotes.trim()) payload.resolutionNotes = statusForm.resolutionNotes.trim();
      if (statusForm.assignedTo) payload.assignedTo = Number(statusForm.assignedTo);
      await api.updateComplaintStatus(selected.id, payload);
      toast(`Complaint moved to ${statusForm.status.replace("_", " ")}`, "success");
      setSelected(null);
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (c: Complaint) => {
    if (!window.confirm(`Delete complaint "${c.title}"?`)) return;
    try {
      await api.deleteComplaint(c.id);
      toast("Deleted", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const openDetail = (c: Complaint) => {
    setSelected(c);
    const nextStatus = c.status === "new" ? "in_progress" : c.status === "in_progress" ? "resolved" : "";
    setStatusForm({ status: nextStatus, resolutionNotes: "", assignedTo: "" });
  };

  const transitions: Record<string, string[]> = { new: ["in_progress"], in_progress: ["resolved"] };

  const columns: Column<Complaint>[] = [
    { key: "id", header: "ID" },
    { key: "title", header: "Title", render: (c) => <strong>{c.title}</strong> },
    { key: "category", header: "Category", render: (c) => <Badge variant="gray">{CATEGORY_LABELS[c.category] || c.category}</Badge> },
    { key: "status", header: "Status", render: (c) => <Badge variant={STATUS_BADGE[c.status] || "gray"}>{c.status.replace("_", " ")}</Badge> },
    { key: "zone_name", header: "Zone" },
    { key: "created_at", header: "Reported", render: (c) => fmtDate(c.created_at) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Community Complaints</h1>
          <p className="text-sm text-[var(--text-muted)]">Community-reported cleanliness issues resolved by staff.</p>
        </div>
        {canWrite && (
          <Button onClick={handleCreateOpen} aria-label="File a complaint">
            <Icons.success size={16} /> New Complaint
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={summary.total} accent="blue" />
        <StatCard label="New" value={summary.new} accent="orange" />
        <StatCard label="In Progress" value={summary.in_progress} accent="orange" />
        <StatCard label="Resolved" value={summary.resolved} accent="green" />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="c-status">Status</Label>
          <Select id="c-status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-[140px]">
            <option value="">All</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="c-search">Search</Label>
          <Input id="c-search" placeholder="Title, reporter…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-[200px]" />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{pagination.total} total · page {pagination.page}/{pagination.pages}</div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="hidden sm:block">
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={complaints as unknown as Record<string, unknown>[]}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No complaints"
          emptyDescription="No complaints match the current filter."
          getRowKey={(c, i) => String((c as unknown as { id: number }).id ?? i)}
          page={pagination.page}
          pages={pagination.pages}
          onPage={setPage}
          rowActions={(c) => {
            const comp = c as unknown as Complaint;
            const nexts = transitions[comp.status] || [];
            return (
              <div className="flex gap-1">
                {nexts.length > 0 && canWrite && (
                  <Button size="sm" variant="outline" onClick={() => openDetail(comp)} aria-label={`Advance ${comp.title}`}>
                    <Icons.success size={16} />
                  </Button>
                )}
                {isAdmin && (
                  <Button size="sm" variant="danger" onClick={() => handleDelete(comp)} aria-label={`Delete ${comp.title}`}>
                    <Icons.trash size={16} />
                  </Button>
                )}
                {!nexts.length && !isAdmin && (
                  <span className="text-xs text-[var(--text-muted)]">—</span>
                )}
              </div>
            );
          }}
        />
      </div>

      <div className="space-y-3 sm:hidden">
        {complaints.map((c) => {
          const nexts = transitions[c.status] || [];
          return (
            <div key={c.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">{CATEGORY_LABELS[c.category] || c.category} · {fmtDate(c.created_at)}</div>
                  <div className="mt-1 text-sm">{c.zone_name}</div>
                </div>
                <Badge variant={STATUS_BADGE[c.status] || "gray"}>{c.status.replace("_", " ")}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {nexts.length > 0 && canWrite && (
                  <Button size="sm" variant="outline" onClick={() => openDetail(c)} className="min-h-[44px]">Advance</Button>
                )}
                {isAdmin && (
                  <Button size="sm" variant="danger" onClick={() => handleDelete(c)} className="min-h-[44px]"><Icons.trash size={16} /> Delete</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="File a complaint" footer={
        <>
          <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
          <Button onClick={handleCreateSubmit} disabled={creating}>{creating ? "Saving…" : "Create"}</Button>
        </>
      }>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="c-title">Title *</Label>
            <Input id="c-title" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} maxLength={200} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="c-desc">Description *</Label>
            <textarea id="c-desc" className="w-full rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm" rows={4} maxLength={5000} value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="c-cat">Category</Label>
              <Select id="c-cat" value={createForm.category} onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="illegal_dumping">Illegal Dumping</option>
                <option value="litter">Litter</option>
                <option value="blocked_drain">Blocked Drain</option>
                <option value="hazard">Hazard</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="c-zone">Zone *</Label>
              <Select id="c-zone" value={createForm.saferZoneId} onChange={(e) => setCreateForm((f) => ({ ...f, saferZoneId: e.target.value }))} disabled={zonesLoading}>
                <option value="">{zonesLoading ? "Loading…" : "Select zone"}</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="c-reporter">Reporter name</Label>
              <Input id="c-reporter" value={createForm.reporterName} onChange={(e) => setCreateForm((f) => ({ ...f, reporterName: e.target.value }))} maxLength={120} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="c-phone">Reporter phone</Label>
              <Input id="c-phone" value={createForm.reporterPhone} onChange={(e) => setCreateForm((f) => ({ ...f, reporterPhone: e.target.value }))} maxLength={30} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Detail / Status Transition Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Complaint: ${selected.title}` : "Complaint"} footer={
        <>
          <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          {selected && (transitions[selected.status] || []).length > 0 && canWrite && (
            <Button onClick={handleStatusUpdate} disabled={updating || !statusForm.status}>{updating ? "Saving…" : "Update status"}</Button>
          )}
        </>
      }>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-medium">Status:</span> <Badge variant={STATUS_BADGE[selected.status] || "gray"}>{selected.status.replace("_", " ")}</Badge></div>
              <div><span className="font-medium">Category:</span> {CATEGORY_LABELS[selected.category] || selected.category}</div>
              <div><span className="font-medium">Zone:</span> {selected.zone_name}</div>
              <div><span className="font-medium">Kebele:</span> {selected.kebele_name}</div>
              <div><span className="font-medium">Reporter:</span> {selected.reporter_name || "—"} {selected.reporter_phone ? `(${selected.reporter_phone})` : ""}</div>
              <div><span className="font-medium">Created:</span> {fmtDate(selected.created_at)}</div>
              {selected.assigned_name && <div><span className="font-medium">Assigned:</span> {selected.assigned_name}</div>}
              {selected.resolved_name && <div><span className="font-medium">Resolved by:</span> {selected.resolved_name} ({fmtDate(selected.resolved_at)})</div>}
            </div>
            <div className="text-sm"><span className="font-medium">Description:</span><p className="mt-1 whitespace-pre-wrap text-[var(--text-muted)]">{selected.description}</p></div>
            {selected.resolution_notes && <div className="text-sm"><span className="font-medium">Resolution notes:</span><p className="mt-1 whitespace-pre-wrap text-[var(--text-muted)]">{selected.resolution_notes}</p></div>}

            {(transitions[selected.status] || []).length > 0 && canWrite && (
              <div className="space-y-3 border-t border-[var(--border)] pt-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="c-next-status">Advance to</Label>
                  <Select id="c-next-status" value={statusForm.status} onChange={(e) => setStatusForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="">Select…</option>
                    {(transitions[selected.status] || []).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </Select>
                </div>
                {statusForm.status === "resolved" && (
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="c-notes">Resolution notes</Label>
                    <textarea id="c-notes" className="w-full rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm" rows={3} maxLength={5000} value={statusForm.resolutionNotes} onChange={(e) => setStatusForm((f) => ({ ...f, resolutionNotes: e.target.value }))} />
                  </div>
                )}
              </div>
            )}
            {(transitions[selected.status] || []).length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No further transitions available.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}