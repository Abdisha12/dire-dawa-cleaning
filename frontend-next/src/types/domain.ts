// types/domain.ts — Frontend domain types (strict, no `any`)
// Mirrors backend PostgreSQL schema + API responses. Display label “Kebele Admin” = role `collector`.

export type Role = "admin" | "collector" | "leader" | "viewer";

// User returned by /api/auth/me and /api/users
export interface User {
  id: number;
  username: string;
  full_name: string;
  fullName?: string; // alias used by older API
  fayda_id: string | null;
  phone: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Leader’s assigned zone (populated by GET /api/auth/me)
  zone?: SaferZone & { kebele_name?: string; kebele_code?: string } | null;
}

// Kebele — Dire Dawa’s 9 (K01–K09)
export interface Kebele {
  id: number;
  name: string;
  code: string;
  collector_id: number | null;
  collector_name?: string | null;
  created_at: string;
  updated_at: string;
  // PostGIS — not yet populated, future authoritative boundaries
  boundary?: unknown | null; // GeoJSON MULTIPOLYGON when available
  zones_count?: number;
}

// Safer Zone — 12 per kebele (108 total)
export interface SaferZone {
  id: number;
  name: string;
  kebele_id: number;
  leader_id: number | null;
  leader_name?: string | null;
  kebele_name?: string;
  kebele_code?: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  boundary?: unknown | null;
}

// Worker — daily-wage roster
export interface Worker {
  id: number;
  full_name: string;
  contact: string | null;
  fayda_id: string | null;
  daily_wage: number;
  safer_zone_id: number | null;
  zone_name?: string;
  kebele_name?: string;
  is_active: boolean;
  custom_attributes: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  location?: unknown | null;
}

// Business — 11 types
export type BusinessType =
  | "shop"
  | "cafe"
  | "hotel"
  | "restaurant"
  | "pharmacy"
  | "market"
  | "workshop"
  | "office"
  | "school"
  | "clinic"
  | "other";

export interface Business {
  id: number;
  name: string;
  owner_name: string;
  owner_fayda_id: string | null;
  owner_phone: string | null;
  type: BusinessType;
  monthly_target: number;
  safer_zone_id: number;
  zone_name?: string;
  kebele_name?: string;
  kebele_code?: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  location?: unknown | null;
}

// Inspection — status active/warning/danger, optional photos
export type InspectionStatus = "active" | "warning" | "danger";

export interface Inspection {
  id: number;
  kebele_id: number;
  kebele_name?: string;
  kebele_code?: string;
  safer_zone_id: number | null;
  zone_name?: string | null;
  date: string; // ISO date
  status: InspectionStatus;
  notes: string | null;
  inspected_by: number;
  inspector_name?: string;
  created_at: string;
  updated_at: string;
  photos?: InspectionPhoto[];
  location?: unknown | null;
}

export interface InspectionPhoto {
  id: number;
  inspection_id: number;
  file_path: string;
  uploaded_at: string;
}

// Payment — collections
export type PaymentMethod = "cash" | "mobile" | "bank" | "other" | "telebirr" | "cbebirr";
export type PaymentStatus = "paid" | "pending" | "overdue" | "failed";

export interface Payment {
  id: number;
  business_id: number;
  business_name?: string;
  zone_name?: string;
  kebele_name?: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  month: number;
  year: number;
  paid_at: string | null;
  receipt_number: string | null;
  notes: string | null;
  collected_by: number;
  collector_name?: string;
  gateway_name: string | null;
  gateway_ref: string | null;
  payment_url: string | null;
  created_at: string;
  updated_at: string;
}

// Notification — 3 current + future types
export type NotificationType =
  | "overdue_payment"
  | "pending_report"
  | "absent_worker"
  | "inspection_reminder"
  | "payment_alert"
  | "complaint_update"
  | "system";

export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Additional types used by shell/analytics (minimal)
export interface Tool {
  id: number;
  name: string;
  category: string;
  quantity: number;
  condition_status: string;
  safer_zone_id: number;
  zone_name?: string;
}

export interface ZoneReport {
  id: number;
  safer_zone_id: number;
  zone_name?: string;
  kebele_name?: string;
  report_date: string;
  report_month: number;
  report_year: number;
  status: "draft" | "submitted" | "reviewed" | "approved";
}
