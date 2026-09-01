// features/businesses/services/payments-api.ts
import { api, FetchOptions } from "@/lib/api";
import type { Payment } from "@/types";

export type PaymentPaginated = { data: Payment[]; total: number; page: number; pages: number };
export type CreatePaymentResponse = {
  id: number;
  receiptNumber: string;
  paidAt: string | null;
  status: string;
  paymentUrl: string | null;
  gatewayName: string | null;
};

export const paymentsApi = {
  getAll: async (params?: Record<string, string>, opts?: FetchOptions): Promise<Payment[] | PaymentPaginated> => {
    const res = (await api.getPayments(params, opts)) as unknown;
    if (Array.isArray(res)) return res as Payment[];
    if (res && typeof res === "object" && "data" in (res as Record<string, unknown>)) return res as PaymentPaginated;
    if (res && typeof res === "object" && "payments" in (res as Record<string, unknown>)) return (res as { payments: Payment[] }).payments;
    return [] as Payment[];
  },

  create: (data: Record<string, unknown>, opts?: FetchOptions) =>
    api.createPayment(data, opts) as Promise<CreatePaymentResponse>,

  delete: (id: number, opts?: FetchOptions) => api.deletePayment(id, opts),

  verify: (id: number, opts?: FetchOptions) => api.verifyPayment(id, opts),

  getDashboard: (params?: Record<string, string>, opts?: FetchOptions) => api.getDashboardSummary(params, opts),

  csvUrl: (path: string, params: Record<string, string> = {}) => api.csvUrl(path, params),
};
