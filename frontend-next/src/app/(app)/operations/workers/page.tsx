"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { api, ApiError } from "@/lib/api";
import type { Worker, SaferZone } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, StatCard } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { fmtETB, fmtDate, validateFaydaId, formatFaydaId } from "@/lib/utils";

// Zod schemas mirror backend/middleware/schemas.js createWorker/updateWorker
const workerSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(120),
  contact: z.string().max(30).optional().nullable(),
  faydaId: z.string().max(50).optional().nullable(),
  dailyWage: z.coerce.number().min(0).max(10000),
  saferZoneId: z.string().optional().nullable(), // string for select, converted to number or null
  isActive: z.boolean().optional(),
  customAttributes: z.record(z.string(), z.string()).optional(),
});

type WorkerFormValues = z.infer<typeof workerSchema>;

export default function WorkersPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const { toast } = useToast();
  const role = user?.role;
  const zone = user?.zone as SaferZone | null | undefined;
  const canEdit = role === "admin" || role === "collector" || role === "leader";
  const isAdmin = role === "admin" || role === "collector";

  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [zones, setZones] = React.useState<SaferZone[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [zoneFilter, setZoneFilter] = React.useState<string>("");

  // Modals
  const [editing, setEditing] = React.useState<Worker | null>(null);
  const [showWorkerModal, setShowWorkerModal] = React.useState(false);
  const [showBulk, setShowBulk] = React.useState(false);
  const [attendWorker, setAttendWorker] = React.useState<Worker | null>(null);
  const [salaryWorker, setSalaryWorker] = React.useState<Worker | null>(null);
  const [idCardWorker, setIdCardWorker] = React.useState<Worker | null>(null);

  // For collector: filter zones to their kebele (client side, backend also enforces)
  const visibleZones = React.useMemo(() => {
    if (role === "leader" && zone) return zones.filter((z) => z.id === zone.id);
    if (role === "collector" && kebeleId) return zones.filter((z) => z.kebele_id === kebeleId);
    return zones;
  }, [zones, role, zone, kebeleId]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [z, w] = await Promise.all([
        api.getSaferZones().then((r) => r.zones),
        api.getWorkers(zoneFilter ? { zoneId: zoneFilter } : {}),
      ]);
      setZones(z);
      // Normalize custom_attributes if string
      setWorkers(
        w.map((r) => {
          if (r.custom_attributes && typeof r.custom_attributes === "string") {
            try {
              return { ...r, custom_attributes: JSON.parse(r.custom_attributes as unknown as string) };
            } catch {
              return r;
            }
          }
          return r;
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [zoneFilter]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return workers;
    const q = search.toLowerCase();
    return workers.filter(
      (w) =>
        w.full_name.toLowerCase().includes(q) ||
        (w.contact || "").toLowerCase().includes(q) ||
        (w.fayda_id || "").toLowerCase().includes(q) ||
        (w.zone_name || "").toLowerCase().includes(q)
    );
  }, [workers, search]);

  const stats = React.useMemo(() => {
    const active = workers.filter((w) => w.is_active).length;
    const totalWage = workers.filter((w) => w.is_active).reduce((s, w) => s + Number(w.daily_wage), 0);
    return { total: workers.length, active, totalWage };
  }, [workers]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this worker and all records?")) return;
    try {
      await api.deleteWorker(id);
      toast("Worker deleted", "success");
      setWorkers((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

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
              📋 Bulk Attendance
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

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Workers" value={stats.total} accent="blue" />
        <StatCard label="Active" value={stats.active} accent="green" />
        <StatCard label="Daily Wage Total" value={fmtETB(stats.totalWage)} accent="orange" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        {role !== "leader" && (
          <Select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
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
        )}
        <Input
          placeholder="🔍 Search workers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[260px]"
          aria-label="Search workers"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        error={error}
        onRetry={fetchData}
        emptyTitle="No workers"
        emptyDescription={canEdit ? "Add your first worker to get started." : "No workers in this scope."}
        getRowKey={(w) => String(w.id)}
        rowActions={
          canEdit
            ? (w) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(w); setShowWorkerModal(true); }} aria-label={`Edit ${w.full_name}`}>
                    ✏️
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIdCardWorker(w)} aria-label={`ID card ${w.full_name}`}>
                    🪪
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAttendWorker(w)} aria-label={`Attendance ${w.full_name}`}>
                    📅
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSalaryWorker(w)} aria-label={`Salary ${w.full_name}`}>
                    💰
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="danger" onClick={() => handleDelete(w.id)} aria-label={`Delete ${w.full_name}`}>
                      🗑
                    </Button>
                  )}
                </div>
              )
            : undefined
        }
      />

      {/* Modals */}
      {showWorkerModal && (
        <WorkerFormModal
          worker={editing}
          zones={visibleZones}
          myZone={role === "leader" ? (zone as SaferZone | undefined) : undefined}
          isCollector={role === "collector"}
          onClose={() => setShowWorkerModal(false)}
          onSaved={() => {
            setShowWorkerModal(false);
            fetchData();
          }}
        />
      )}
      {showBulk && (
        <BulkAttendanceModal
          workers={workers.filter((w) => w.is_active)}
          onClose={() => setShowBulk(false)}
          onSaved={() => {
            setShowBulk(false);
            toast("Attendance saved!", "success");
          }}
        />
      )}
      {attendWorker && (
        <AttendanceModal worker={attendWorker} onClose={() => setAttendWorker(null)} />
      )}
      {salaryWorker && (
        <SalaryModal worker={salaryWorker} onClose={() => setSalaryWorker(null)} />
      )}
      {idCardWorker && (
        <IdCardModal worker={idCardWorker} onClose={() => setIdCardWorker(null)} />
      )}
    </div>
  );
}

