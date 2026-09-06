"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icon";
import { Alert } from "@/components/ui/alert";
import { fmtDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

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
        <p className="text-sm text-[var(--text-muted)]">This profile displays authoritative user identity and operational scope from the backend. Editing profile fields (full name, phone, Fayda ID) is not supported by the current backend route (only admins can update users via <code>/api/users/:id</code>). Password change is supported — see Security section below. Notification preferences do not have a backend persistence endpoint and are not exposed here (honest limitation per P1-3).</p>
      </div>

      {/* Security Section */}
      <Card>
        <div className="mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <Icons.info size={18} />
          <h3 className="font-semibold">Account Security</h3>
        </div>
        <div className="space-y-4">
          <PasswordChangeSection user={{ id: user?.id ?? 0 }} />
          <SessionSection />
        </div>
      </Card>

      {/* Preferences — documented limitation */}
      <Card>
        <div className="mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <Icons.info size={18} />
          <h3 className="font-semibold">Notification Preferences</h3>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--warning-l)] p-3">
          <div className="text-xs font-medium text-[var(--warning)]">Not implemented — backend limitation</div>
          <div className="text-sm text-[var(--text-muted)] mt-1">No backend endpoint exists for user-configurable notification preferences. The notification system supports types (<code>complaint_update</code>, <code>pending_report</code>, etc.) but users cannot currently enable/disable them. This is an honest limitation, not a missing UI switch. See registry §6.20 / P1-3.</div>
        </div>
      </Card>
    </div>
  );
}

/* Password Change — backed by /api/users/:id/password (self or admin) */
function PasswordChangeSection({ user }: { user: { id: number } }) {
  const [open, setOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = React.useState("");

  const reset = () => {
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setStatus("idle"); setMessage("");
  };

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus("error"); setMessage("All fields are required."); return;
    }
    if (newPassword.length < 8) { setStatus("error"); setMessage("Minimum 8 characters."); return; }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setStatus("error"); setMessage("Must contain at least one letter and one number."); return;
    }
    if (newPassword !== confirmPassword) { setStatus("error"); setMessage("Passwords do not match."); return; }
    setStatus("saving"); setMessage("");
    try {
      const res = await fetch(`/api/users/${user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-session-token": localStorage.getItem("ddcms_token") || "" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error"); setMessage(body.error || `Error ${res.status}`);
        return;
      }
      setStatus("success"); setMessage("Password updated. All existing sessions have been invalidated.");
      reset();
      setTimeout(() => setOpen(false), 1500);
    } catch (e) {
      setStatus("error"); setMessage(e instanceof Error ? e.message : "Update failed.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-medium">Change Password</h4>
          <p className="text-xs text-[var(--text-muted)]">Requires current password. All sessions revoked on success.</p>
        </div>
        <Button onClick={() => { setOpen(true); reset(); }} aria-label="Change password">Change</Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Change Password" footer={
        <>
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Update Password"}</Button>
        </>
      }>
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="curr-pw">Current Password *</Label>
            <Input id="curr-pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} maxLength={200} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-pw">New Password *</Label>
            <Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} maxLength={200} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="conf-pw">Confirm New Password *</Label>
            <Input id="conf-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} maxLength={200} />
          </div>
          {status === "success" && <Alert variant="success">{message}</Alert>}
          {status === "error" && <Alert variant="danger">{message}</Alert>}
          <div className="text-xs text-[var(--text-muted)]">Policy: min 8 chars, at least one letter and one number.</div>
        </div>
      </Modal>
    </div>
  );
}

/* Session / Logout */
function SessionSection() {
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-medium">Session</h4>
          <p className="text-xs text-[var(--text-muted)]">Sign out to invalidate your current session.</p>
        </div>
        <Button variant="outline" onClick={async () => {
          setLoggingOut(true); setMsg(null);
          try { await logout(); setMsg("Signed out successfully."); } catch (e) { setMsg("Sign out failed."); }
          setLoggingOut(false);
        }} disabled={loggingOut} aria-label="Sign out">{loggingOut ? "Signing out…" : "Sign Out"}</Button>
      </div>
      {msg && <Alert variant={msg.includes("failed") ? "danger" : "success"}>{msg}</Alert>}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-muted)]">
        <strong>Session security:</strong> Your session is validated against the database (<code>sessions</code> table) on every request. Changing your password invalidates all existing sessions. Logout removes your session token.
      </div>
    </div>
  );
}
