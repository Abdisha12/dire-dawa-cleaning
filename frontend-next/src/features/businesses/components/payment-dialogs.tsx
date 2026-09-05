"use client";
import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ApiError } from "@/lib/api";
import { paymentsApi } from "@/features/businesses/services/payments-api";
import { businessesApi } from "@/features/businesses/services/businesses-api";
import type { Business, Payment } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { fmtETB, fmtDate, monthName } from "@/lib/utils";

const paymentSchema = z.object({
  businessId: z.string().min(1, "Business is required"),
  amount: z.coerce.number().positive("Amount must be positive").max(10000000),
  method: z.string().optional(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  notes: z.string().max(1000).optional().nullable(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

export function PaymentFormModal({
  preselectedBusinessId,
  onClose,
  onSaved,
}: {
  preselectedBusinessId?: number | null;
  onClose: () => void;
  onSaved: (res: unknown) => void;
}) {
  const { toast } = useToast();
  const [businesses, setBusinesses] = React.useState<Business[]>([]);
  const [serverError, setServerError] = React.useState<string | null>(null);

  React.useEffect(() => {
    businessesApi.getAll().then((res) => {
      const arr = Array.isArray(res) ? res : (res as { data: Business[] })?.data || [];
      setBusinesses(arr);
    }).catch(() => {});
  }, []);

  const now = new Date();
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      businessId: preselectedBusinessId ? String(preselectedBusinessId) : "",
      amount: 0 as unknown as number,
      method: "cash",
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      notes: "",
    },
  });

  const selectedBizId = form.watch("businessId");
  React.useEffect(() => {
    if (selectedBizId) {
      const b = businesses.find((x) => String(x.id) === String(selectedBizId));
      if (b) form.setValue("amount", Number(b.monthly_target));
    }
  }, [selectedBizId, businesses, form]);

  const onSubmit = async (values: PaymentFormValues) => {
    setServerError(null);
    try {
      const res = await paymentsApi.create({
        businessId: Number(values.businessId),
        amount: String(values.amount),
        method: values.method || "cash",
        month: String(values.month),
        year: String(values.year),
        notes: values.notes || null,
      });
      onSaved(res);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed";
      setServerError(msg);
      toast(msg, "error");
    }
  };

  return (
    <Modal open onClose={onClose} title="Record Payment" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : "Record Payment"}</Button></>}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="pay-biz">Business *</Label>
          <Select id="pay-biz" {...form.register("businessId")} aria-invalid={!!form.formState.errors.businessId}>
            <option value="">Select business…</option>
            {businesses.map((b) => (
              <option key={b.id} value={String(b.id)} data-target={b.monthly_target}>
                {b.name} — {(b as unknown as { safer_zone_name?: string }).safer_zone_name || ""} ({(b as unknown as { kebele_name?: string }).kebele_name})
              </option>
            ))}
          </Select>
          {form.formState.errors.businessId && <p role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.businessId.message}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="pay-amount">Amount (ETB) *</Label>
            <Input id="pay-amount" type="number" min={0} step={0.01} {...form.register("amount")} aria-invalid={!!form.formState.errors.amount} />
            {form.formState.errors.amount && <p role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.amount.message}</p>}
          </div>
          <div>
            <Label htmlFor="pay-method">Payment Method</Label>
            <Select id="pay-method" {...form.register("method")}>
              <option value="cash">Cash</option>
              <option value="mobile">Mobile Money</option>
              <option value="bank">Bank Transfer</option>
              <option value="telebirr">Telebirr (Fabric API)</option>
              <option value="cbebirr">CBE Birr (Merchant Checkout)</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="pay-month">Month *</Label>
            <Select id="pay-month" {...form.register("month")}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {monthName(i + 1)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="pay-year">Year *</Label>
            <Input id="pay-year" type="number" {...form.register("year")} />
            {form.formState.errors.year && <p role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.year.message}</p>}
          </div>
        </div>
        <div>
          <Label htmlFor="pay-notes">Notes</Label>
          <Textarea id="pay-notes" {...form.register("notes")} rows={2} />
        </div>
        {serverError && <Alert variant="danger">{serverError}</Alert>}
      </form>
    </Modal>
  );
}

