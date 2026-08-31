"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { workersApi, formatETB } from "@/features/workers/services/workers-api";
import type { Worker } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, StatCard } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { fmtETB, fmtDate, todayISO } from "@/lib/utils";

type SalaryRecord = {
  id: number;
  worker_id: number;
  worker_name: string;
  zone_name: string;
  kebele_name: string;
  amount: string;
  paid_at: string;
  period_from: string;
  period_to: string;
  notes: string | null;
  paid_by_name: string;
};

export default function SalaryPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const { toast } = useToast();
  const role = user?.role;
  const zone = user?.zone as unknown as { id: number; name: string } | null | undefined;

  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [records, setRecords] = React.useState<SalaryRecord[]>([]);
  const [zones, setZones] = React.useState<Array<{ id: number; name: string; kebele_name: string; kebele_id: number }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [zoneFilter, setZoneFilter] = React.useState("");
  const [kebeleFilter, setKebeleFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;

  // Summary
  const [summary, setSummary] = React.useState<{ totalPaid: number; count: number } | null>(null);

  // Pay modal
  const [showPay, setShowPay] = React.useState(false);
  const [payWorkerId, setPayWorkerId] = React.useState<string>("");
  const [amount, setAmount] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(() => todayISO());
  const [from, setFrom] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = React.useState(() => todayISO());
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [payError, setPayError] = React.useState<string | null>(null);

  const visibleZones = React.useMemo(() => {
    if (role === "leader" && zone) return zones.filter((z) => z.id === zone.id);
    if (role === "collector" && kebeleId) return zones.filter((z) => String(z.kebele_id) === String(kebeleId));
    if (kebeleFilter) return zones.filter((z) => String(z.kebele_id) === kebeleFilter);
    return zones;
  }, [zones, role, zone, kebeleId, kebeleFilter]);

  // Debounce search 300ms
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchZones = React.useCallback(async () => {
    try {
      const res = await workersApi.getZones(undefined);
      setZones(res as unknown as Array<{ id: number; name: string; kebele_name: string; kebele_id: number }>);
    } catch {}
  }, []);

  React.useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const fetchWorkers = React.useCallback(async () => {
    try {
      const res = await workersApi.getAll(kebeleFilter ? { kebeleId: kebeleFilter } : {});
      const data = Array.isArray(res) ? res : (res as { data: Worker[] }).data;
      setWorkers(data);
    } catch {}
  }, [kebeleFilter]);

  React.useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const fetchRecords = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    try {
      // For now, fetch all workers' salaries and aggregate client-side with pagination
      // In production, backend should have GET /salary_payments with pagination
      const allWorkersRes = await workersApi.getAll(
        {
          ...(kebeleFilter ? { kebeleId: kebeleFilter } : {}),
          ...(zoneFilter ? { zoneId: zoneFilter } : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          page: String(page),
          limit: String(limit),
        },
        { signal: ctrl.signal }
      );
      const wData: Worker[] = Array.isArray(allWorkersRes) ? allWorkersRes : (allWorkersRes as { data: Worker[] }).data || [];
      // Fetch salary history for each worker on current page (scoped, no floating-point)
      const histories = await Promise.all(
        wData.map((w) =>
          workersApi
            .getSalaryHistory(w.id, { signal: ctrl.signal })
            .then((h) =>
              (h as SalaryRecord[]).map((r) => ({
                ...r,
                worker_name: w.full_name,
                zone_name: w.zone_name || "—",
                kebele_name: w.kebele_name || "—",
              }))
            )
            .catch(() => [] as SalaryRecord[])
        )
      );
      const flat = histories.flat().sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
      // Client-side pagination for salary records (backend does not yet paginate salary globally)
      const totalRecords = flat.length;
      const paged = flat.slice((page - 1) * limit, page * limit);
      setRecords(paged);
      setTotal(totalRecords);
      setPages(Math.max(1, Math.ceil(totalRecords / limit)));

      // Summary: total paid (ETB) via safe integer cents
      const totalPaid = flat.reduce((sum, r) => sum + Math.round(Number(r.amount) * 100), 0) / 100;
      setSummary({ totalPaid, count: totalRecords });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load salaries");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, debouncedSearch, kebeleFilter, zoneFilter]);

  React.useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handlePay = async () => {
    setPayError(null);
    if (!payWorkerId || !amount || !paidAt) {
      setPayError("Worker, amount and date are required");
      return;
    }
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setPayError("Amount must be a positive number");
      return;
    }
    setSaving(true);
    try {
      await workersApi.recordPayment(Number(payWorkerId), {
        amount: amt,
        paidAt,
        periodFrom: from,
        periodTo: to,
        notes: notes || undefined,
      });
      toast("Salary payment recorded", "success");
      setShowPay(false);
      setAmount("");
      setNotes("");
      fetchRecords();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<SalaryRecord>[] = [
    { key: "worker_name", header: "Worker", render: (r) => <strong>{r.worker_name}</strong> },
    { key: "zone_name", header: "Zone", render: (r) => <Badge variant="purple">{r.zone_name}</Badge> },
    { key: "kebele_name", header: "Kebele", render: (r) => r.kebele_name },
    {
      key: "amount",
      header: "Amount",
      render: (r) => <span className="font-semibold">{formatETB(r.amount)}</span>,
    },
    { key: "paid_at", header: "Paid At", render: (r) => fmtDate(r.paid_at) },
    {
      key: "period",
      header: "Period",
      render: (r) => `${fmtDate(r.period_from)} – ${fmtDate(r.period_to)}`,
    },
    { key: "paid_by_name", header: "Paid By" },
  ];

  const canPay = role === "admin" || role === "collector" || role === "leader";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Salary Payments</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Worker salary history {role === "collector" && kebeleId ? "— My Kebele" : role === "leader" && zone ? `— ${zone.name}` : "— City-wide"} · ETB via {fmtETB(0).split(" ")[0]}
          </p>
        </div>
        {canPay && (
          <Button onClick={() => setShowPay(true)}>＋ Record Payment</Button>
        )}
      </div>

      {/* Summary — API-supported only */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Records" value={summary?.count ?? total} sub="Salary payments in scope" accent="blue" />
        <StatCard label="Total Paid" value={summary ? formatETB(summary.totalPaid) : "—"} sub="ETB, integer cents" accent="green" />
        <StatCard label="Scope" value={role === "collector" ? "My Kebele" : role === "leader" ? "My Zone" : "All"} sub={kebeleFilter ? `Kebele ${kebeleFilter}` : "All kebeles"} accent="purple" />
      </div>

      {/* Filters — reusable, role-aware */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        {role === "admin" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="s-kebele">Kebele</Label>
            <Select
              id="s-kebele"
              value={kebeleFilter}
              onChange={(e) => {
                setKebeleFilter(e.target.value);
                setZoneFilter("");
                setPage(1);
              }}
              className="w-[160px]"
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
        {role === "collector" && kebeleId && (
          <div className="flex flex-col gap-1">
            <Label>Kebele</Label>
            <div className="rounded bg-[var(--information-l)] px-3 py-2 text-sm font-medium text-[var(--primary)]">My Kebele — locked</div>
          </div>
        )}
        {role !== "leader" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="s-zone">Zone</Label>
            <Select id="s-zone" value={zoneFilter} onChange={(e) => { setZoneFilter(e.target.value); setPage(1); }} className="w-[200px]">
              <option value="">All Zones</option>
              {visibleZones.map((z) => (
                <option key={z.id} value={String(z.id)}>
                  {z.name} ({z.kebele_name})
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="s-search">Search</Label>
          <Input id="s-search" placeholder="Worker name, Fayda…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-[280px]" />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        error={error}
        onRetry={fetchRecords}
        emptyTitle="No salary records"
        emptyDescription="No payments in this scope. Record a payment to get started."
        getRowKey={(r) => String(r.id)}
        page={page}
        pages={pages}
        onPage={setPage}
      />

      {/* Pay modal — salary security: worker must belong to my kebele, backend enforces workerBelongsToKebele */}
      {showPay && (
        <Modal
          open
          onClose={() => setShowPay(false)}
           title="Record Salary Payment"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowPay(false)}>
                Cancel
              </Button>
              <Button onClick={handlePay} disabled={saving}>
                {saving ? "Saving…" : "✅ Record Payment"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <Label htmlFor="pay-worker">Worker *</Label>
              <Select id="pay-worker" value={payWorkerId} onChange={(e) => setPayWorkerId(e.target.value)}>
                <option value="">Select Worker</option>
                {workers.map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {w.full_name} — {w.zone_name || "—"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pay-amount">Amount (ETB) *</Label>
                <Input id="pay-amount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pay-date">Paid At *</Label>
                <Input id="pay-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pay-from">Period From *</Label>
                <Input id="pay-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pay-to">Period To *</Label>
                <Input id="pay-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="pay-notes">Notes</Label>
                <Textarea id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
            {payError && <Alert variant="danger">{payError}</Alert>}
            <p className="text-xs text-[var(--text-muted)]">Backend validates worker_id/kebele/amount — never trust client. Amount stored as NUMERIC(10,2), displayed via {fmtETB(0).split(" ")[0]} integer cents.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
