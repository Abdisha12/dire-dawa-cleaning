"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icon";
import { Alert } from "@/components/ui/alert";
import { fmtDate } from "@/lib/utils";

export default function SettingsPage() {
  const { user, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-section">My Account</h1>
        <Card><div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading profile…</div></Card>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <h1 className="text-section">My Account</h1>
        <Alert variant="danger">Failed to load profile. {error || "Not signed in."}</Alert>
      </div>
    );
  }

  const roleLabel = {
    admin: "Administrator",
    collector: "Kebele Admin",
    leader: "Zone Leader",
    viewer: "Viewer",
  }[user.role] || user.role;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-section">My Account</h1>
        <p className="text-sm text-[var(--text-muted)]">Profile and operational identity shown from the authoritative backend record.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Full Name" value={user.full_name || "—"} accent="blue" />
        <StatCard label="Username" value={user.username} accent="blue" />
        <StatCard label="Role" value={roleLabel} accent="purple" />
        <StatCard label="Account Status" value={user.is_active ? "Active" : "Inactive"} accent={user.is_active ? "green" : "red"} />
        <StatCard label="Fayda ID" value={user.fayda_id || "—"} accent="blue" />
        <StatCard label="Phone" value={user.phone || "—"} accent="blue" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Icons.users size={18} />
            <h3 className="font-semibold">Profile</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Title / Use</dt><dd className="font-medium">{roleLabel}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Full Name</dt><dd className="font-medium">{user.full_name || "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Username</dt><dd className="font-medium font-mono">{user.username}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Role</dt><dd><Badge variant="purple">{user.role}</Badge></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Fayda ID</dt><dd className="font-mono">{user.fayda_id || "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Phone</dt><dd>{user.phone || "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Account Status</dt><dd><Badge variant={user.is_active ? "green" : "red"}>{user.is_active ? "Active" : "Inactive"}</Badge></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Member Since</dt><dd>{fmtDate(user.created_at) || "—"}</dd></div>
          </dl>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Icons.info size={18} />
            <h3 className="font-semibold">Operational Scope</h3>
          </div>
          <div className="space-y-4 text-sm">
            {(user.role === "leader" && user.zone) ? (
              <div className="rounded-lg border border-[var(--border)] p-3 bg-[var(--surface)]">
                <div className="font-semibold">Zone Leader — Authorized Zone</div>
                <div className="mt-1 text-[var(--text-muted)]">{user.zone.name}</div>
                <div className="text-xs text-[var(--text-muted)]">Kebele: {user.zone.kebele_name || "—"} · Zone ID: {user.zone.id}</div>
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--border)] p-3 bg-[var(--surface)]">
                <div className="font-medium">Zone</div>
                <div className="text-[var(--text-muted)]">No authorized zone assigned ({user.role === "leader" ? "leader" : "not applicable"}).</div>
              </div>
            )}

            {(user.role === "collector") ? (
              <div className="rounded-lg border border-[var(--border)] p-3 bg-[var(--surface)]">
                <div className="font-semibold">Kebele Admin — Assigned Kebele</div>
                <div className="mt-1 text-[var(--text-muted)]">Assigned via backend `kebeles.collector_id` (authorized for zone/report/worker operations within kebele).</div>
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--border)] p-3 bg-[var(--surface)]">
                <div className="font-medium">Kebele</div>
                <div className="text-[var(--text-muted)]">No kebele assigned (not applicable for this role).</div>
              </div>
            )}

            <div className="rounded-lg border border-[var(--border)] bg-[var(--warning-l)] p-3">
              <div className="text-xs font-medium text-[var(--warning)]">Read-only limitation</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Role, kebele, safer zone, and permissions are authoritative backend values. They are not editable through this profile page (see registry entry §6.20 / P1-3).</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="font-semibold mb-2">About this page</h3>
        <p className="text-sm text-[var(--text-muted)]">This profile displays authoritative user identity and operational scope from the backend. Editing profile fields (full name, phone, Fayda ID) is not supported by the current backend route (only admins can update users via <code>/api/users/:id</code>). Password and security settings are handled separately. This page is read-only to preserve server authority over role, kebele, zone, and permissions.</p>
      </div>
    </div>
  );
}