function WorkerFormModal({
  worker,
  zones,
  myZone,
  isCollector,
  onClose,
  onSaved,
}: {
  worker: Worker | null;
  zones: SaferZone[];
  myZone?: SaferZone;
  isCollector: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [customRows, setCustomRows] = React.useState<Array<{ k: string; v: string }>>(() => {
    if (worker?.custom_attributes && typeof worker.custom_attributes === "object") {
      return Object.entries(worker.custom_attributes as Record<string, string>).map(([k, v]) => ({ k, v: String(v) }));
    }
    return [];
  });

  const form = useForm<WorkerFormValues>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      fullName: worker?.full_name || "",
      contact: worker?.contact || "",
      faydaId: worker?.fayda_id || "",
      dailyWage: worker ? Number(worker.daily_wage) : 250,
      saferZoneId: worker?.safer_zone_id ? String(worker.safer_zone_id) : myZone ? String(myZone.id) : "",
      isActive: worker ? !!worker.is_active : true,
    },
  });

  const onSubmit = async (values: WorkerFormValues) => {
    setServerError(null);
    if (values.faydaId && !validateFaydaId(values.faydaId)) {
      form.setError("faydaId", { message: "Must be exactly 12 digits" });
      return;
    }
    const attrs: Record<string, string> = {};
    customRows.forEach((r) => {
      if (r.k.trim()) attrs[r.k.trim()] = r.v.trim();
    });
    const payload: Record<string, unknown> = {
      fullName: values.fullName.trim(),
      contact: values.contact?.trim() || null,
      faydaId: values.faydaId ? values.faydaId.replace(/[\s-]/g, "") : null,
      dailyWage: Number(values.dailyWage),
      saferZoneId: values.saferZoneId ? Number(values.saferZoneId) : null,
      isActive: values.isActive ?? true,
      customAttributes: Object.keys(attrs).length ? attrs : null,
    };
    try {
      if (worker) await api.updateWorker(worker.id, payload);
      else await api.createWorker(payload);
      toast(worker ? "Worker updated" : "Worker added", "success");
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed";
      if (e instanceof ApiError && e.status === 409) {
        form.setError("faydaId", { message: msg });
      } else {
        setServerError(msg);
      }
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={worker ? "Edit Worker" : "Add Worker"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "💾 Save"}
          </Button>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="wf-name">Full Name *</Label>
            <Input id="wf-name" {...form.register("fullName")} aria-invalid={!!form.formState.errors.fullName} />
            {form.formState.errors.fullName && <p className="text-xs text-[var(--danger)]">{form.formState.errors.fullName.message}</p>}
          </div>
          <div>
            <Label htmlFor="wf-contact">Contact (Phone)</Label>
            <Input id="wf-contact" {...form.register("contact")} />
          </div>
          <div>
            <Label htmlFor="wf-fayda">Fayda/ID Number</Label>
            <Input id="wf-fayda" {...form.register("faydaId")} aria-invalid={!!form.formState.errors.faydaId} />
            {form.formState.errors.faydaId && <p className="text-xs text-[var(--danger)]">{form.formState.errors.faydaId.message}</p>}
          </div>
          <div>
            <Label htmlFor="wf-wage">Daily Wage (ETB) *</Label>
            <Input id="wf-wage" type="number" min={0} step={0.01} {...form.register("dailyWage")} />
            {form.formState.errors.dailyWage && <p className="text-xs text-[var(--danger)]">{form.formState.errors.dailyWage.message}</p>}
          </div>
          {myZone ? (
            <>
              <input type="hidden" {...form.register("saferZoneId")} value={String(myZone.id)} />
              <div>
                <Label>Zone</Label>
                <Input value={myZone.name} disabled aria-label="Zone (auto)" />
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="wf-zone">{isCollector ? "Zone" : "Zone *"}</Label>
              <Select id="wf-zone" {...form.register("saferZoneId")}>
                <option value="">Select Zone {isCollector ? "(optional)" : ""}</option>
                {zones.map((z) => (
                  <option key={z.id} value={String(z.id)}>
                    {z.name} — {z.kebele_name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {worker && (
            <div>
              <Label htmlFor="wf-active">Status</Label>
              <Select
                id="wf-active"
                value={form.watch("isActive") ? "1" : "0"}
                onChange={(e) => form.setValue("isActive", e.target.value === "1")}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </Select>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--gray-50)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Custom Attributes (Optional)</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setCustomRows((r) => [...r, { k: "", v: "" }])}>
              ➕ Add Attribute
            </Button>
          </div>
          <div className="space-y-2">
            {customRows.map((row, idx) => (
              <div key={idx} className="flex gap-2">
                <Input placeholder="Key (e.g. Blood Type)" value={row.k} onChange={(e) => setCustomRows((r) => r.map((x, i) => (i === idx ? { ...x, k: e.target.value } : x)))} className="flex-1" aria-label={`Attribute key ${idx + 1}`} />
                <Input placeholder="Value (e.g. O+)" value={row.v} onChange={(e) => setCustomRows((r) => r.map((x, i) => (i === idx ? { ...x, v: e.target.value } : x)))} className="flex-1" aria-label={`Attribute value ${idx + 1}`} />
                <Button type="button" variant="outline" size="sm" onClick={() => setCustomRows((r) => r.filter((_, i) => i !== idx))} aria-label="Remove attribute">
                  ✖
                </Button>
              </div>
            ))}
            {customRows.length === 0 && <p className="text-xs text-[var(--text-muted)]">No custom attributes yet.</p>}
          </div>
        </div>

        {serverError && <Alert variant="danger">{serverError}</Alert>}
      </form>
    </Modal>
  );
}

function BulkAttendanceModal({ workers, onClose, onSaved }: { workers: Worker[]; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
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
        <Label htmlFor="att-date">Date *</Label>
        <Input id="att-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[200px]" />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="max-h-[50vh] overflow-auto rounded border border-[var(--border)]">
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
                <td className="p-2"><label className="flex items-center gap-1"><input type="checkbox" checked={r.present} onChange={(e) => setRows((prev) => prev.map((x) => x.workerId === r.workerId ? { ...x, present: e.target.checked } : x))} /> Present</label></td>
                <td className="p-2"><Input type="number" min={0} step={0.01} value={r.bonus} onChange={(e) => setRows((prev) => prev.map((x) => x.workerId === r.workerId ? { ...x, bonus: e.target.value } : x))} className="w-[100px]" aria-label={`Bonus for ${r.name}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function AttendanceModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [data, setData] = React.useState<Array<{ date: string; present: boolean; bonus: string | null; recorder_name: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const first = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    api.getAttendance(worker.id, { from: first, to: today }).then((res) => {
      setData(res as never[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [worker.id]);
  const present = data.filter((r) => r.present).length;
  const absent = data.filter((r) => !r.present).length;
  const bonus = data.reduce((s, r) => s + (Number(r.bonus) || 0), 0);
  const wage = Number(worker.daily_wage);
  const gross = present * wage + bonus;
  return (
    <Modal open onClose={onClose} title={`📅 Attendance — ${worker.full_name}`} size="lg" footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      {loading ? <p className="text-sm text-[var(--text-muted)]">Loading…</p> : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div className="rounded border border-[var(--border)] p-3 text-center"><div className="text-xs text-[var(--text-muted)]">Present</div><div className="text-xl font-bold text-[var(--success)]">{present}</div></div>
            <div className="rounded border border-[var(--border)] p-3 text-center"><div className="text-xs text-[var(--text-muted)]">Absent</div><div className="text-xl font-bold text-[var(--danger)]">{absent}</div></div>
            <div className="rounded border border-[var(--border)] p-3 text-center"><div className="text-xs text-[var(--text-muted)]">Gross (Month)</div><div className="text-lg font-bold">{fmtETB(gross)}</div></div>
          </div>
          <div className="max-h-[40vh] overflow-auto rounded border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--gray-50)]"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Bonus</th><th className="p-2 text-left">Recorded By</th></tr></thead>
              <tbody>
                {data.length ? data.map((r) => (
                  <tr key={r.date} className="border-t border-[var(--border)]">
                    <td className="p-2">{fmtDate(r.date)}</td>
                    <td className="p-2">{r.present ? <StatusBadge status="active" /> : <Badge variant="red">Absent</Badge>}</td>
                    <td className="p-2">{r.bonus ? fmtETB(r.bonus) : "—"}</td>
                    <td className="p-2">{r.recorder_name || "—"}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="p-4 text-center text-[var(--text-muted)]">No records this month</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

function SalaryModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [history, setHistory] = React.useState<Array<{ paid_at: string; amount: string; period_from: string; period_to: string; paid_by_name: string }>>([]);
  const [amount, setAmount] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();
  React.useEffect(() => {
    api.getWorkerSalary(worker.id).then((res) => setHistory(res as never[])).catch(() => {});
  }, [worker.id]);
  const handleSave = async () => {
    if (!amount || !paidAt) { toast("Amount and date required", "error"); return; }
    setSaving(true);
    try {
      await api.paySalary(worker.id, { amount: Number(amount), paidAt, periodFrom: from, periodTo: to, notes });
      toast("Salary payment recorded!", "success");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`💰 Salary — ${worker.full_name}`} size="lg" footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      <div className="mb-4 rounded border border-[var(--border)] p-3">
        <h4 className="mb-2 text-sm font-semibold">Record New Payment</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="sal-amount">Amount (ETB) *</Label><Input id="sal-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={0} step={0.01} /></div>
          <div><Label htmlFor="sal-date">Payment Date *</Label><Input id="sal-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
          <div><Label htmlFor="sal-from">Period From</Label><Input id="sal-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label htmlFor="sal-to">Period To</Label><Input id="sal-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label htmlFor="sal-notes">Notes</Label><Textarea id="sal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "✅ Record Payment"}</Button></div>
      </div>
      <h4 className="mb-2 text-sm font-semibold">Payment History</h4>
      <div className="max-h-[30vh] overflow-auto rounded border border-[var(--border)]">
        <table className="w-full text-sm"><thead className="bg-[var(--gray-50)]"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Amount</th><th className="p-2 text-left">Period</th><th className="p-2 text-left">Paid By</th></tr></thead>
          <tbody>
            {history.length ? history.map((h, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                <td className="p-2">{fmtDate(h.paid_at)}</td>
                <td className="p-2 font-semibold">{fmtETB(h.amount)}</td>
                <td className="p-2">{fmtDate(h.period_from)} – {fmtDate(h.period_to)}</td>
                <td className="p-2">{h.paid_by_name || "—"}</td>
              </tr>
            )) : <tr><td colSpan={4} className="p-4 text-center text-[var(--text-muted)]">No payments yet</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function IdCardModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const parts = (worker.full_name || "").trim().split(/\s+/);
  const initials = parts.map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "W";
  let attrs: Record<string, string> = {};
  if (worker.custom_attributes && typeof worker.custom_attributes === "object") attrs = worker.custom_attributes as Record<string, string>;
  return (
    <Modal open onClose={onClose} title="🪪 Worker ID Card" footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => window.print()}>🖨️ Print Card</Button></>}>
      <div className="flex justify-center py-4">
        <div className="w-[340px] overflow-hidden rounded-[18px] border border-[#e2e8f0] bg-white shadow-lg">
          <div className="flex h-[6px]"><div className="flex-1 bg-[#009c3a]" /><div className="flex-1 bg-[#f7d117]" /><div className="flex-1 bg-[#da121a]" /></div>
          <div className="bg-[#1e3a8a] p-3 text-center text-white">
            <div className="text-xs font-bold tracking-widest text-[#f7d117]">Dire Dawa City Administration</div>
            <div className="text-sm font-extrabold uppercase">Cleaning Management System</div>
            <div className="text-xs opacity-80">OFFICIAL WORKER IDENTIFICATION</div>
          </div>
          <div className="flex flex-col items-center p-5">
            <div className="relative mb-3"><div className="grid h-[90px] w-[90px] place-items-center rounded-full border-[3px] border-white bg-[#f3f4f6] text-3xl font-extrabold text-[#1e3a8a]">{initials}</div></div>
            <div className="mb-3 rounded-full border border-[#bbf7d0] bg-[#dcfce7] px-3 py-1 text-xs font-bold uppercase text-[#15803d]">{worker.is_active ? "ACTIVE" : "INACTIVE"}</div>
            <h4 className="text-lg font-extrabold text-[#1f2937]">{worker.full_name}</h4>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#0d9488]">Cleaning Professional</p>
            <div className="mb-3 grid w-full grid-cols-2 gap-2 border-y border-dashed border-[#e2e8f0] py-2 text-left">
              <div><span className="block text-xs uppercase text-[#9ca3af]">Zone</span><span className="text-sm font-bold">{worker.zone_name || "N/A"}</span></div>
              <div><span className="block text-xs uppercase text-[#9ca3af]">Daily Wage</span><span className="text-sm font-bold">{fmtETB(worker.daily_wage)}</span></div>
              <div className="col-span-2"><span className="block text-xs uppercase text-[#9ca3af]">Contact</span><span className="text-sm font-bold">{worker.contact || "—"}</span></div>
            </div>
            <div className="mb-3 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2 text-center">
              <span className="block text-xs font-bold uppercase tracking-wide text-[#475569]">Fayda National Digital ID</span>
              <span className="font-mono text-lg font-extrabold tracking-widest text-[#1e293b]">{worker.fayda_id ? formatFaydaId(worker.fayda_id) : "PENDING"}</span>
            </div>
            {Object.keys(attrs).length > 0 && (
              <div className="mb-3 grid w-full grid-cols-2 gap-2 rounded-lg border border-[#fed7aa] bg-[#fffbf7] p-2">
                {Object.entries(attrs).map(([k, v]) => (
                  <div key={k}><span className="block text-xs uppercase text-[#7c2d12]">{k}</span><span className="text-sm font-bold">{String(v)}</span></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
