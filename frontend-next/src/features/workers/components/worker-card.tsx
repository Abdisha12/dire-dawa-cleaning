"use client";

import * as React from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatETB } from "@/features/workers/services/workers-api";
import { fmtETB, formatFaydaId } from "@/lib/utils";
import type { Worker } from "@/types";

type WorkerCardProps = {
  worker: Worker;
  canEdit: boolean;
  isAdmin: boolean;
  onView: () => void;
  onEdit: () => void;
  onAttendance: () => void;
  onIdCard: () => void;
  onSalary: () => void;
  onDelete: () => void;
};

export function WorkerCard({
  worker,
  canEdit,
  isAdmin,
  onView,
  onEdit,
  onAttendance,
  onIdCard,
  onSalary,
  onDelete,
}: WorkerCardProps) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold">{worker.full_name}</p>
          <p className="text-sm text-[var(--text-muted)]">
            {worker.zone_name || "—"}
            {worker.zone_name && worker.kebele_name ? " · " : ""}
            {worker.kebele_name}
          </p>
        </div>
        {worker.is_active ? <StatusBadge status="active" /> : <Badge variant="gray">Inactive</Badge>}
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <p>
          <span className="text-[var(--text-muted)]">Fayda: </span>
          <span className="font-medium">{worker.fayda_id ? formatFaydaId(worker.fayda_id) : "—"}</span>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Wage: </span>
          <span className="font-medium">{formatETB(worker.daily_wage)}/day</span>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Status: </span>
          <span className="font-medium">{worker.is_active ? "Active" : "Inactive"}</span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button variant="outline" onClick={onView} className="min-h-[44px] min-w-[44px]" aria-label={`View ${worker.full_name}`}>
          👁 View
        </Button>
        {canEdit && (
          <Button variant="outline" onClick={onEdit} className="min-h-[44px] min-w-[44px]" aria-label={`Edit ${worker.full_name}`}>
            ✏️ Edit
          </Button>
        )}
        <Button variant="outline" onClick={onAttendance} className="min-h-[44px] min-w-[44px]" aria-label={`Attendance ${worker.full_name}`}>
          📅 Att
        </Button>
        <Button variant="outline" onClick={onIdCard} className="min-h-[44px] min-w-[44px]" aria-label={`ID card ${worker.full_name}`}>
          🪪 Card
        </Button>
        <Button variant="outline" onClick={onSalary} className="min-h-[44px] min-w-[44px]" aria-label={`Salary ${worker.full_name}`}>
          💰 Pay
        </Button>
        {isAdmin && (
          <Button variant="danger" onClick={onDelete} className="min-h-[44px] min-w-[44px]" aria-label={`Delete ${worker.full_name}`}>
            🗑 Del
          </Button>
        )}
      </div>
    </div>
  );
}