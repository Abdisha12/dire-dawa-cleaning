// lib/auth.ts — session helpers (x-session-token) + type-safe user store
// Mirrors frontend/js/api.js getUser/setAuth but typed and Next.js friendly.

import type { User } from "@/types";

const TOKEN_KEY = "ddcms_token";
const USER_KEY = "ddcms_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function hasRole(...roles: User["role"][]): boolean {
  const u = getUser();
  return !!u && roles.includes(u.role);
}

export function getZone(): User["zone"] | null {
  return getUser()?.zone ?? null;
}
