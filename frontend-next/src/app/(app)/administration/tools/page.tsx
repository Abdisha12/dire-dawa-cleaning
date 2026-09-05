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
import type { Tool, SaferZone } from "@/types";

const CONDITIONS = ["good", "fair", "poor", "broken"] as const;

export default function ToolsPage() {
  const { user } = useAuth();
  const { selectedId: kebeleId } = useKebele();
  const { toast } = useToast();
  const role = user?.role;
  const canEdit = role === "admin" || role === "collector" || role === "leader";
  const canDelete = role === "admin" || role === "collector" || role === "leader";

  const [tools, setTools] = React.useState<Tool[]>([]);
  const [zones, setZones] = React.useState<SaferZone[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [zoneFilter, setZoneFilter] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;

  const [editing, setEditing] = React.useState<Tool | null>(null);
  const [showForm, setShowForm] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const visibleZones = React.useMemo(() => {
    if (role === "leader" && user?.zone?.id) return zones.filter((z) => z.id === user.zone!.id);
    if (role === "collector" && kebeleId) return zones.filter((z) => z.kebele_id === kebeleId);
    return zones;
  }, [zones, role, kebeleId, user]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (debouncedSearch) params.search = debouncedSearch;
      if (zoneFilter) params.saferZoneId = zoneFilter;
      const [tRes, zRes] = await Promise.all([
        api.getTools(params, { signal: ctrl.signal }),
        api.getSaferZones({}, { signal: ctrl.signal }),
      ]);
      const arr = Array.isArray(tRes) ? (tRes as unknown as Tool[]) : (tRes as { tools: Tool[] }).tools || [];
      const isPaginated = tRes && typeof tRes === "object" && "total" in (tRes as Record<string, unknown>);
      if (isPaginated) {
        const t = (tRes as unknown as { total: number; pages: number }).total;
        const p = (tRes as unknown as { total: number; pages: number }).pages;
        setTotal(t);
        setPages(p);
      } else {
        setTotal(arr.length);
        setPages(1);
      }
      setTools(arr);
      setZones((zRes as { zones: SaferZone[] }).zones || []);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, debouncedSearch, zoneFilter]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete tool "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteTool(id);
      toast("Tool deleted", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const columns: Column<Tool>[] = [
    { key: "name", header: "Name", render: (t) => <strong>{t.name}</strong> },
    { key: "category", header: "Category", render: (t) => t.category || "—" },
    { key: "quantity", header: "Qty", render: (t) => String(t.quantity ?? 0) },
    { key: "condition_status", header: "Condition", render: (t) => <Badge variant={t.condition_status === "good" ? "green" : t.condition_status === "broken" ? "red" : "orange"}>{t.condition_status}</Badge> },
    { key: "zone_name", header: "Safer Zone", render: (t) => t.zone_name || "—" },
    { key: "safer_zone_id", header: "Zone ID", render: (t) => String(t.safer_zone_id) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Tools / Equipment</h1>
          <p className="text-sm text-[var(--text-muted)]">Inventory management
            {role === "collector" && kebeleId ? " — My Kebele" : role === "leader" ? " — My Zone" : " — City-wide"}
          </p>
        </div>
        {canEdit && <Button onClick={() => { setEditing(null); setShowForm(true); }}>＋ Add Tool</Button>}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="t-search">Search</Label>
          <Input id="t-search" placeholder="Name, category…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[200px]" aria-label="Search tools" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="t-zone">Safer Zone</Label>
          <Select id="t-zone" value={zoneFilter} onChange={(e) => { setZoneFilter(e.target.value); setPage(1); }} className="w-[200px]" aria-label="Filter by safer zone">
            <option value="">All Zones</option>
            {visibleZones.map((z) => <option key={z.id} value={String(z.id)}>{z.name}</option>)}
          </Select>
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="hidden sm:block">
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={tools as unknown as Record<string, unknown>[]}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No tools"
          emptyDescription="Backend returned no tools for the current filter."
          getRowKey={(t, i) => String((t as unknown as { id: number }).id ?? i)}
          page={page}
          pages={pages}
          onPage={(p) => setPage(p)}
          rowActions={
            canEdit ? (t) => (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => { setEditing(t as unknown as Tool); setShowForm(true); }} aria-label={`Edit ${(t as { name: string }).name}`}><Icons.edit size={16} /></Button>
                {canDelete && (
                  <Button size="sm" variant="danger" onClick={() => handleDelete((t as { id: number }).id, (t as { name: string }).name)} aria-label={`Delete ${(t as { name: string }).name}`}><Icons.trash size={16} /></Button>
                )}
              </div>
            ) : undefined
          }
        />
      </div>

      <div className="space-y-3 sm:hidden">
        {tools.map((t) => (
          <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{t.category || "—"} · {t.zone_name || "—"}</div>
              </div>
              <Badge variant={t.condition_status === "good" ? "green" : t.condition_status === "broken" ? "red" : "orange"}>{t.condition_status}</Badge>
            </div>
            <div className="mt-2 text-xs">Qty: {t.quantity}</div>
            {canEdit && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(t); setShowForm(true); }} className="min-h-[44px]"><Icons.edit size={16} /> Edit</Button>
                {canDelete && <Button size="sm" variant="danger" onClick={() => handleDelete(t.id, t.name)} className="min-h-[44px]"><Icons.trash size={16} /></Button>}
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && canEdit && (
        <ToolFormModal
          tool={editing}
          zones={visibleZones}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function ToolFormModal({
  tool,
  zones,
  onClose,
  onSaved,
}: {
  tool: Tool | null;
  zones: SaferZone[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState(tool?.name || "");
  const [category, setCategory] = React.useState(tool?.category || "");
  const [quantity, setQuantity] = React.useState(String(tool?.quantity ?? 0));
  const [condition, setCondition] = React.useState<Tool["condition_status"]>(tool?.condition_status || "good");
  const [saferZoneId, setSaferZoneId] = React.useState<string>(tool ? String(tool.safer_zone_id) : (zones[0] ? String(zones[0].id) : ""));
  const [notes, setNotes] = React.useState(tool?.notes || "");
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setServerError(null);
    if (!name) { setServerError("Name required"); return; }
    if (!saferZoneId) { setServerError("Safer Zone required"); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        category: category || null,
        quantity: Number(quantity) || 0,
        conditionStatus: condition,
        saferZoneId: Number(saferZoneId),
        notes: notes || null,
      };
      if (tool) await api.updateTool(tool.id, payload);
      else await api.createTool(payload);
      toast(tool ? "Tool updated" : "Tool created", "success");
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
      title={tool ? `Edit Tool: ${tool.name}` : "Add Tool"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></>}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="tf-name">Name *</Label><Input id="tf-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="tf-cat">Category</Label><Input id="tf-cat" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <div><Label htmlFor="tf-qty">Quantity</Label><Input id="tf-qty" type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          <div>
            <Label htmlFor="tf-cond">Condition</Label>
            <Select id="tf-cond" value={condition} onChange={(e) => setCondition(e.target.value as Tool["condition_status"])}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="tf-zone">Safer Zone *</Label>
            <Select id="tf-zone" value={saferZoneId} onChange={(e) => setSaferZoneId(e.target.value)}>
              {zones.length === 0 && <option value="">No zones in your scope</option>}
              {zones.map((z) => <option key={z.id} value={String(z.id)}>{z.name}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="tf-notes">Notes</Label>
            <Input id="tf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        {serverError && <Alert variant="danger">{serverError}</Alert>}
      </div>
    </Modal>
  );
}
