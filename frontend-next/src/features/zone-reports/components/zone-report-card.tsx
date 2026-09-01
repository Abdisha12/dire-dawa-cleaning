"use client";
import type { ZoneReport } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { fmtETB, monthName } from "@/lib/utils";

function statusBadge(s: string) {
  if (s === "draft") return <Badge variant="gray">Draft</Badge>;
  if (s === "submitted") return <Badge variant="orange">Submitted</Badge>;
  if (s === "reviewed") return <Badge variant="blue">Reviewed</Badge>;
  if (s === "approved") return <Badge variant="green">Approved</Badge>;
  return <Badge variant="gray">{s}</Badge>;
}

export function ZoneReportCard({
  report,
  isLeader,
  canReview,
  onView,
  onEdit,
  onSubmit,
  onReview,
  onApprove,
}: {
  report: ZoneReport;
  isLeader: boolean;
  canReview: boolean;
  onView: () => void;
  onEdit: () => void;
  onSubmit: () => void;
  onReview: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{report.zone_name || `Zone ${report.safer_zone_id}`}</div>
          <div className="text-xs text-[var(--text-muted)]">{report.kebele_name || "—"} · {monthName(report.report_month)} {report.report_year}</div>
        </div>
        {statusBadge(report.status)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-[var(--text-muted)]">Workers</span><div>✅{report.workers_present ?? 0} ❌{report.workers_absent ?? 0}</div></div>
        <div><span className="text-[var(--text-muted)]">Collection</span><div className="font-semibold">{fmtETB(report.collection_total)}</div></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={onView} className="min-h-[44px]"><Icons.view size={16} /> View</Button>
        {isLeader && report.status === "draft" && (
          <>
            <Button size="sm" variant="outline" onClick={onEdit} className="min-h-[44px]"><Icons.edit size={16} /></Button>
            <Button size="sm" variant="outline" onClick={onSubmit} className="min-h-[44px] col-span-2">Submit</Button>
          </>
        )}
        {canReview && report.status === "submitted" && (
          <Button size="sm" variant="outline" onClick={onReview} className="min-h-[44px] col-span-2">Review</Button>
        )}
        {canReview && report.status === "reviewed" && (
          <Button size="sm" variant="outline" onClick={onApprove} className="min-h-[44px] col-span-2">Approve</Button>
        )}
      </div>
    </div>
  );
}
