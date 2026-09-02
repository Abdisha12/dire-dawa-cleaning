"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { Alert } from "@/components/ui/alert";
import { DataTable, type Column } from "@/components/ui/data-table";
import { fmtDate } from "@/lib/utils";

type AuditEntry = {
  id: number;
  user_id?: number | null;
  username?: string;
  full_name?: string;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  old_data?: unknown;
  new_data?: unknown;
  ip_address?: string;
  created_at: string;
};

const ACTIONS = [
  "CREATE", "UPDATE", "DELETE", "DISABLE", "ENABLE", "APPROVE", "REVIEW", "UNAUTHORIZED", "LOGIN", "LOGOUT"
] as const;

function safeJson(v: unknown): string {
  if (v === null || v === undefined) return "—";
  try { return JSON.stringify(v, null, 2); } catch { return "—"; }
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const role = user?.role;

  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [entityFilter, setEntityFilter] = React.useState<string>("");
  const [actionFilter, setActionFilter] = React.useState<string>("");
  const [userIdFilter, setUserIdFilter] = React.useState<string>("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;
  const [selected, setSelected] = React.useState<AuditEntry | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (entityFilter) params.entityType = entityFilter;
      if (actionFilter) params.action = actionFilter;
      if (userIdFilter) params.userId = userIdFilter;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.getAuditLog(params, { signal: ctrl.signal });
      const list = (res as { logs: AuditEntry[] }).logs || [];
      const isPaginated = res && typeof res === "object" && "total" in (res as Record<string, unknown>);
      if (isPaginated) {
        const t = (res as unknown as { total: number; pages: number }).total;
        const p = (res as unknown as { total: number; pages: number }).pages;
        setTotal(t);
        setPages(p);
      } else {
        setTotal(list.length);
        setPages(1);
      }
      setEntries(list);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, entityFilter, actionFilter, userIdFilter, from, to]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const columns: Column<AuditEntry>[] = [
    { key: "created_at", header: "When", render: (e) => <strong>{fmtDate(e.created_at)}</strong> },
    { key: "full_name", header: "Actor", render: (e) => e.full_name || e.username || `user#${e.user_id ?? "—"}` },
    { key: "action", header: "Action", render: (e) => <Badge variant={e.action === "UNAUTHORIZED" ? "red" : "blue"}>{e.action}</Badge> },
    { key: "entity_type", header: "Entity", render: (e) => e.entity_type },
    { key: "entity_id", header: "Entity ID", render: (e) => e.entity_id != null ? String(e.entity_id) : "—" },
    { key: "ip_address", header: "IP", render: (e) => e.ip_address || "—" },
  ];

  if (role !== "admin") {
    return (
      <div className="space-y-4">
        <h1 className="text-section">Audit Logs</h1>
        <Alert variant="danger">Only Admin can view audit logs. Your role ({role || "unknown"}) is not authorized.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-section">Audit Logs</h1>
        <p className="text-sm text-[var(--text-muted)]">Read-only administrative history of platform mutations. Immutable; no edit/delete actions exposed.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="al-entity">Entity</Label>
          <Input id="al-entity" placeholder="worker, business, …" value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }} className="w-[160px]" aria-label="Filter by entity" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="al-action">Action</Label>
          <Select id="al-action" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="w-[160px]" aria-label="Filter by action">
            <option value="">All</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="al-user">User ID</Label>
          <Input id="al-user" type="number" value={userIdFilter} onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }} className="w-[120px]" aria-label="Filter by user id" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="al-from">From</Label>
          <Input id="al-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-[150px]" aria-label="From date" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="al-to">To</Label>
          <Input id="al-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-[150px]" aria-label="To date" />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="hidden sm:block">
        <DataTable
          columns={columns as Column<Record<string, unknown>>[]}
          data={entries as unknown as Record<string, unknown>[]}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No audit events"
          emptyDescription="Backend returned no audit events for the current filter."
          getRowKey={(e, i) => String((e as unknown as { id: number }).id ?? i)}
          page={page}
          pages={pages}
          onPage={(p) => setPage(p)}
          rowActions={(e) => (
            <Button size="sm" variant="outline" onClick={() => setSelected(e as unknown as AuditEntry)} aria-label={`View details for ${(e as { action: string }).action}`}><Icons.view size={16} /></Button>
          )}
        />
      </div>

      <div className="space-y-3 sm:hidden">
        {entries.map((e) => (
          <div key={e.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">{fmtDate(e.created_at)}</div>
                <div className="text-xs text-[var(--text-muted)]">{e.full_name || e.username || `user#${e.user_id ?? "—"}`}</div>
              </div>
              <Badge variant={e.action === "UNAUTHORIZED" ? "red" : "blue"}>{e.action}</Badge>
            </div>
            <div className="mt-2 text-xs">{e.entity_type} #{e.entity_id ?? "—"} · IP {e.ip_address || "—"}</div>
            <Button size="sm" variant="outline" onClick={() => setSelected(e)} className="mt-3 w-full min-h-[44px]">View details</Button>
          </div>
        ))}
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Audit Detail">
        {selected ? (
          <div className="space-y-3 text-sm">
            <div><span className="text-xs text-[var(--text-muted)]">Actor</span><div className="font-medium">{selected.full_name || selected.username || `user#${selected.user_id ?? "—"}`}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Action</span><div><Badge variant={selected.action === "UNAUTHORIZED" ? "red" : "blue"}>{selected.action}</Badge></div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Entity</span><div>{selected.entity_type} #{selected.entity_id ?? "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">When</span><div>{fmtDate(selected.created_at)}</div></div>
            {selected.ip_address && <div><span className="text-xs text-[var(--text-muted)]">IP</span><div>{selected.ip_address}</div></div>}
            <div>
              <span className="text-xs text-[var(--text-muted)]">Before</span>
              <pre className="mt-1 max-h-48 overflow-auto rounded border border-[var(--border)] bg-[var(--gray-50)] p-2 text-xs whitespace-pre-wrap break-all">{safeJson(selected.old_data)}</pre>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)]">After</span>
              <pre className="mt-1 max-h-48 overflow-auto rounded border border-[var(--border)] bg-[var(--gray-50)] p-2 text-xs whitespace-pre-wrap break-all">{safeJson(selected.new_data)}</pre>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
