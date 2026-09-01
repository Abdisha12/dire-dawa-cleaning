"use client";
import type { Payment } from "@/types";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { fmtETB, fmtDate, monthName } from "@/lib/utils";

function paymentStatusBadge(status: string) {
  if (status === "paid") return <StatusBadge status="paid" />;
  if (status === "pending") return <Badge variant="orange">Pending</Badge>;
  if (status === "overdue") return <Badge variant="red">Overdue</Badge>;
  if (status === "failed") return <Badge variant="red">Failed</Badge>;
  return <Badge variant="gray">{status}</Badge>;
}

export function PaymentCard({ payment, canDelete, onReceipt, onDelete }: { payment: Payment; canDelete: boolean; onReceipt: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs font-bold">{payment.receipt_number || "—"}</div>
          <div className="font-semibold">{payment.business_name || `Business #${payment.business_id}`}</div>
          <div className="text-xs text-[var(--text-muted)]">{payment.kebele_name || "—"} · {payment.safer_zone_name || "—"}</div>
        </div>
        {paymentStatusBadge(payment.status)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-[var(--text-muted)]">Amount</span><div className="font-bold text-sm">{fmtETB(payment.amount)}</div></div>
        <div><span className="text-[var(--text-muted)]">Method</span><div><Badge variant="gray">{payment.method}</Badge></div></div>
        <div><span className="text-[var(--text-muted)]">Period</span><div>{monthName(payment.month)} {payment.year}</div></div>
        <div><span className="text-[var(--text-muted)]">Paid At</span><div>{payment.paid_at ? fmtDate(payment.paid_at) : "—"}</div></div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={onReceipt} aria-label={`Receipt ${payment.receipt_number}`} className="min-h-[44px] flex-1">
          <Icons.receipt size={16} /> Receipt
        </Button>
        {canDelete && (
          <Button size="sm" variant="danger" onClick={onDelete} aria-label={`Delete ${payment.receipt_number}`} className="min-h-[44px]">
            <Icons.trash size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
