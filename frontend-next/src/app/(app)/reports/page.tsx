"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert } from "@/components/ui/alert";
import { fmtETB, monthName, fmtDate } from "@/lib/utils";
import type { PaymentsMonthlyRow, WorkersMonthlyRow, InspectionReportRow } from "@/types/reports";

type ReportKind = "payments-monthly" | "payments-yearly" | "workers-monthly" | "inspections";

const REPORT_OPTIONS: Array<{ key: ReportKind; label: string; description: string; roleAllows: string[] }> = [
  { key: "payments-monthly", label: "Payments (Monthly)", description: "All payments for a given month/year with business, zone, kebele, method, status, amount.", roleAllows: ["admin", "collector", "leader", "viewer"] },
  { key: "payments-yearly", label: "Payments (Yearly Aggregate)", description: "Per-month collected/pending/overdue totals for a given year.", roleAllows: ["admin", "collector", "leader", "viewer"] },
  { key: "workers-monthly", label: "Workers (Monthly Attendance + Wage)", description: "Per-worker attendance and gross wage for a given month.", roleAllows: ["admin", "collector", "leader", "viewer"] },
  { key: "inspections", label: "Inspections (Period)", description: "Inspections with date, kebele, zone, status, inspector for a date range.", roleAllows: ["admin", "collector", "leader", "viewer"] },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const role = user?.role;

  const [kind, setKind] = React.useState<ReportKind>("payments-monthly");
  const now = new Date();
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [zoneId, setZoneId] = React.useState("");
  const [zones, setZones] = React.useState<{ id: number; name: string; kebele_name?: string }[]>([]);

  const [rows, setRows] = React.useState<unknown[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exportMsg, setExportMsg] = React.useState<string | null>(null);

  // Backend handles kebele/zone scoping server-side per role. Frontend only shows
  // local operational context (locked "My Kebele" for collector, leader zone, etc.)
  const visibleReportKinds = REPORT_OPTIONS.filter((r) => !role || r.roleAllows.includes(role));

  React.useEffect(() => {
    api.getSaferZones({}).then((r) => setZones(r.zones as { id: number; name: string; kebele_name?: string }[])).catch(() => {});
  }, []);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setRows([]);
    const ctrl = new AbortController();
    try {
      let res: unknown;
      const baseParams: Record<string, string> = {};
      if (role === "collector" && kebeleId) baseParams.kebeleId = String(kebeleId);
      if (zoneId) baseParams.zoneId = zoneId;
      if (kind === "payments-monthly") {
        res = await api.getPaymentsMonthlyReport({ month, year, ...baseParams }, { signal: ctrl.signal });
      } else if (kind === "payments-yearly") {
        res = await api.getPaymentsYearlyReport({ year, ...baseParams }, { signal: ctrl.signal });
      } else if (kind === "workers-monthly") {
        res = await api.getWorkersMonthlyReport({ year, month, ...baseParams }, { signal: ctrl.signal });
      } else if (kind === "inspections") {
        const p: Record<string, string> = { ...baseParams };
        if (from) p.from = from;
        if (to) p.to = to;
        res = await api.getInspectionsReport(p, { signal: ctrl.signal });
      }
      setRows(Array.isArray(res) ? res : []);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [kind, month, year, from, to, zoneId, role, kebeleId]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const exportCsv = async () => {
    setExportMsg(null);
    try {
      const path = kind === "payments-monthly" ? "/reports/payments/monthly"
        : kind === "payments-yearly" ? "/reports/payments/yearly"
        : kind === "workers-monthly" ? "/reports/workers/monthly"
        : "/reports/inspections";
      const params: Record<string, string> = { format: "csv" };
      if (kind === "payments-monthly" || kind === "workers-monthly") { params.month = month; params.year = year; }
      else if (kind === "payments-yearly") params.year = year;
      else if (kind === "inspections") { if (from) params.from = from; if (to) params.to = to; }
      if (role === "collector" && kebeleId) params.kebeleId = String(kebeleId);
      if (zoneId) params.zoneId = zoneId;
      const url = api.csvUrlReports(path, params);
      // Authenticated CSV: fetch with token header and trigger save
      const res = await fetch(url, { headers: { "x-session-token": localStorage.getItem("ddcms_token") || "" } });
      if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const filename = `dire-dawa-${kind}-${year}-${month}.csv`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      setExportMsg(`Exported ${filename}`);
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : "Export failed");
    }
  };

  const summary = React.useMemo(() => {
    if (kind === "payments-monthly" || kind === "payments-yearly") {
      const total = (rows as PaymentsMonthlyRow[]).reduce((s, r) => s + Number(r.amount || 0), 0);
      const paid = (rows as PaymentsMonthlyRow[]).filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount || 0), 0);
      const pending = (rows as PaymentsMonthlyRow[]).filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount || 0), 0);
      return { total, paid, pending, count: rows.length };
    }
    if (kind === "workers-monthly") {
      const list = rows as WorkersMonthlyRow[];
      const present = list.reduce((s, r) => s + Number(r.days_present || 0), 0);
      const absent = list.reduce((s, r) => s + Number(r.days_absent || 0), 0);
      const gross = list.reduce((s, r) => s + Number(r.gross_wage || 0), 0);
      return { present, absent, gross, count: list.length };
    }
    if (kind === "inspections") {
      const list = rows as InspectionReportRow[];
      const byStatus: Record<string, number> = { active: 0, warning: 0, danger: 0 };
      for (const r of list) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      return { count: list.length, ...byStatus };
    }
    return null;
  }, [kind, rows]);

  const columns: Column<Record<string, unknown>>[] = React.useMemo(() => {
    if (kind === "payments-monthly") {
      return [
        { key: "receipt_number", header: "Receipt", render: (r) => <code>{(r as PaymentsMonthlyRow).receipt_number || "—"}</code> },
        { key: "business", header: "Business", render: (r) => (r as PaymentsMonthlyRow).business },
        { key: "kebele", header: "Kebele", render: (r) => (r as PaymentsMonthlyRow).kebele },
        { key: "zone", header: "Zone", render: (r) => (r as PaymentsMonthlyRow).zone },
        { key: "amount", header: "Amount", render: (r) => fmtETB((r as PaymentsMonthlyRow).amount) },
        { key: "method", header: "Method", render: (r) => (r as PaymentsMonthlyRow).method },
        { key: "status", header: "Status", render: (r) => (r as PaymentsMonthlyRow).status },
        { key: "collector", header: "Collector", render: (r) => (r as PaymentsMonthlyRow).collector || "—" },
        { key: "paid_at", header: "Paid At", render: (r) => (r as PaymentsMonthlyRow).paid_at ? fmtDate((r as PaymentsMonthlyRow).paid_at!) : "—" },
      ];
    }
    if (kind === "payments-yearly") {
      return [
        { key: "month", header: "Month", render: (r) => monthName((r as { month: number }).month) },
        { key: "count", header: "Count", render: (r) => (r as { count: string }).count },
        { key: "collected", header: "Collected", render: (r) => fmtETB((r as { collected: string }).collected) },
        { key: "pending", header: "Pending", render: (r) => fmtETB((r as { pending: string }).pending) },
        { key: "overdue", header: "Overdue", render: (r) => fmtETB((r as { overdue: string }).overdue) },
      ];
    }
    if (kind === "workers-monthly") {
      return [
        { key: "full_name", header: "Worker", render: (r) => (r as WorkersMonthlyRow).full_name },
        { key: "kebele", header: "Kebele", render: (r) => (r as WorkersMonthlyRow).kebele },
        { key: "zone", header: "Zone", render: (r) => (r as WorkersMonthlyRow).zone },
        { key: "days_present", header: "Present", render: (r) => (r as WorkersMonthlyRow).days_present },
        { key: "days_absent", header: "Absent", render: (r) => (r as WorkersMonthlyRow).days_absent },
        { key: "total_bonus", header: "Bonus", render: (r) => fmtETB((r as WorkersMonthlyRow).total_bonus) },
        { key: "daily_wage", header: "Daily Wage", render: (r) => fmtETB((r as WorkersMonthlyRow).daily_wage) },
        { key: "gross_wage", header: "Gross", render: (r) => fmtETB((r as WorkersMonthlyRow).gross_wage) },
      ];
    }
    // inspections
    return [
      { key: "date", header: "Date", render: (r) => fmtDate((r as InspectionReportRow).date) },
      { key: "kebele", header: "Kebele", render: (r) => (r as InspectionReportRow).kebele },
      { key: "zone", header: "Zone", render: (r) => (r as InspectionReportRow).zone },
      { key: "status", header: "Status", render: (r) => (r as InspectionReportRow).status },
      { key: "inspector", header: "Inspector", render: (r) => (r as InspectionReportRow).inspector },
    ];
  }, [kind, rows]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-section">Reports</h1>
        <p className="text-sm text-[var(--text-muted)]">Operational reports from existing backend APIs — Dire Dawa Cleaning Department
          {role === "collector" && kebeleId ? " — My Kebele" : role === "leader" && user?.zone ? ` — ${(user.zone as { name: string }).name}` : " — City-wide"}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="rpt-kind">Report</Label>
            <Select id="rpt-kind" value={kind} onChange={(e) => setKind(e.target.value as ReportKind)} className="w-[260px]" aria-label="Report type">
              {visibleReportKinds.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </Select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{visibleReportKinds.find((r) => r.key === kind)?.description}</p>
          </div>
          {(kind === "payments-monthly" || kind === "workers-monthly" || kind === "payments-yearly") && (
            <>
              <div>
                <Label htmlFor="rpt-month">Month</Label>
                <Select id="rpt-month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[120px]" aria-label="Filter by month">
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{monthName(i + 1)}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="rpt-year">Year</Label>
                <input id="rpt-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm w-[100px]" aria-label="Filter by year" />
              </div>
            </>
          )}
          {kind === "inspections" && (
            <>
              <div>
                <Label htmlFor="rpt-from">From</Label>
                <input id="rpt-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm" aria-label="From date" />
              </div>
              <div>
                <Label htmlFor="rpt-to">To</Label>
                <input id="rpt-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm" aria-label="To date" />
              </div>
            </>
          )}
          {(role === "admin") && zones.length > 0 && (
            <div>
              <Label htmlFor="rpt-zone">Safer Zone</Label>
              <Select id="rpt-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="w-[200px]" aria-label="Filter by safer zone">
                <option value="">All Zones</option>
                {zones.map((z) => <option key={z.id} value={String(z.id)}>{z.name} ({z.kebele_name})</option>)}
              </Select>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button onClick={exportCsv} variant="outline" aria-label="Export CSV"><Icons.save size={16} /> Export CSV</Button>
          </div>
        </div>
        {exportMsg && <div className="mt-2 text-xs text-[var(--text-muted)]" role="status" aria-live="polite">{exportMsg}</div>}
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kind === "payments-monthly" || kind === "payments-yearly" ? (
            <>
              <StatCard label="Rows" value={summary.count} sub="Records in period" accent="blue" />
              <StatCard label="Total" value={fmtETB(summary.total)} sub="All statuses" accent="purple" />
              <StatCard label="Paid" value={fmtETB(summary.paid)} sub="status=paid" accent="green" />
              <StatCard label="Pending" value={fmtETB(summary.pending)} sub="status=pending" accent="orange" />
            </>
          ) : kind === "workers-monthly" ? (
            <>
              <StatCard label="Workers" value={summary.count} sub="In scope" accent="blue" />
              <StatCard label="Days Present" value={summary.present} sub="sum present" accent="green" />
              <StatCard label="Days Absent" value={summary.absent} sub="sum absent" accent="orange" />
              <StatCard label="Gross Wage" value={fmtETB(summary.gross)} sub="month gross" accent="purple" />
            </>
          ) : (
            <>
              <StatCard label="Inspections" value={summary.count} sub="In period" accent="blue" />
              <StatCard label="Active" value={String((summary as unknown as { active: number }).active ?? 0)} sub="status active" accent="green" />
              <StatCard label="Warning" value={String((summary as unknown as { warning: number }).warning ?? 0)} sub="status warning" accent="orange" />
              <StatCard label="Danger" value={String((summary as unknown as { danger: number }).danger ?? 0)} sub="status danger" accent="red" />
            </>
          )}
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <DataTable
          columns={columns as Column<Record<string, unknown>>[]}
          data={rows as Record<string, unknown>[]}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No data for selected period"
          emptyDescription="Try a different period, kebele, or zone."
          getRowKey={(_r: Record<string, unknown>, i: number) => String(i)}
        />
      </div>
    </div>
  );
}
