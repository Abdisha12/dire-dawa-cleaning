"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { paymentsApi } from "@/features/businesses/services/payments-api";
import { businessesApi } from "@/features/businesses/services/businesses-api";
import type { Payment, SaferZone } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { fmtETB, fmtDate, monthName } from "@/lib/utils";
import { PaymentCard } from "@/features/businesses/components/payment-card";

const PaymentFormModal = React.lazy(() =>
  import("@/features/businesses/components/payment-dialogs").then((m) => ({ default: m.PaymentFormModal }))
);
const GatewayCheckoutModal = React.lazy(() =>
  import("@/features/businesses/components/payment-dialogs").then((m) => ({ default: m.GatewayCheckoutModal }))
);
const ReceiptModal = React.lazy(() =>
  import("@/features/businesses/components/payment-dialogs").then((m) => ({ default: m.ReceiptModal }))
);
const DialogFallback = () => <div className="p-4 text-sm text-[var(--text-muted)]">Loading…</div>;

function paymentStatusBadge(status: string) {
  if (status === "paid") return <StatusBadge status="paid" />;
  if (status === "pending") return <Badge variant="orange">Pending</Badge>;
  if (status === "overdue") return <Badge variant="red">Overdue</Badge>;
  if (status === "failed") return <Badge variant="red">Failed</Badge>;
  return <Badge variant="gray">{status}</Badge>;
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const { toast } = useToast();
  const role = user?.role;
  const zone = user?.zone as SaferZone | null | undefined;
  const canEdit = role === "admin" || role === "collector" || role === "leader";
  const isAdmin = role === "admin";

  const now = new Date();
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [zones, setZones] = React.useState<SaferZone[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  const [kebeleFilter, setKebeleFilter] = React.useState<string>(() => (kebeleId ? String(kebeleId) : ""));
  const [monthFilter, setMonthFilter] = React.useState<string>(String(now.getMonth() + 1));
  const [yearFilter, setYearFilter] = React.useState<string>(String(now.getFullYear()));
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [methodFilter, setMethodFilter] = React.useState<string>("");

  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;

  const [showForm, setShowForm] = React.useState(false);
  const [gatewayRes, setGatewayRes] = React.useState<{ id: number; receiptNumber: string; paymentUrl: string | null; gatewayName: string | null } | null>(null);
  const [gatewayBizName, setGatewayBizName] = React.useState<string>("");
  const [gatewayAmount, setGatewayAmount] = React.useState<string | number>("");
  const [receiptPayment, setReceiptPayment] = React.useState<Payment | null>(null);

  const [summary, setSummary] = React.useState<{ collected: number; pending: number; overdue: number } | null>(null);

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
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;
      if (statusFilter) params.status = statusFilter;
      if (methodFilter) params.method = methodFilter;

      const [z, pRes] = await Promise.all([
        businessesApi.getZones(undefined, { signal: ctrl.signal }),
        paymentsApi.getAll(params, { signal: ctrl.signal }),
      ]);
      setZones(z);
      const isPaginated = pRes && typeof pRes === "object" && "data" in (pRes as Record<string, unknown>);
      const pData: Payment[] = isPaginated ? (pRes as { data: Payment[] }).data : (pRes as Payment[]) || [];
      const meta = isPaginated ? (pRes as { total: number; pages: number }) : { total: pData.length, pages: 1 };
      setPayments(pData);
      if (isPaginated) {
        setTotal(meta.total);
        setPages(meta.pages);
      } else {
        setTotal(pData.length);
        setPages(1);
      }
      // summary: derive from fetched page if paginated totals not available via dashboard
      // Try dashboard endpoint for authoritative totals, fallback to page calc
      try {
        const dash = await paymentsApi.getDashboard({ month: monthFilter, year: yearFilter }, { signal: ctrl.signal });
        if (dash?.totals) {
          setSummary({
            collected: Number(dash.totals.total_collected) || 0,
            pending: Number(dash.totals.total_pending) || 0,
            overdue: Number(dash.totals.total_overdue) || 0,
          });
        } else {
          const collected = pData.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
          const pending = pData.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);
          const overdue = pData.filter((p) => p.status === "overdue").reduce((s, p) => s + Number(p.amount), 0);
          setSummary({ collected, pending, overdue });
        }
      } catch {
        const collected = pData.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
        const pending = pData.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);
        const overdue = pData.filter((p) => p.status === "overdue").reduce((s, p) => s + Number(p.amount), 0);
        setSummary({ collected, pending, overdue });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, debouncedSearch, kebeleFilter, monthFilter, yearFilter, statusFilter, methodFilter]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = summary || {
    collected: payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0),
    pending: payments.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0),
    overdue: payments.filter((p) => p.status === "overdue").reduce((s, p) => s + Number(p.amount), 0),
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this payment record permanently?")) return;
    try {
      await paymentsApi.delete(id);
      toast("Payment deleted", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const handlePaymentSuccess = async (res: unknown) => {
    const r = res as { status: string; paymentUrl: string | null; gatewayName: string | null; receiptNumber: string; id: number; amount?: string };
    // For gateway, need business name/amount — we can look up from temp state
    // PaymentFormModal doesn't return business name; we preserve via closure if needed
    // For now, fetch business name via API if gateway
    if (r.status === "pending" && r.paymentUrl) {
      setShowForm(false);
      const bizName = "Business";
      const amt: string | number = r.amount || "";
      setGatewayBizName(bizName);
      setGatewayAmount(amt);
      setGatewayRes({ id: r.id, receiptNumber: r.receiptNumber, paymentUrl: r.paymentUrl, gatewayName: r.gatewayName });
    } else {
      setShowForm(false);
      toast(`Payment recorded! Receipt: ${r.receiptNumber}`, "success");
      fetchData();
    }
  };

  const columns: Column<Payment>[] = [
    { key: "receipt_number", header: "Receipt", render: (p) => <code className="rounded bg-[var(--gray-100)] px-1.5 py-0.5 text-xs">{p.receipt_number || "—"}</code> },
    { key: "business_name", header: "Business", render: (p) => p.business_name || `Business #${p.business_id}` },
    { key: "kebele_name", header: "Kebele", render: (p) => p.kebele_name || "—", priority: 2 },
    { key: "safer_zone_name", header: "Zone", render: (p) => p.safer_zone_name || "—", priority: 2 },
    { key: "amount", header: "Amount", render: (p) => <strong>{fmtETB(p.amount)}</strong> },
    { key: "method", header: "Method", render: (p) => <Badge variant="gray">{p.method}</Badge> },
    { key: "status", header: "Status", render: (p) => paymentStatusBadge(p.status) },
    { key: "period", header: "Period", render: (p) => `${monthName(p.month)} ${p.year}` },
    { key: "paid_at", header: "Paid At", render: (p) => (p.paid_at ? fmtDate(p.paid_at) : "—"), priority: 2 },
    { key: "collector_name", header: "Collector", render: (p) => p.collector_name || "—", priority: 2 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Payments</h1>
          <p className="text-sm text-[var(--text-muted)]">Collections and receipts — {role === "collector" && kebeleId ? "My Kebele" : role === "leader" && zone ? zone.name : "City-wide"}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const url = paymentsApi.csvUrl("/reports/payments/monthly", { month: monthFilter, year: yearFilter });
              window.open(url, "_blank");
            }}
          >
            Export CSV
          </Button>
          {canEdit && <Button onClick={() => setShowForm(true)}>＋ Record Payment</Button>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Collected" value={fmtETB(stats.collected)} sub="Paid" accent="green" />
        <StatCard label="Pending" value={fmtETB(stats.pending)} sub="Awaiting" accent="orange" />
        <StatCard label="Overdue" value={fmtETB(stats.overdue)} sub="Overdue" accent="red" />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        {role === "admin" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="p-kebele">Kebele</Label>
            <Select id="p-kebele" value={kebeleFilter} onChange={(e) => { setKebeleFilter(e.target.value); setPage(1); }} className="w-[150px]" aria-label="Filter by kebele">
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
        <div className="flex flex-col gap-1">
          <Label htmlFor="p-month">Month</Label>
          <Select id="p-month" value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }} className="w-[110px]" aria-label="Filter by month">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>{monthName(i + 1)}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="p-year">Year</Label>
          <Input id="p-year" type="number" value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }} className="w-[90px]" aria-label="Filter by year" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="p-status">Status</Label>
          <Select id="p-status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-[125px]" aria-label="Filter by status">
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="failed">Failed</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="p-method">Method</Label>
          <Select id="p-method" value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }} className="w-[145px]" aria-label="Filter by method">
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="mobile">Mobile</option>
            <option value="bank">Bank</option>
            <option value="telebirr">Telebirr</option>
            <option value="cbebirr">CBE Birr</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="p-search">Search</Label>
          <Input id="p-search" placeholder="Receipt, business…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-[200px]" aria-label="Search payments" />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No payments"
          emptyDescription="No payment records for this period."
          getRowKey={(p) => String(p.id)}
          page={page}
          pages={pages}
          onPage={(p) => setPage(p)}
          rowActions={(p) => (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setReceiptPayment(p)} aria-label={`Receipt ${p.receipt_number}`}><Icons.receipt size={16} /></Button>
              {isAdmin && (
                <Button size="sm" variant="danger" onClick={() => handleDelete(p.id)} aria-label={`Delete ${p.receipt_number}`}><Icons.trash size={16} /></Button>
              )}
            </div>
          )}
        />
      </div>

      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-xl bg-[var(--gray-100)]" />)}</div>
        ) : payments.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No payments for this period.</p>
          </div>
        ) : (
          payments.map((p) => <PaymentCard key={p.id} payment={p} canDelete={isAdmin} onReceipt={() => setReceiptPayment(p)} onDelete={() => handleDelete(p.id)} />)
        )}
        {!loading && payments.length > 0 && (
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <span className="px-3 py-2 text-xs text-[var(--text-muted)]">Page {page} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      {showForm && !gatewayRes && (
        <React.Suspense fallback={<DialogFallback />}>
          <PaymentFormModal onClose={() => setShowForm(false)} onSaved={handlePaymentSuccess} />
        </React.Suspense>
      )}
      {gatewayRes && (
        <React.Suspense fallback={<DialogFallback />}>
          <GatewayCheckoutModal res={gatewayRes} businessName={gatewayBizName || "Business"} amount={gatewayAmount || 0} onClose={() => { setGatewayRes(null); setShowForm(false); }} onVerified={() => { setGatewayRes(null); setShowForm(false); fetchData(); }} />
        </React.Suspense>
      )}
      {receiptPayment && (
        <React.Suspense fallback={<DialogFallback />}>
          <ReceiptModal payment={receiptPayment} onClose={() => setReceiptPayment(null)} />
        </React.Suspense>
      )}
    </div>
  );
}
