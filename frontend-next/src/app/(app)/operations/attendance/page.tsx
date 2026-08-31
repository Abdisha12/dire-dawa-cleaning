"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { api, ApiError } from "@/lib/api";
import type { Worker, SaferZone, Attendance } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { Icons } from "@/components/ui/icon";
import { fmtETB, fmtDate, todayISO } from "@/lib/utils";
import { MobileAttendanceRow } from "@/features/attendance/components/mobile-attendance-row";

export default function AttendancePage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const { toast } = useToast();
  const role = user?.role;
  const zone = user?.zone as SaferZone | null | undefined;
  const canEdit = role === "admin" || role === "collector" || role === "leader";

  const [date, setDate] = React.useState(() => todayISO());
  const [zoneFilter, setZoneFilter] = React.useState<string>("");
  const [kebeleFilter, setKebeleFilter] = React.useState<string>("");
  const [attendance, setAttendance] = React.useState<Array<Attendance & { worker_name: string; zone_name: string; kebele_name: string }>>([]);
  const [zones, setZones] = React.useState<SaferZone[]>([]);
  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;

  // Summary
  const [summary, setSummary] = React.useState<{ present: number; absent: number; late: number; notRecorded: number } | null>(null);
  const [showBulk, setShowBulk] = React.useState(false);

  // For collector: filter zones to their kebele
  const visibleZones = React.useMemo(() => {
    if (role === "leader" && zone) return zones.filter((z) => z.id === zone.id);
    if (role === "collector" && kebeleId) return zones.filter((z) => z.kebele_id === kebeleId);
    if (kebeleFilter) return zones.filter((z) => String(z.kebele_id) === kebeleFilter);
    return zones;
  }, [zones, role, zone, kebeleId, kebeleFilter]);

  const fetchZones = React.useCallback(async () => {
    try {
      const res = await api.getSaferZones();
      setZones(res.zones);
    } catch {
      // ignore: zones load best-effort; table still renders
    }
  }, []);

  React.useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // Debounced fetch with AbortController
  const [debouncedParams, setDebouncedParams] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const t = setTimeout(() => {
      const params: Record<string, string> = { date, page: String(page), limit: String(limit) };
      if (zoneFilter) params.zoneId = zoneFilter;
      if (kebeleFilter) params.kebeleId = kebeleFilter;
      setDebouncedParams(params);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [date, zoneFilter, kebeleFilter]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    try {
      const params: Record<string, string> = {
        date,
        page: String(page),
        limit: String(limit),
      };
      if (zoneFilter) params.zoneId = zoneFilter;
      if (kebeleFilter) params.kebeleId = kebeleFilter;

      const [w, z, aRes] = await Promise.all([
        api.getWorkers({ date }, { signal: ctrl.signal }),
        api.getSaferZones(),
        api.getAttendance(0, { date }).catch(() => ({ data: [] } as unknown as Attendance[]) ),
      ]);
      setWorkers(Array.isArray(w) ? w : (w as { data: Worker[] }).data);
      setZones((z as { zones: SaferZone[] }).zones);

      // Handle attendance response - backend may return array or paginated
      const attendanceData = Array.isArray(aRes) ? (aRes as Attendance[]) : (aRes as { data: Attendance[] }).data || [];
      const enriched = attendanceData.map((a) => {
        const w = workers.find((x) => x.id === a.worker_id);
        const z = zones.find((z) => z.id === w?.safer_zone_id);
        return {
          ...a,
          worker_name: w?.full_name || "—",
          zone_name: z?.name || "—",
          kebele_name: z ? (z as SaferZone & { kebele_name?: string }).kebele_name || "—" : "—",
        };
      });
      setAttendance(enriched);

      // Summary stats
      const present = enriched.filter((r) => r.present).length;
      const absent = enriched.filter((r) => !r.present).length;
      const late = 0; // Not tracked currently
      const notRecorded = workers.filter((w) => w.is_active).length - enriched.length;
      setSummary({ present, absent, late, notRecorded });

      if (!Array.isArray(aRes)) {
        // paginated
        setTotal((aRes as { total: number }).total);
        setPages((aRes as { pages: number }).pages);
      } else {
        setTotal(enriched.length);
        setPages(1);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [date, page, limit, zoneFilter, kebeleFilter, workers, zones]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchWorkersForBulk = React.useCallback(async () => {
    try {
      const res = await api.getWorkers(kebeleFilter ? { kebeleId: kebeleFilter } : {});
      setWorkers((Array.isArray(res) ? res : (res as { data: Worker[] }).data).filter((w) => w.is_active));
    } catch {
      // ignore: bulk modal shows subset it already has
    }
  }, [kebeleFilter]);

  const columns: Column<Attendance & { worker_name: string; zone_name: string; kebele_name: string }>[] = [
    { key: "worker_name", header: "Worker", render: (r) => <strong>{r.worker_name}</strong> },
    { key: "zone_name", header: "Zone", render: (r) => <Badge variant="purple">{r.zone_name}</Badge> },
    { key: "kebele_name", header: "Kebele", render: (r) => r.kebele_name },
    {
      key: "present",
      header: "Status",
      render: (r) => (r.present ? <StatusBadge status="active" /> : <Badge variant="red">Absent</Badge>),
    },
    { key: "bonus", header: "Bonus (ETB)", render: (r) => (r.bonus ? fmtETB(r.bonus) : "—") },
    { key: "recorder_name", header: "Recorded By" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Attendance</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Record and review daily attendance {role === "collector" && kebeleId ? "— My Kebele" : role === "leader" && zone ? `— ${zone.name}` : "— City-wide"}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchWorkersForBulk(); setShowBulk(true); }}>
              📋 Bulk Attendance
            </Button>
          </div>
        )}
      </div>

      {/* Date & Context */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="att-date">Date *</Label>
          <Input id="att-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[180px]" />
        </div>
        {role === "admin" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="a-kebele">Kebele</Label>
            <Select
              id="a-kebele"
              value={kebeleFilter}
              onChange={(e) => { setKebeleFilter(e.target.value); setZoneFilter(""); setPage(1); }}
              className="w-[160px]"
              aria-label="Filter by kebele"
            >
              <option value="">All Kebeles</option>
              {Array.from(new Map(zones.map((z) => [z.kebele_id, z.kebele_name])).entries()).map(([id, name]) => (
                <option key={String(id)} value={String(id)}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {role !== "leader" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="a-zone">Safer Zone</Label>
            <Select
              id="a-zone"
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
        <div className="text-xs text-[var(--text-muted)]">{attendance.length} records · page {page}/{pages}</div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Present" value={summary?.present ?? attendance.filter((r) => r.present).length} accent="green" />
        <StatCard label="Absent" value={summary?.absent ?? attendance.filter((r) => !r.present).length} accent="red" />
        <StatCard label="Late" value={summary?.late ?? 0} accent="orange" />
        <StatCard label="Not Recorded" value={summary?.notRecorded ?? 0} accent="orange" />
      </div>

      {/* Attendance Table — server-side pagination (hidden on mobile, cards below) */}
      <div className="hidden sm:block">
      <DataTable
        columns={columns}
        data={attendance}
        loading={loading}
        error={error}
        onRetry={fetchData}
        emptyTitle="No attendance records"
        emptyDescription="Select a date and filters to view attendance."
        getRowKey={(r) => `${r.worker_id}-${r.date}`}
        page={page}
        pages={pages}
        onPage={(p) => setPage(p)}
      />
      </div>

      {/* Mobile attendance cards — visible below sm: */}
      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--gray-100)]" />
            ))}
          </div>
        ) : attendance.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No attendance records for this date.</p>
          </div>
        ) : (
          attendance.map((a) => (
            <MobileAttendanceRow
              key={`${a.worker_id}-${a.date}`}
              workerId={a.worker_id}
              workerName={a.worker_name}
              zoneName={a.zone_name}
              dailyWage={0}
              present={a.present}
              bonus={a.bonus ? String(a.bonus) : ""}
              onPresentChange={() => {}}
              onBonusChange={() => {}}
            />
          ))
        )}
      </div>

      {/* Bulk Attendance Modal */}
      {showBulk && (
        <BulkAttendanceModal
          workers={workers.filter((w) => w.is_active)}
          onClose={() => setShowBulk(false)}
          onSaved={() => {
            setShowBulk(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function BulkAttendanceModal({ workers, onClose, onSaved }: { workers: Worker[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [date, setDate] = React.useState(() => todayISO());
  const [rows, setRows] = React.useState(
    workers.map((w) => ({ workerId: w.id, present: true, bonus: "" as string, wage: w.daily_wage, name: w.full_name, zone: w.zone_name }))
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    if (!date) { setError("Select a date"); return; }
    setSaving(true);
    setError(null);
    try {
      const records = rows.map((r) => ({ workerId: r.workerId, present: r.present, bonus: r.bonus ? Number(r.bonus) : null }));
      await api.bulkAttendance({ date, records });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="📋 Record Daily Attendance" size="lg" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "✅ Save Attendance"}</Button></>}>
      <div className="mb-3 flex items-center gap-3">
        <Label htmlFor="att-date-bulk">Date *</Label>
        <Input id="att-date-bulk" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[200px]" />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {/* Mobile one-handed marking — cards below sm */}
      <div className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <div key={r.workerId} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold">{r.name}</p>
              {r.zone ? <Badge variant="purple">{r.zone}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{fmtETB(r.wage)}/day</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={() => setRows((prev) => prev.map((x) => x.workerId === r.workerId ? { ...x, present: true } : x))}
                variant={r.present ? "success" : "outline"}
                className="min-h-[48px] w-full text-sm"
                aria-pressed={r.present}
                aria-label={`Mark ${r.name} present`}
              >
                PRESENT
              </Button>
              <Button
                type="button"
                onClick={() => setRows((prev) => prev.map((x) => x.workerId === r.workerId ? { ...x, present: false } : x))}
                variant={!r.present ? "danger" : "outline"}
                className="min-h-[48px] w-full text-sm"
                aria-pressed={!r.present}
                aria-label={`Mark ${r.name} absent`}
              >
                ABSENT
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor={`mbonus-${r.workerId}`} className="text-sm font-medium">Bonus:</label>
              <div className="flex-1">
                <Input
                  id={`mbonus-${r.workerId}`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={r.bonus}
                  inputMode="decimal"
                  onChange={(e) => setRows((prev) => prev.map((x) => x.workerId === r.workerId ? { ...x, bonus: e.target.value } : x))}
                  className="min-h-[44px]"
                  aria-label={`Bonus for ${r.name}`}
                />
              </div>
              <span className="text-sm text-[var(--text-muted)]">ETB</span>
            </div>
          </div>
        ))}
      </div>
      {/* Desktop table — hidden below sm */}
      <div className="max-h-[50vh] overflow-auto rounded border border-[var(--border)] sm:block hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--gray-50)]">
            <tr>
              <th className="p-2 text-left">Worker</th>
              <th className="p-2 text-left">Zone</th>
              <th className="p-2 text-left">Wage</th>
              <th className="p-2 text-left">Present</th>
              <th className="p-2 text-left">Bonus (ETB)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.workerId} className="border-t border-[var(--border)]">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.zone || "—"}</td>
                <td className="p-2">{fmtETB(r.wage)}</td>
                <td className="p-2"><label className="flex items-center gap-1"><input type="checkbox" aria-label={`Mark ${r.name} as present`} checked={r.present} onChange={(e) => setRows((prev) => prev.map((x) => x.workerId === r.workerId ? { ...x, present: e.target.checked } : x))} /> Present</label></td>
                <td className="p-2"><Input type="number" min={0} step={0.01} value={r.bonus} onChange={(e) => setRows((prev) => prev.map((x) => x.workerId === r.workerId ? { ...x, bonus: e.target.value } : x))} className="w-[100px]" aria-label={`Bonus for ${r.name}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
    </Modal>
  );
}