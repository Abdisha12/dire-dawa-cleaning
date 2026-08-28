"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Sidebar, TopBar, BottomNav } from "@/components/layout/nav";
import { Breadcrumb } from "@/components/ui/breadcrumb";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Redirect unauthenticated to /login (client guard; server middleware would also)
    if (!getUser() && pathname !== "/login") {
      // Allow public pages already handled by (public) group; this shell only for (app)
      // If no token, push to login
      const token = typeof window !== "undefined" ? localStorage.getItem("ddcms_token") : null;
      if (!token) router.replace("/login");
    }
  }, [router, pathname]);

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
        <main className="flex-1 p-4 pb-[calc(var(--bottom-nav-h)+16px)] md:p-6 md:pb-6">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
