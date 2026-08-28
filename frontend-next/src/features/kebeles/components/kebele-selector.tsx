"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useKebele } from "@/lib/kebele-context";

export function KebeleSelector({
  id = "kebele-selector",
  showAllOption = true,
  label = "Kebele",
}: {
  id?: string;
  showAllOption?: boolean;
  label?: string;
}) {
  const { kebeles, loading, error, selectedId, setSelectedId, isLocked } = useKebele();

  if (loading) return <div className="text-sm text-[var(--text-muted)]" aria-busy="true">Loading kebeles…</div>;
  if (error) return <div className="text-sm text-[var(--danger)]" role="alert">{error}</div>;

  // No hardcoded IDs: use actual API records (id/code/name)
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-[var(--gray-700)]">
        {label}
        {isLocked && <span className="ml-2 rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-normal text-[#1d4ed8]">My Kebele — locked</span>}
      </label>
      <div className="flex items-center gap-2">
        <Select
          id={id}
          value={selectedId ? String(selectedId) : ""}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedId(v === "" ? null : Number(v));
          }}
          disabled={isLocked}
          aria-disabled={isLocked}
        >
          {showAllOption && !isLocked && <option value="">All Kebeles (City-wide)</option>}
          {kebeles.map((k) => (
            <option key={k.id} value={String(k.id)}>
              {k.name} — {k.code}
            </option>
          ))}
        </Select>
        {isLocked && selectedId && (
          <Badge variant="blue" className="shrink-0">
            {kebeles.find((k) => k.id === selectedId)?.code}
          </Badge>
        )}
      </div>
      {isLocked && (
        <p className="text-xs text-[var(--text-muted)]">Kebele Admins cannot switch kebeles — backend enforces <code>kebeles.collector_id</code>.</p>
      )}
    </div>
  );
}

// Variants for specific UX:
export function KebeleSummary() {
  const { selectedKebele, isLocked } = useKebele();
  if (!selectedKebele)
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text-muted)]">
        City-wide — all 9 kebeles
      </div>
    );
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="text-sm font-semibold">{selectedKebele.name} — {selectedKebele.code}</div>
      <div className="text-xs text-[var(--text-muted)]">Zones: {selectedKebele.zones_count ?? "—"} · ID: {selectedKebele.id} {isLocked && "· locked"}</div>
    </div>
  );
}
