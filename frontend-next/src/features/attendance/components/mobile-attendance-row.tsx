"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtETB } from "@/lib/utils";

type MobileAttendanceRowProps = {
  workerId: number;
  workerName: string;
  zoneName: string;
  dailyWage: number;
  present: boolean;
  bonus: string;
  onPresentChange: (workerId: number, present: boolean) => void;
  onBonusChange: (workerId: number, bonus: string) => void;
};

export function MobileAttendanceRow({
  workerId,
  workerName,
  zoneName,
  dailyWage,
  present,
  bonus,
  onPresentChange,
  onBonusChange,
}: MobileAttendanceRowProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold">{workerName}</p>
        {zoneName ? <Badge variant="purple">{zoneName}</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{fmtETB(dailyWage)}/day</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{workerId ? `ID: ${workerId}` : ""}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() => onPresentChange(workerId, true)}
          variant={present ? "success" : "outline"}
          className="min-h-[48px] w-full text-sm"
          aria-pressed={present}
        >
          PRESENT
        </Button>
        <Button
          type="button"
          onClick={() => onPresentChange(workerId, false)}
          variant={!present ? "danger" : "outline"}
          className="min-h-[48px] w-full text-sm"
          aria-pressed={!present}
        >
          ABSENT
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label htmlFor={`bonus-${workerId}`} className="text-sm font-medium">
          Bonus:
        </label>
        <div className="flex-1">
          <Input
            id={`bonus-${workerId}`}
            type="number"
            min={0}
            step={0.01}
            value={bonus}
            onChange={(e) => onBonusChange(workerId, e.target.value)}
            inputMode="decimal"
            className="min-h-[44px]"
          />
        </div>
        <span className="text-sm text-[var(--text-muted)]">ETB</span>
      </div>
    </div>
  );
}