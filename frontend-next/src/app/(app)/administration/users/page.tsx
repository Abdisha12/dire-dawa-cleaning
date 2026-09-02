"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useKebele } from "@/lib/kebele-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { fmtDate, validateFaydaId } from "@/lib/utils";
import type { User, SaferZone, Kebele } from "@/types";

const ROLES: Array<{ value: User["role"]; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "collector", label: "Kebele Admin" },
  { value: "leader", label: "Leader" },
  { value: "viewer", label: "Viewer" },
];

export default function UsersPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const { toast } = useToast();
  const role = user?.role;
  const isAdmin = role === "admin";
  const isCollector = role === "collector";

  const [users, setUsers] = React.useState<User[]>([]);
  const [, setKebeles] = React.useState<Kebele[]>([]);
  const [zones, setZones] = React.useState<SaferZone[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;

  const [editing, setEditing] = React.useState<User | null>(null);
  const [showForm, setShowForm] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter) params.role = roleFilter;
      const [uRes, kRes, zRes] = await Promise.all([
        api.getUsers(params, { signal: ctrl.signal }),
        api.getKebeles({ signal: ctrl.signal } as never),
        api.getSaferZones({}, { signal: ctrl.signal }),
      ]);
      const list = (uRes as { users: User[] }).users || ([] as User[]);
      const isPaginated = uRes && typeof uRes === "object" && "total" in (uRes as Record<string, unknown>);
      if (isPaginated) {
        const t = (uRes as unknown as { total: number; pages: number }).total;
        const p = (uRes as unknown as { total: number; pages: number }).pages;
        setTotal(t);
        setPages(p);
      } else {
        setTotal(list.length);
        setPages(1);
      }
      setUsers(list);
      setKebeles((kRes as { kebeles: Kebele[] }).kebeles || []);
      setZones((zRes as { zones: SaferZone[] }).zones || []);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, debouncedSearch, roleFilter]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await api.deleteUser(id);
      toast("User deleted", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const handleToggleActive = async (u: User) => {
    try {
      await api.updateUser(u.id, { fullName: u.full_name, role: u.role, faydaId: u.fayda_id, phone: u.phone, isActive: !u.is_active });
      toast(u.is_active ? "User deactivated" : "User activated", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    }
  };

  const columns: Column<User>[] = [
    { key: "full_name", header: "Name", render: (u) => <strong>{u.full_name}</strong> },
    { key: "username", header: "Username", render: (u) => u.username },
    { key: "role", header: "Role", render: (u) => <Badge variant="purple">{u.role === "collector" ? "Kebele Admin" : u.role}</Badge> },
    { key: "fayda_id", header: "Fayda/ID", render: (u) => u.fayda_id || "—" },
    { key: "phone", header: "Phone", render: (u) => u.phone || "—" },
    { key: "is_active", header: "Status", render: (u) => u.is_active ? <Badge variant="green">Active</Badge> : <Badge variant="gray">Inactive</Badge> },
    { key: "created_at", header: "Created", render: (u) => fmtDate(u.created_at) },
  ];

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-section">Users</h1>
        <Alert variant="danger">Only Admin can manage users. Your role ({role || "unknown"}) is not authorized.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Users</h1>
          <p className="text-sm text-[var(--text-muted)]">User management — city-wide administrative resource
            {isCollector && kebeleId ? " — My Kebele scoped" : " — Admin context"}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}><Icons.save size={16} /> Add User</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="u-search">Search</Label>
          <Input id="u-search" placeholder="Name, username…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[200px]" aria-label="Search users" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="u-role">Role</Label>
          <Select id="u-role" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="w-[160px]" aria-label="Filter by role">
            <option value="">All Roles</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="hidden sm:block">
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={users as unknown as Record<string, unknown>[]}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No users"
          emptyDescription="Backend returned no users for the current filter."
          getRowKey={(u, i) => String((u as unknown as { id: number }).id ?? i)}
          page={page}
          pages={pages}
          onPage={(p) => setPage(p)}
          rowActions={(u) => (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => { setEditing(u as unknown as User); setShowForm(true); }} aria-label={`Edit ${(u as { username: string }).username}`}><Icons.edit size={16} /></Button>
              <Button size="sm" variant="outline" onClick={() => handleToggleActive(u as unknown as User)} aria-label={`Toggle ${(u as { username: string }).username}`}>{(u as { is_active: boolean }).is_active ? "Deactivate" : "Activate"}</Button>
              <Button size="sm" variant="danger" onClick={() => handleDelete((u as { id: number }).id, (u as { username: string }).username)} aria-label={`Delete ${(u as { username: string }).username}`}><Icons.trash size={16} /></Button>
            </div>
          )}
        />
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--gray-100)]" />)}</div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No users found.</p>
          </div>
        ) : users.map((u) => (
          <div key={u.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{u.full_name}</div>
                <div className="text-xs text-[var(--text-muted)]">@{u.username}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="purple">{u.role === "collector" ? "Kebele Admin" : u.role}</Badge>
                {u.is_active ? <Badge variant="green">Active</Badge> : <Badge variant="gray">Inactive</Badge>}
              </div>
            </div>
            <div className="mt-2 text-xs">Fayda: {u.fayda_id || "—"} · Phone: {u.phone || "—"}</div>
            <div className="mt-2 text-xs text-[var(--text-muted)]">Created {fmtDate(u.created_at)}</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(u); setShowForm(true); }} aria-label={`Edit ${u.username}`} className="min-h-[44px]"><Icons.edit size={16} /></Button>
              <Button size="sm" variant="outline" onClick={() => handleToggleActive(u)} className="min-h-[44px]">{u.is_active ? "Deactivate" : "Activate"}</Button>
              <Button size="sm" variant="danger" onClick={() => handleDelete(u.id, u.username)} aria-label={`Delete ${u.username}`} className="min-h-[44px]"><Icons.trash size={16} /></Button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <UserFormModal
          user={editing}
          zones={zones}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function UserFormModal({
  user,
  zones,
  onClose,
  onSaved,
}: {
  user: User | null;
  zones: SaferZone[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [username, setUsername] = React.useState(user?.username || "");
  const [fullName, setFullName] = React.useState(user?.full_name || "");
  const [faydaId, setFaydaId] = React.useState(user?.fayda_id || "");
  const [phone, setPhone] = React.useState(user?.phone || "");
  const [role, setRole] = React.useState<User["role"]>(user?.role || "viewer");
  const [password, setPassword] = React.useState("");
  const [saferZoneId, setSaferZoneId] = React.useState<string>(user?.zone ? String(user.zone.id) : "");
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const filteredZones = React.useMemo(() => {
    if (role === "leader") return zones;
    return zones;
  }, [zones, role]);

  const handleSave = async () => {
    setServerError(null);
    if (!username || !fullName) { setServerError("Username and full name are required"); return; }
    if (!user && !password) { setServerError("Password is required for new users"); return; }
    if (faydaId && !validateFaydaId(faydaId)) { setServerError("Fayda must be exactly 12 digits"); return; }
    setSaving(true);
    try {
      if (user) {
        await api.updateUser(user.id, {
          fullName,
          role,
          faydaId: faydaId || null,
          phone: phone || null,
          isActive: user.is_active,
        });
      } else {
        await api.createUser({
          username,
          password,
          fullName,
          faydaId: faydaId || null,
          phone: phone || null,
          role,
        } as Record<string, unknown>);
      }
      toast(user ? "User updated" : "User created", "success");
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed";
      setServerError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={user ? `Edit User: ${user.username}` : "Add User"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="uf-username">Username *</Label>
            <Input id="uf-username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={!!user} aria-required="true" />
          </div>
          <div>
            <Label htmlFor="uf-fullName">Full Name *</Label>
            <Input id="uf-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} aria-required="true" />
          </div>
          <div>
            <Label htmlFor="uf-fayda">Fayda / ID (12 digits)</Label>
            <Input id="uf-fayda" value={faydaId || ""} onChange={(e) => setFaydaId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="uf-phone">Phone</Label>
            <Input id="uf-phone" value={phone || ""} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="uf-role">Role *</Label>
            <Select id="uf-role" value={role} onChange={(e) => setRole(e.target.value as User["role"])}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="uf-zone">Safer Zone (Leader only)</Label>
            <Select id="uf-zone" value={saferZoneId} onChange={(e) => setSaferZoneId(e.target.value)} disabled={role !== "leader"}>
              <option value="">Select Zone</option>
              {filteredZones.map((z) => <option key={z.id} value={String(z.id)}>{z.name} ({z.kebele_name})</option>)}
            </Select>
            <p className="text-xs text-[var(--text-muted)]">Only Leader role has a safer zone assignment. Kebele Admin assignment is via kebele.collector_id server-side.</p>
          </div>
          {!user && (
            <div className="sm:col-span-2">
              <Label htmlFor="uf-password">Password * (min 8 chars, backend-hashed)</Label>
              <Input id="uf-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-required="true" />
            </div>
          )}
        </div>
        {serverError && <Alert variant="danger">{serverError}</Alert>}
      </div>
    </Modal>
  );
}
