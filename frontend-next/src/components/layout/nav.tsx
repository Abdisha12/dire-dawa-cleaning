"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser, clearAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Role } from "@/types";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  roles: Role[];
  group?: string;
};

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "📊", roles: ["admin", "collector", "leader", "viewer"] },
  { id: "workers", label: "Workers", href: "/operations/workers", icon: "👷", roles: ["admin", "collector", "leader"], group: "Operations" },
  { id: "inspections", label: "Inspections", href: "/operations/inspections", icon: "🔍", roles: ["admin", "collector", "leader"], group: "Operations" },
  { id: "zonereports", label: "Zone Reports", href: "/operations/zone-reports", icon: "📝", roles: ["admin", "collector", "leader"], group: "Operations" },
  { id: "kebeles", label: "Kebeles", href: "/locations/kebeles", icon: "🏘️", roles: ["admin", "collector"], group: "Locations" },
  { id: "zones", label: "Safer Zones", href: "/locations/safer-zones", icon: "🗺️", roles: ["admin", "collector", "leader"], group: "Locations" },
  { id: "businesses", label: "Businesses", href: "/businesses", icon: "🏪", roles: ["admin", "collector", "leader", "viewer"], group: "Businesses & Finance" },
  { id: "payments", label: "Payments", href: "/businesses/payments", icon: "💳", roles: ["admin", "collector", "leader"], group: "Businesses & Finance" },
  { id: "notifications", label: "Notifications", href: "/community/notifications", icon: "🔔", roles: ["admin", "collector", "leader", "viewer"], group: "Community" },
  { id: "reports", label: "Reports", href: "/reports", icon: "📋", roles: ["admin", "collector", "viewer"], group: "Reports & Analytics" },
  { id: "analytics", label: "Analytics", href: "/reports/analytics", icon: "📈", roles: ["admin", "collector", "leader", "viewer"], group: "Reports & Analytics" },
  { id: "users", label: "Users", href: "/administration/users", icon: "👥", roles: ["admin"], group: "Administration" },
  { id: "tools", label: "Tools & Equipment", href: "/administration/tools", icon: "🔧", roles: ["admin", "collector", "leader"], group: "Administration" },
  { id: "documents", label: "Documents", href: "/administration/documents", icon: "📁", roles: ["admin", "collector", "leader", "viewer"], group: "Administration" },
  { id: "auditlog", label: "Audit Logs", href: "/administration/audit-logs", icon: "📜", roles: ["admin"], group: "Administration" },
  { id: "settings", label: "Settings", href: "/settings", icon: "⚙️", roles: ["admin", "collector", "leader", "viewer"] },
];

const MOBILE_PRIMARY = ["dashboard", "inspections", "workers", "payments", "notifications"];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const user = typeof window !== "undefined" ? getUser() : null;
  const role = user?.role as Role | undefined;
  const zone = user?.zone;

  const filtered = NAV.filter((n) => (role ? n.roles.includes(role) : false));

  // Group by group name
  const groups = new Map<string, NavItem[]>();
  for (const item of filtered) {
    const g = item.group || "General";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(item);
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-[var(--z-sidebar)] flex w-[var(--sidebar-w)] flex-col bg-[#111827] text-white transition-transform duration-200 md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4 text-sm font-bold">
        <span className="text-xl">🧹</span>
        <div>
          <div className="text-xs font-normal opacity-55">Dire Dawa</div>
          <div>Cleaning CMS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group} className="mb-1">
            <div className="px-5 pb-1 pt-3 text-xs uppercase tracking-wide text-white/35">{group}</div>
            {items.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 border-l-[3px] px-5 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-[#2563eb] bg-white/10 text-white"
                      : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="w-6 text-base" aria-hidden>
                    {n.icon}
                  </span>
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4 text-xs">
        {user && (
          <div className="mb-3 flex items-center gap-2">
            <div
              className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${
                role === "admin"
                  ? "bg-[#dc2626]"
                  : role === "collector"
                    ? "bg-[#2563eb]"
                    : role === "leader"
                      ? "bg-[#7c3aed]"
                      : "bg-[#6b7280]"
              }`}
            >
              {(user.full_name?.[0] || user.username[0] || "U").toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user.full_name || user.username}</div>
              <div className="capitalize opacity-60">{role === "collector" ? "Kebele Admin" : role}</div>
              {zone && (
                <div className="mt-1 rounded bg-[#7c3aed]/30 px-1.5 py-0.5 text-xs text-[#c4b5fd]">📍 {zone.name}</div>
              )}
            </div>
          </div>
        )}
        <button
          onClick={() => {
            clearAuth();
            window.location.href = "/login";
          }}
          className="w-full rounded-md bg-white/5 py-1.5 text-white/70 hover:bg-[#dc2626] hover:text-white"
        >
          ⏻ Logout
        </button>
      </div>
    </aside>
  );
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const [unread, setUnread] = useState<number>(0);
  const user = typeof window !== "undefined" ? getUser() : null;
  const role = user?.role;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      try {
        const res = await api.getUnreadCount();
        setUnread(res.unreadCount);
      } catch {}
    };
    tick();
    timer = setInterval(tick, 60000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <header className="sticky top-0 z-[var(--z-topbar)] flex h-[var(--header-h)] items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 md:px-6">
      <button
        onClick={onMenu}
        className="text-xl md:hidden"
        aria-label="Open menu"
      >
        ☰
      </button>
      <h2 className="flex-1 text-base font-semibold">Dire Dawa Cleaning</h2>
      <Link
        href="/community/notifications"
        className="relative text-xl no-underline"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-2 -top-1 rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-xs font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
      <div className="hidden items-center gap-1 text-xs text-[var(--text-muted)] md:flex">
        {role === "admin"
          ? "🔴 Admin"
          : role === "collector"
            ? "🔵 Kebele Admin"
            : role === "leader" && (user as unknown as { zone?: { name: string } })?.zone
              ? `🟣 Leader · ${(user as unknown as { zone: { name: string } }).zone.name}`
              : role
                ? `👁 ${String(role)}`
                : ""}
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const user = typeof window !== "undefined" ? getUser() : null;
  const role = user?.role as Role | undefined;
  const allowedIds = new Set(
    NAV.filter((n) => (role ? n.roles.includes(role) : false)).map((n) => n.id)
  );
  const items = NAV.filter((n) => MOBILE_PRIMARY.includes(n.id) && allowedIds.has(n.id));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[var(--z-bottomnav)] flex h-[var(--bottom-nav-h)] items-center justify-around border-t border-[var(--border)] bg-[var(--surface)] shadow-[0_-2px_10px_rgba(0,0,0,0.08)] md:hidden"
      aria-label="Mobile navigation"
    >
      {items.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.id}
            href={n.href}
            className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              active ? "text-[var(--primary)] font-bold" : "text-[var(--text-muted)]"
            }`}
          >
            <span className="text-lg" aria-hidden>
              {n.icon}
            </span>
            <span>{n.label.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
