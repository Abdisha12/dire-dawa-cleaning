"use client";
import type { Business } from "@/types";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { fmtETB } from "@/lib/utils";

export function BusinessCard({
  business,
  canEdit,
  isAdmin,
  onView,
  onEdit,
  onDelete,
  onPay,
}: {
  business: Business;
  canEdit: boolean;
  isAdmin: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPay: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{business.name}</div>
          <div className="text-xs text-[var(--text-muted)]">
            Owner: {business.owner_name} {business.owner_fayda_id ? `· ${business.owner_fayda_id}` : ""}
          </div>
        </div>
        {business.is_active ? <StatusBadge status="active" /> : <Badge variant="gray">Inactive</Badge>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-[var(--text-muted)]">Type</span>
          <div>
            <Badge variant="gray">{business.type}</Badge>
          </div>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Monthly Target</span>
          <div className="font-semibold">{fmtETB(business.monthly_target)}</div>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Kebele</span>
          <div>{(business as unknown as { kebele_name?: string }).kebele_name || "—"}</div>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Zone</span>
          <div>{(business as unknown as { safer_zone_name?: string }).safer_zone_name || "—"}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button size="sm" variant="outline" onClick={onView} aria-label={`View ${business.name}`} className="min-h-[44px]">
          <Icons.view size={16} /> View
        </Button>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Edit ${business.name}`} className="min-h-[44px]">
            <Icons.edit size={16} /> Edit
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onPay} aria-label={`Pay ${business.name}`} className="min-h-[44px]">
          <Icons.payments size={16} /> Pay
        </Button>
        {isAdmin && (
          <Button size="sm" variant="danger" onClick={onDelete} aria-label={`Delete ${business.name}`} className="min-h-[44px]">
            <Icons.trash size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
