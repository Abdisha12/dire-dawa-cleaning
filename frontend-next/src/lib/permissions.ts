// lib/permissions.ts — Permission-aware UI states per §24
// Backend is authoritative; frontend hides/disables for UX only.

import type { Role } from "@/types";
import { hasRole } from "./auth";

export type PermissionState = "visible" | "disabled" | "hidden" | "read-only";

// Navigation filtering (mirrors backend/middleware/auth requireRole)
// Role `collector` is backend identifier for user-facing “Kebele Admin” (§14)
export const NAV_VISIBILITY: Record<string, Role[]> = {
  dashboard: ["admin", "collector", "leader", "viewer"],
  workers: ["admin", "collector", "leader"],
  attendance: ["admin", "collector", "leader"],
  inspections: ["admin", "collector", "leader"],
  zonereports: ["admin", "collector", "leader"],
  kebeles: ["admin", "collector"],
  zones: ["admin", "collector", "leader"],
  gis: ["admin", "collector", "leader", "viewer"],
  businesses: ["admin", "collector", "leader", "viewer"],
  payments: ["admin", "collector", "leader"],
  notifications: ["admin", "collector", "leader", "viewer"],
  complaints: ["admin", "collector", "leader", "viewer"],
  reports: ["admin", "collector", "viewer"],
  analytics: ["admin", "collector", "leader", "viewer"],
  performance: ["admin", "collector"],
  users: ["admin"],
  tools: ["admin", "collector", "leader"],
  documents: ["admin", "collector", "leader", "viewer"],
  auditlog: ["admin"],
  myaccount: ["admin", "collector", "leader", "viewer"],
  system: ["admin"],
  settings: ["admin", "collector", "leader", "viewer"],
};

export function canViewPage(pageId: string, role: Role): boolean {
  const allowed = NAV_VISIBILITY[pageId];
  if (!allowed) return false;
  return (allowed as string[]).includes(role);
}

// For table row actions / toolbar buttons
export function canMutate(role: Role): boolean {
  return role === "admin" || role === "collector" || role === "leader";
}

export function canDeletePayment(role: Role): boolean {
  return role === "admin";
}

export function canManageUsers(role: Role): boolean {
  return role === "admin";
}

// Returns visible/disabled per UX §24
export function buttonState(isAllowed: boolean, isFormValid: boolean): PermissionState {
  if (!isAllowed) return "hidden";
  if (!isFormValid) return "disabled";
  return "visible";
}
