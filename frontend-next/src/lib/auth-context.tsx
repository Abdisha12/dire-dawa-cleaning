"use client";

import * as React from "react";
import { api, ApiError } from "@/lib/api";
import { getUser, setAuth, clearAuth, getToken } from "@/lib/auth";
import type { User } from "@/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    return getUser();
  });
  const [loading, setLoading] = React.useState<boolean>(!!getToken());
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const me = await api.me();
      // Normalize fullName alias
      const normalized = { ...me, full_name: me.full_name ?? (me as unknown as { fullName?: string }).fullName ?? me.full_name } as User;
      // Preserve existing token, update user (includes zone for leaders)
      const current = getUser();
      if (current) setAuth(token, normalized);
      setUser(normalized);
    } catch (e) {
      // 401 already cleared by api; otherwise surface
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
      } else {
        setError(e instanceof Error ? e.message : "Session validation failed");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const login = React.useCallback(async (username: string, password: string) => {
    setError(null);
    // Preserve backend business logic: bcrypt compare, lockout 5/15m, session uuid, old sessions deleted
    const res = await api.login(username, password);
    const normalized = {
      ...res.user,
      full_name: res.user.full_name ?? (res.user as unknown as { fullName?: string }).fullName ?? "",
    } as User;
    setAuth(res.token, normalized);
    setUser(normalized);
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Even if backend fails, clear locally (idempotent)
    } finally {
      clearAuth();
      setUser(null);
    }
  }, []);

  const value: AuthState = { user, loading, error, login, logout, refresh };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
