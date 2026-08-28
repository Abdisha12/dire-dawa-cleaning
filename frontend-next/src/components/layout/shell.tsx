"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar, TopBar, BottomNav } from "@/components/layout/nav";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LoadingState } from "@/components/feedback/states";
import { NAV } from "@/components/layout/nav";

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "Home", href: "/dashboard" }];
  let acc = "";
  for (const p of parts) {
    acc += `/${p}`;
    // Humanize: workers -> Workers, safer-zones -> Safer Zones
    const label = p
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    crumbs.push({ label, href: acc });
  }
  // Last crumb not linked
  const items = crumbs.map((c, i) => (i === crumbs.length - 1 ? { label: c.label } : c));
  return <Breadcrumb items={items} />;
}

function UnauthorizedState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center" role="alert" aria-live="polite">
      <h2 className="text-lg font-semibold">Not authorized</h2>
      <p className="mt-1 max-w-md text-sm text-[var(--text-muted)]">
        Your role does not have access to this page. The server enforces authorization — this view is hidden for usability only.
      </p>
      <a href="/dashboard" className="mt-4 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">
        Back to dashboard
      </a>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <LoadingState message="Checking session…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <LoadingState message="Redirecting to sign in…" />
      </div>
    );
  }

  // Role-based route guard — frontend only, backend is authoritative (see §24)
  const navItem = NAV.find((n) => n.href && (pathname === n.href || pathname.startsWith(n.href + "/")));
  const isUnauthorized = !!navItem && !navItem.roles.includes(user.role as never);

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      {/* overlay for mobile */}
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[90] bg-black/40 md:hidden"
        />
      )}
      <div className="flex min-h-screen flex-1 flex-col md:ml-[var(--sidebar-w)]">
        <TopBar onMenu={() => setOpen((v) => !v)} />
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 md:px-6">
          <Breadcrumbs />
        </div>
        <main className="flex-1 p-4 pb-[calc(var(--bottom-nav-h)+16px)] md:p-6 md:pb-6">
          {isUnauthorized ? <UnauthorizedState /> : children}
          {isUnauthorized && (
            <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
              Backend enforces this — hidden navigation is usability only.
            </p>
          )}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
