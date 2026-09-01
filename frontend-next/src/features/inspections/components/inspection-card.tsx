"use client";
import type { Inspection } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { fmtDate } from "@/lib/utils";

function statusBadge(status: string) {
  if (status === "active") return <Badge variant="green">Active</Badge>;
  if (status === "warning") return <Badge variant="orange">Warning</Badge>;
  if (status === "danger") return <Badge variant="red">Danger</Badge>;
  return <Badge variant="gray">{status}</Badge>;
}

export function InspectionCard({
  inspection,
  canEdit,
  isAdmin,
  onEdit,
  onDelete,
  onViewPhotos,
  onView,
}: {
  inspection: Inspection;
  canEdit: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onViewPhotos: () => void;
  onView?: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{fmtDate(inspection.date)}</div>
          <div className="text-xs text-[var(--text-muted)]">{inspection.kebele_name || "—"} · {inspection.zone_name || "Kebele-level"}</div>
        </div>
        {statusBadge(inspection.status)}
      </div>
      <div className="mt-2 text-xs">
        <span className="text-[var(--text-muted)]">Inspector</span>
        <div className="font-medium">{inspection.inspector_name || "—"}</div>
      </div>
      {inspection.photos?.length ? (
        <Button size="sm" variant="outline" onClick={onViewPhotos} aria-label={`Photos ${inspection.id}`} className="mt-2 w-full min-h-[44px]">
          <Icons.view size={16} /> {inspection.photos.length} Photos
        </Button>
      ) : (
        <div className="mt-2 text-xs text-[var(--text-muted)]">No photos</div>
      )}
      {inspection.notes && <p className="mt-2 line-clamp-2 text-sm text-[var(--text-muted)]">{inspection.notes}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onView?.() ?? onViewPhotos()} aria-label={`View inspection ${inspection.id}`} className="min-h-[44px] flex-1">
          <Icons.view size={16} /> Details
        </Button>
        {inspection.photos?.length ? (
          <Button size="sm" variant="outline" onClick={onViewPhotos} aria-label={`Photos ${inspection.id}`} className="min-h-[44px]">
            <Icons.view size={16} /> {inspection.photos.length}
          </Button>
        ) : null}
      </div>
      {canEdit && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Edit inspection ${inspection.id}`} className="min-h-[44px]">
            <Icons.edit size={16} /> Edit
          </Button>
          {isAdmin && (
            <Button size="sm" variant="danger" onClick={onDelete} aria-label={`Delete inspection ${inspection.id}`} className="min-h-[44px]">
              <Icons.trash size={16} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
