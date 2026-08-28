"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError("Please fill all fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      // Normalize fullName alias
      const user = { ...res.user, full_name: res.user.full_name ?? (res.user as unknown as { fullName?: string }).fullName ?? "" } as import("@/types").User;
      setAuth(res.token, user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1d4ed8] to-[#7c3aed] p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="text-2xl">🧹</div>
          <h1 className="mt-1 text-lg font-bold text-[var(--primary)]">Dire Dawa Cleaning</h1>
          <p className="text-xs text-[var(--text-muted)]">9 kebeles · 108 zones · Municipal operations</p>
          <div className="mt-2 flex justify-center gap-1 text-xs text-[var(--text-muted)]">
            <span>🔴 Admin</span> <span>🔵 Kebele Admin</span> <span>🟣 Leader</span> <span>👁 Viewer</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="l-user">Username</Label>
            <Input id="l-user" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="l-pass">Password</Label>
            <div className="flex gap-2">
              <Input id="l-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="flex-1" />
            </div>
          </div>
          {error && (
            <div role="alert" aria-live="polite" className="rounded bg-[var(--danger-l)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          Legacy Vanilla JS login still at <code>/frontend</code> · API `x-session-token`
        </p>
      </Card>
    </div>
  );
}
