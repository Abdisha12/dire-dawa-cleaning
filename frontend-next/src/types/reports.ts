// types/reports.ts — strict types for reports/analytics
// Mirrors actual backend responses. No `any`.

export type SummaryReport = {
  totals: {
    total_collected: string;
    total_pending: string;
    total_overdue: string;
  };
  byKebele: Array<{
    kebele: string;
    code: string;
    collected: string;
    target: string;
  }>;
  monthly: Array<{ month: number; collected: string }>;
};

export type AnalyticsRow = Record<string, string | number | null | undefined>;

export type PaymentsMonthlyRow = {
  id: number;
  business: string;
  zone: string;
  kebele: string;
  amount: string;
  method: string;
  status: string;
  month: number;
  year: number;
  paid_at: string | null;
  receipt_number: string;
  collector: string;
};

export type PaymentsYearlyRow = {
  month: number;
  count: string;
  collected: string;
  pending: string;
  overdue: string;
};

export type WorkersMonthlyRow = {
  full_name: string;
  zone: string;
  kebele: string;
  daily_wage: string;
  days_present: string;
  days_absent: string;
  total_bonus: string;
  gross_wage: string;
};

export type InspectionReportRow = {
  id: number;
  date: string;
  kebele: string;
  zone: string;
  status: string;
  inspector: string;
};

export type KebeleReport = {
  kebele: string;
  code: string;
  collected: string;
  target: string;
};
