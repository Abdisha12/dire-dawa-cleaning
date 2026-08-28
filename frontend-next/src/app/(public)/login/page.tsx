"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const usernameError = !username.trim() ? "Username is required" : undefined;
  const passwordError = !password ? "Password is required" : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Please fill all fields.");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-2 text-sm font-bold">
          <span className="grid h-8 w-8 place-items-center rounded bg-[var(--primary)] text-white">🧹</span>
          <div>
            <div className="leading-none">Dire Dawa Cleaning</div>
            <div className="text-xs font-normal text-[var(--text-muted)]">Municipal Operations Platform</div>
          </div>
          <span className="ml-auto hidden text-xs font-normal text-[var(--text-muted)] md:block">Phase 3 Foundation · Next.js + TypeScript</span>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-[400px] p-6 md:p-8">
          <CardHeader className="mb-4 flex-col items-start border-0 p-0">
            <CardTitle className="text-section">Sign in</CardTitle>
            <p className="text-sm text-[var(--text-muted)]">Use your existing backend account. Session is validated via <code className="rounded bg-[var(--gray-100)] px-1">x-session-token</code>.</p>
          </CardHeader>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="flex flex-col gap-1">
              <Label htmlFor="login-user">Username</Label>
              <Input
                id="login-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                aria-invalid={!!usernameError && username === ""}
                placeholder="admin · collector1 · leader_k1z1"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="login-pass">Password</Label>
              <div className="relative">
                <Input
                  id="login-pass"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!passwordError && password === ""}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute inset-y-0 right-2 grid place-items-center rounded p-1 text-[var(--text-muted)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20"
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                  tabIndex={0}
                >
                  {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                </button>
              </div>
            </div>

            {error && (
              <Alert variant="danger" title="Sign in failed">
                {error}
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="w-full" aria-busy={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-center text-xs text-[var(--text-muted)]">
              Keyboard: <kbd className="rounded border border-[var(--border)] bg-[var(--gray-50)] px-1">Tab</kbd> / <kbd className="rounded border px-1">Enter</kbd> · Demo: `admin / password` (seed)
            </p>
          </form>

          <div className="mt-6 flex justify-between text-xs text-[var(--text-muted)]">
            <span>9 kebeles · 108 zones</span>
            <a href="/frontend" className="hover:text-[var(--primary)] hover:underline">
              Legacy frontend →
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
