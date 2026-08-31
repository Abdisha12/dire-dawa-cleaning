"use client";

// Lazy-loaded worker dialogs (item 34 — performance). Extracted from workers/page.tsx
// so heavy dialogs are code-split and only loaded when opened. Contains:
// WorkerFormModal, BulkAttendanceModal, AttendanceModal, SalaryModal, IdCardModal,
// WorkerDetailsDrawer.

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ApiError } from "@/lib/api";
import { workersApi } from "@/features/workers/services/workers-api";
import type { Worker, SaferZone, WorkerFormValues } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { fmtETB, fmtDate, validateFaydaId, formatFaydaId } from "@/lib/utils";

const workerSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(120),
  contact: z.string().max(30).optional().nullable(),
  faydaId: z.string().max(50).optional().nullable(),
  dailyWage: z.coerce.number().min(0).max(10000),
  saferZoneId: z.string().optional().nullable(),
  kebeleId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  customAttributes: z.record(z.string(), z.string()).optional(),
});

export function WorkerFormModal({
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
      kebeleId: worker ? String((worker as unknown as { kebele_id?: number }).kebele_id || "") : "",
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
    const contactVal: string = String(values.contact?.trim() ?? "");
    const payload: WorkerFormValues = {
      fullName: values.fullName.trim(),
      contact: contactVal || null,
      faydaId: values.faydaId ? values.faydaId.replace(/[\s-]/g, "") : null,
      dailyWage: Number(values.dailyWage),
      saferZoneId: values.saferZoneId ? String(values.saferZoneId) : null,
      kebeleId: values.kebeleId ? String(values.kebeleId) : null,
      isActive: values.isActive ?? true,
      customAttributes: Object.keys(attrs).length ? attrs : undefined,
    };
    try {
      if (worker) await workersApi.update(worker.id, payload);
      else await workersApi.create(payload);
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
            {form.formState.isSubmitting ? "Saving…" : <><Icons.save size={18} /> Save</>}
          </Button>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="wf-name">Full Name *</Label>
            <Input id="wf-name" {...form.register("fullName")} aria-invalid={!!form.formState.errors.fullName} aria-describedby={form.formState.errors.fullName ? "wf-name-error" : undefined} />
            {form.formState.errors.fullName && <p id="wf-name-error" role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.fullName.message}</p>}
          </div>
          <div>
            <Label htmlFor="wf-contact">Contact (Phone)</Label>
            <Input id="wf-contact" {...form.register("contact")} />
          </div>
          <div>
            <Label htmlFor="wf-fayda">Fayda/ID Number</Label>
            <Input id="wf-fayda" {...form.register("faydaId")} aria-invalid={!!form.formState.errors.faydaId} aria-describedby={form.formState.errors.faydaId ? "wf-fayda-error" : undefined} />
            {form.formState.errors.faydaId && <p id="wf-fayda-error" role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.faydaId.message}</p>}
          </div>
          <div>
            <Label htmlFor="wf-wage">Daily Wage (ETB) *</Label>
            <Input id="wf-wage" type="number" min={0} step={0.01} {...form.register("dailyWage")} aria-invalid={!!form.formState.errors.dailyWage} aria-describedby={form.formState.errors.dailyWage ? "wf-wage-error" : undefined} />
            {form.formState.errors.dailyWage && <p id="wf-wage-error" role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.dailyWage.message}</p>}
          </div>
          {myZone ? (
            <>
              <input type="hidden" {...form.register("saferZoneId")} value={String(myZone.id)} />
              <div>
                <Label>Zone</Label>
                <Input value={myZone.name} disabled aria-label="Zone (auto)" />
              </div>
            </>
          ) : isCollector ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Kebele</Label>
                <div className="rounded bg-[var(--information-l)] px-3 py-2 text-sm font-medium text-[var(--primary)]">
                  My Kebele — locked
                </div>
              </div>
              <div>
                <Label htmlFor="wf-zone">Zone</Label>
                <Select id="wf-zone" {...form.register("saferZoneId")}>
                  <option value="">Select Zone (optional)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={String(z.id)}>
                      {z.name} — {z.kebele_name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="wf-kebele">Kebele *</Label>
                <Select id="wf-kebele" {...form.register("kebeleId")} onChange={(e) => form.setValue("saferZoneId", "")}>
                  <option value="">Select Kebele</option>
                  {zones.map((z) => (
                    <option key={z.kebele_id} value={String(z.kebele_id)}>
                      {z.kebele_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="wf-zone">Zone *</Label>
                <Select id="wf-zone" {...form.register("saferZoneId")} disabled={!form.watch("kebeleId")}>
                  <option value="">Select Zone</option>
                  {zones.filter((z) => String(z.kebele_id) === form.watch("kebeleId")).map((z) => (
                    <option key={z.id} value={String(z.id)}>
                      {z.name}
                    </option>
                  ))}
                </Select>
              </div>
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

export function BulkAttendanceModal({ workers, onClose, onSaved }: { workers: Worker[]; onClose: () => void; onSaved: () => void }) {
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
      await workersApi.recordBulk({ date, records });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Record Daily Attendance" size="lg" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : <><Icons.bulkAttendance size={18} /> Save Attendance</>}</Button></>}>
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
                <td className="p-2"><label className="flex items-center gap-1"><input type="checkbox" aria-label={`Mark ${r.name} as present`} checked={r.present} onChange={(e) => setRows((prev) => prev.map((x) => x.workerId === r.workerId ? { ...x, present: e.target.checked } : x))} /> Present</label></td>
                <td className="p-2"><Input type="number" min={0} step={0.01} value={r.bonus} onChange={(e) => setRows((prev) => prev.map((x) => x.workerId === r.workerId ? { ...x, bonus: e.target.value } : x))} className="w-[100px]" aria-label={`Bonus for ${r.name}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export function AttendanceModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [data, setData] = React.useState<Array<{ date: string; present: boolean; bonus: string | null; recorder_name: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const first = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    workersApi.getAttendance(worker.id, { from: first, to: today }).then((res) => {
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
    <Modal open onClose={onClose} title={`Attendance — ${worker.full_name}`} size="lg" footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
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

export function SalaryModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [history, setHistory] = React.useState<Array<{ paid_at: string; amount: string; period_from: string; period_to: string; paid_by_name: string }>>([]);
  const [amount, setAmount] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { toast } = useToast();
  React.useEffect(() => {
    workersApi.getSalaryHistory(worker.id).then((res) => setHistory(res as never[])).catch(() => {});
  }, [worker.id]);
  const handleSave = async () => {
    if (!amount || !paidAt) { toast("Amount and date required", "error"); return; }
    setSaving(true);
    try {
      await workersApi.recordPayment(worker.id, { amount: Number(amount), paidAt, periodFrom: from, periodTo: to, notes });
      toast("Salary payment recorded!", "success");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Salary — ${worker.full_name}`} size="lg" footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
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

export function IdCardModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const parts = (worker.full_name || "").trim().split(/\s+/);
  const initials = parts.map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "W";
  let attrs: Record<string, string> = {};
  if (worker.custom_attributes && typeof worker.custom_attributes === "object") attrs = worker.custom_attributes as Record<string, string>;
  return (
    <Modal open onClose={onClose} title="Worker ID Card" footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => window.print()}><Icons.print size={18} /> Print Card</Button></>}>
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

export function WorkerDetailsDrawer({
  worker,
  onClose,
}: {
  worker: Worker;
  onClose: () => void;
}) {
  const [attendance, setAttendance] = React.useState<Array<{ date: string; present: boolean; bonus: string | null; recorder_name: string }>>([]);
  const [salary, setSalary] = React.useState<Array<{ paid_at: string; amount: string; period_from: string; period_to: string; paid_by_name: string }>>([]);
  const [attendanceLoading, setAttendanceLoading] = React.useState(true);
  const [salaryLoading, setSalaryLoading] = React.useState(true);

  React.useEffect(() => {
    const first = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    workersApi.getAttendance(worker.id, { from: first, to: today }).then((res) => {
      setAttendance(res as never[]);
      setAttendanceLoading(false);
    }).catch(() => setAttendanceLoading(false));
    workersApi.getSalaryHistory(worker.id).then((res) => {
      setSalary(res as never[]);
      setSalaryLoading(false);
    }).catch(() => setSalaryLoading(false));
  }, [worker.id]);

  const present = attendance.filter((r) => r.present).length;
  const absent = attendance.filter((r) => !r.present).length;
  const bonus = attendance.reduce((s, r) => s + (Number(r.bonus) || 0), 0);
  const wage = Number(worker.daily_wage);
  const gross = present * wage + bonus;

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Worker Details — ${worker.full_name}`}
    >
      <div className="space-y-6">
        {/* Profile */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">Profile</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-xs text-[var(--text-muted)]">Name</span><div className="font-medium">{worker.full_name}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Contact</span><div>{worker.contact || "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Fayda ID</span><div>{worker.fayda_id ? formatFaydaId(worker.fayda_id) : "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Status</span><div>{worker.is_active ? <StatusBadge status="active" /> : <Badge variant="gray">Inactive</Badge>}</div></div>
          </div>
        </section>

        {/* Employment */}
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">Employment</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-xs text-[var(--text-muted)]">Zone</span><div>{worker.zone_name ? <Badge variant="purple">{worker.zone_name}</Badge> : "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Kebele</span><div>{worker.kebele_name || "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Daily Wage</span><div className="font-semibold">{fmtETB(worker.daily_wage)}/day</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Status</span><div>{worker.is_active ? <StatusBadge status="active" /> : <Badge variant="gray">Inactive</Badge>}</div></div>
          </div>
        </section>

        {/* Kebele / Safer Zone */}
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">Kebele / Safer Zone</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-xs text-[var(--text-muted)]">Safer Zone</span><div>{worker.zone_name ? <Badge variant="purple">{worker.zone_name}</Badge> : "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Kebele</span><div>{worker.kebele_name || "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Zone ID</span><div className="font-mono text-sm">{worker.safer_zone_id || "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Kebele ID</span><div className="font-mono text-sm">{(worker as unknown as { kebele_id?: number }).kebele_id || "—"}</div></div>
          </div>
        </section>

        {/* Attendance */}
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">Attendance (Current Month)</h3>
          {attendanceLoading ? (
            <div className="h-8 animate-pulse bg-[var(--gray-100)] rounded" />
          ) : (
            <div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded border border-[var(--border)] p-3 text-center"><div className="text-xs text-[var(--text-muted)]">Present</div><div className="text-xl font-bold text-[var(--success)]">{attendance.filter((r) => r.present).length}</div></div>
                <div className="rounded border border-[var(--border)] p-3 text-center"><div className="text-xs text-[var(--text-muted)]">Absent</div><div className="text-xl font-bold text-[var(--danger)]">{attendance.filter((r) => !r.present).length}</div></div>
                <div className="rounded border border-[var(--border)] p-3 text-center"><div className="text-xs text-[var(--text-muted)]">Gross (Month)</div><div className="text-lg font-bold">{fmtETB(attendance.filter((r) => r.present).length * Number(worker.daily_wage) + attendance.reduce((s, r) => s + (Number(r.bonus) || 0), 0))}</div></div>
              </div>
              <div className="max-h-[30vh] overflow-auto rounded border border-[var(--border)]">
                <table className="w-full text-sm"><thead className="bg-[var(--gray-50)]"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Bonus</th><th className="p-2 text-left">Recorded By</th></tr></thead>
                <tbody>
                  {attendance.length ? attendance.map((r) => (
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
            </div>
          )}
        </section>

        {/* Salary */}
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">Salary Payments</h3>
          {salaryLoading ? (
            <div className="h-8 animate-pulse bg-[var(--gray-100)] rounded" />
          ) : (
            <div>
              <div className="max-h-[30vh] overflow-auto rounded border border-[var(--border)]">
                <table className="w-full text-sm"><thead className="bg-[var(--gray-50)]"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Amount</th><th className="p-2 text-left">Period</th><th className="p-2 text-left">Paid By</th></tr></thead>
                <tbody>
                  {salary.length ? salary.map((h, i) => (
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
            </div>
          )}
        </section>

        {/* Custom Attributes */}
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">Custom Attributes</h3>
          {(() => {
            let attrs: Record<string, string> = {};
            if (typeof (worker as unknown as { custom_attributes?: unknown }).custom_attributes === "object" && (worker as unknown as { custom_attributes?: Record<string, string> }).custom_attributes) {
              attrs = (worker as unknown as { custom_attributes: Record<string, string> }).custom_attributes;
            }
            if (Object.keys(attrs).length > 0) {
              return (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(attrs).map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-[#fed7aa] bg-[#fffbf7] p-2"><span className="block text-xs uppercase text-[#7c2d12]">{k}</span><span className="text-sm font-bold">{String(v)}</span></div>
                  ))}
                </div>
              );
            }
            return <p className="text-sm text-[var(--text-muted)]">No custom attributes</p>;
          })()}
        </section>
      </div>
    </Drawer>
  );
}