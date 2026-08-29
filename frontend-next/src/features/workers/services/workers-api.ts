// features/workers/services/workers-api.ts
// Feature-specific API service layer — uses lib/api.ts, no direct fetch

import { api, ApiError, FetchOptions } from "@/lib/api";
import type { Worker, SaferZone, Attendance, WorkerFormValues } from "@/types";

export const workersApi = {
  // Workers
  getAll: (params?: Record<string, string>, opts?: FetchOptions) =>
    api.getWorkers(params, opts),

  getStats: (params?: Record<string, string>, opts?: FetchOptions) =>
    api.getWorkers(params, opts).then((res) => {
      const data: Worker[] = Array.isArray(res) ? res : res.data || [];
      return data.filter((w: Worker) => w.is_active).reduce((sum: number, w: Worker) => sum + Number(w.daily_wage), 0);
    }),

  create: (data: WorkerFormValues, opts?: FetchOptions) =>
    api.createWorker(data, opts),

  update: (id: number, data: Partial<WorkerFormValues>, opts?: FetchOptions) =>
    api.updateWorker(id, data, opts),

  delete: (id: number, opts?: FetchOptions) =>
    api.deleteWorker(id, opts),

  // Attendance
  getAttendance: (workerId: number, params?: Record<string, string>, opts?: FetchOptions) =>
    api.getAttendance(workerId, params, opts),

  recordBulk: (data: { date: string; records: Array<{ workerId: number; present: boolean; bonus?: number | null }> }, opts?: FetchOptions) =>
    api.bulkAttendance(data, opts),

  // Salary
  getSalaryHistory: (workerId: number, opts?: FetchOptions) =>
    api.getWorkerSalary(workerId, opts),

  recordPayment: (workerId: number, data: { amount: number; paidAt: string; periodFrom: string; periodTo: string; notes?: string }, opts?: FetchOptions) =>
    api.paySalary(workerId, data, opts),

  // Zones
  getZones: (params?: Record<string, string>, opts?: FetchOptions) =>
    api.getSaferZones(params, opts).then((r) => r.zones),

  // Kebeles
  getKebeles: (opts?: FetchOptions) =>
    api.getKebeles(opts).then((r) => r.kebeles),
};

// Utility for monetary values — always use this for display
export function formatETB(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return `ETB ${num.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Safe arithmetic for monetary values — avoid floating-point errors
export function addETB(...amounts: (number | null | undefined)[]): number {
  return amounts.reduce((sum: number, val) => {
    const num = typeof val === "string" ? parseFloat(val) : (val ?? 0);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
}

export function multiplyETB(amount: number, multiplier: number): number {
  if (isNaN(amount) || isNaN(multiplier)) return 0;
  // Use integer arithmetic in cents to avoid floating-point errors
  const cents = Math.round(amount * 100);
  const resultCents = Math.round(cents * multiplier);
  return resultCents / 100;
}