// Gateway QR checkout modal with polling + timeout + cancel
export function GatewayCheckoutModal({
  res,
  businessName,
  amount,
  onClose,
  onVerified,
}: {
  res: { id: number; receiptNumber: string; paymentUrl: string | null; gatewayName: string | null };
  businessName: string;
  amount: string | number;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [status, setStatus] = React.useState<"pending" | "paid" | "failed">("pending");
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const qrUrl = res.paymentUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(res.paymentUrl)}`
    : null;
  const title = res.gatewayName === "telebirr" ? "Telebirr Gateway" : "CBE Birr Gateway";
  const brandColor = res.gatewayName === "telebirr" ? "#d9383a" : "#1a5fb4";

  const checkStatus = React.useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const s = await paymentsApi.verify(res.id);
      if (s.status === "paid") {
        setStatus("paid");
        if (pollRef.current) clearInterval(pollRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        toast("Payment successfully completed and verified!", "success");
        onVerified();
        onClose();
      } else if (s.status === "failed") {
        setStatus("failed");
        if (pollRef.current) clearInterval(pollRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        toast("Payment transaction failed or was declined.", "error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setChecking(false);
    }
  }, [res.id, onClose, onVerified, toast]);

  React.useEffect(() => {
    pollRef.current = setInterval(checkStatus, 3000);
    // auto-timeout after 90s
    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setError("Verification timed out. Please check status later or retry.");
    }, 90000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [checkStatus]);

  const cleanup = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    onClose();
  };

  return (
    <Modal open onClose={cleanup} title={title} footer={<><Button variant="outline" onClick={cleanup}>Cancel</Button><Button onClick={checkStatus} disabled={checking}>{checking ? "Checking…" : "Check Status"}</Button></>}>
      <div className="text-center">
        <div className="text-lg font-semibold text-[var(--gray-900)]">{businessName}</div>
        <div className="mb-4 text-xl font-bold text-[var(--success)]">{fmtETB(amount)}</div>
        {qrUrl ? (
          <div className="mx-auto mb-4 inline-block rounded-xl border border-[var(--border)] bg-[#f9fafb] p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="Scan to Pay" width={180} height={180} className="mx-auto block h-[180px] w-[180px]" />
            <div className="mt-2 text-xs text-[var(--text-muted)]">Scan QR code with your mobile wallet app</div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No payment URL available</p>
        )}
        {res.paymentUrl && (
          <div className="mb-4">
            <a href={res.paymentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-[210px] justify-center rounded-md px-4 py-2 text-sm font-medium text-white no-underline" style={{ background: brandColor }}>
              Open Sandbox Portal
            </a>
          </div>
        )}
        <div className="flex items-center justify-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" aria-hidden />
          <span className="text-sm text-[var(--text-muted)]" role="status" aria-live="polite">
            {status === "pending" ? "Waiting for gateway confirmation..." : status === "paid" ? "Payment verified!" : "Payment failed"}
          </span>
        </div>
        {error && <Alert variant="danger" className="mt-3 text-left">{error}</Alert>}
        {status === "failed" && <Alert variant="danger" className="mt-3">Payment failed or declined.</Alert>}
      </div>
    </Modal>
  );
}

export function ReceiptModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  // print helper — hide non-print areas via print media query handled globally
  return (
    <Modal open onClose={onClose} title="Payment Receipt" footer={<><Button variant="outline" onClick={onClose} data-print="hide">Close</Button><Button onClick={() => window.print()} data-print="hide"><Icons.print size={18} /> Print</Button></>}>
      <div id="receipt-print" className="rounded-lg border border-[var(--border)] bg-[var(--gray-50)] p-6 font-mono print:border-none print:bg-white print:p-0">
        <style>{`@media print { [data-print="hide"]{display:none !important} #receipt-print{border:none !important; box-shadow:none !important} }`}</style>
        <div className="mb-4 text-center">
          <div className="text-xl">🧹</div>
          <div className="font-bold">Dire Dawa Cleaning Management</div>
          <div className="text-xs text-[var(--text-muted)]">Official Payment Receipt</div>
        </div>
        <hr className="my-3 border-[var(--border)]" />
        <table className="w-full text-sm">
          <tbody>
            <tr><td className="py-1 text-[var(--text-muted)]">Receipt #</td><td className="py-1 text-right font-bold">{payment.receipt_number || "—"}</td></tr>
            <tr><td className="py-1 text-[var(--text-muted)]">Business</td><td className="py-1 text-right">{payment.business_name || `Business #${payment.business_id}`}</td></tr>
            <tr><td className="py-1 text-[var(--text-muted)]">Zone</td><td className="py-1 text-right">{payment.safer_zone_name || "—"}</td></tr>
            <tr><td className="py-1 text-[var(--text-muted)]">Kebele</td><td className="py-1 text-right">{payment.kebele_name || "—"}</td></tr>
            <tr><td className="py-1 text-[var(--text-muted)]">Period</td><td className="py-1 text-right">{monthName(payment.month)} {payment.year}</td></tr>
            <tr><td className="py-1 text-[var(--text-muted)]">Method</td><td className="py-1 text-right">{payment.method}</td></tr>
            <tr><td className="py-1 text-[var(--text-muted)]">Paid</td><td className="py-1 text-right">{payment.paid_at ? fmtDate(payment.paid_at) : "—"}</td></tr>
            <tr><td className="py-1 text-[var(--text-muted)]">Collector</td><td className="py-1 text-right">{payment.collector_name || "—"}</td></tr>
          </tbody>
        </table>
        <hr className="my-3 border-[var(--border)]" />
        <div className="flex justify-between text-lg font-bold">
          <span>TOTAL PAID</span>
          <span className="text-[var(--success)]">{fmtETB(payment.amount)}</span>
        </div>
        {payment.notes && <div className="mt-3 text-xs text-[var(--text-muted)]">Note: {payment.notes}</div>}
        <div className="mt-4 text-center text-xs text-[var(--text-muted)]">Generated {new Date().toLocaleString()}</div>
      </div>
    </Modal>
  );
}
