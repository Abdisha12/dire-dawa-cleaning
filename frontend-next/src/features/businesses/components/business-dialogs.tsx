"use client";
import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ApiError } from "@/lib/api";
import { businessesApi } from "@/features/businesses/services/businesses-api";
import type { Business, SaferZone } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { fmtETB, fmtDate, validateFaydaId } from "@/lib/utils";
import { paymentsApi } from "@/features/businesses/services/payments-api";
import type { Payment } from "@/types";

const TYPES = ["shop","cafe","hotel","restaurant","pharmacy","market","workshop","office","school","clinic","other"] as const;

const businessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(120),
  ownerName: z.string().min(1, "Owner name is required").max(120),
  ownerFaydaId: z.string().max(50).optional().nullable(),
  ownerPhone: z.string().max(30).optional().nullable(),
  type: z.string().max(40).optional().nullable(),
  monthlyTarget: z.coerce.number().min(0, "Must be ≥ 0"),
  saferZoneId: z.string().min(1, "Safer Zone is required"),
  kebeleId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

type BusinessFormValues = z.infer<typeof businessSchema>;

export function BusinessFormModal({
  business,
  zones,
  myZone,
  isCollector,
  onClose,
  onSaved,
}: {
  business: Business | null;
  zones: SaferZone[];
  myZone?: SaferZone;
  isCollector: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: business?.name || "",
      ownerName: business?.owner_name || "",
      ownerFaydaId: business?.owner_fayda_id || "",
      ownerPhone: business?.owner_phone || "",
      type: business?.type || "shop",
      monthlyTarget: business ? Number(business.monthly_target) : 0,
      saferZoneId: business?.safer_zone_id ? String(business.safer_zone_id) : myZone ? String(myZone.id) : "",
      kebeleId: business ? String((business as unknown as { kebele_id?: number }).kebele_id || "") : "",
      isActive: business ? !!business.is_active : true,
      notes: business?.notes || "",
    },
  });

  // kebele → zone cascade for non-collector/leader
  const selectedKebele = form.watch("kebeleId");
  const filteredZones = React.useMemo(() => {
    if (myZone) return [myZone];
    if (isCollector) return zones;
    if (selectedKebele) return zones.filter((z) => String(z.kebele_id) === String(selectedKebele));
    return zones;
  }, [zones, myZone, isCollector, selectedKebele]);

  const onSubmit = async (values: BusinessFormValues) => {
    setServerError(null);
    if (values.ownerFaydaId && !validateFaydaId(values.ownerFaydaId)) {
      form.setError("ownerFaydaId", { message: "Must be exactly 12 digits" });
      return;
    }
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      ownerName: values.ownerName.trim(),
      ownerFaydaId: values.ownerFaydaId ? values.ownerFaydaId.replace(/[\s-]/g, "") : null,
      ownerPhone: values.ownerPhone?.trim() || null,
      type: values.type || "shop",
      monthlyTarget: Number(values.monthlyTarget),
      saferZoneId: values.saferZoneId ? Number(values.saferZoneId) : null,
      notes: values.notes?.trim() || null,
    };
    // For edit, include isActive
    if (business) payload.isActive = !!values.isActive;
    try {
      if (business) await businessesApi.update(business.id, payload);
      else await businessesApi.create(payload);
      toast(business ? "Business updated" : "Business added", "success");
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed";
      if (e instanceof ApiError && e.status === 409) {
        form.setError("ownerFaydaId", { message: msg });
      } else {
        setServerError(msg);
      }
    }
  };

  return (
    <Modal open onClose={onClose} title={business ? "Edit Business" : "Add Business"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : <><Icons.save size={18} /> Save</>}</Button></>}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="bf-name">Business Name *</Label>
            <Input id="bf-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            {form.formState.errors.name && <p role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="bf-owner">Owner Name *</Label>
            <Input id="bf-owner" {...form.register("ownerName")} aria-invalid={!!form.formState.errors.ownerName} />
            {form.formState.errors.ownerName && <p role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.ownerName.message}</p>}
          </div>
          <div>
            <Label htmlFor="bf-fayda">Owner Fayda/ID</Label>
            <Input id="bf-fayda" {...form.register("ownerFaydaId")} aria-invalid={!!form.formState.errors.ownerFaydaId} />
            {form.formState.errors.ownerFaydaId && <p role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.ownerFaydaId.message}</p>}
          </div>
          <div>
            <Label htmlFor="bf-phone">Owner Phone</Label>
            <Input id="bf-phone" {...form.register("ownerPhone")} />
          </div>
          <div>
            <Label htmlFor="bf-type">Business Type</Label>
            <Select id="bf-type" {...form.register("type")}>
              {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="bf-target">Monthly Target (ETB) *</Label>
            <Input id="bf-target" type="number" min={0} step={0.01} {...form.register("monthlyTarget")} aria-invalid={!!form.formState.errors.monthlyTarget} />
            {form.formState.errors.monthlyTarget && <p role="alert" className="text-xs text-[var(--danger)]">{String(form.formState.errors.monthlyTarget.message)}</p>}
          </div>
          {myZone ? (
            <>
              <input type="hidden" {...form.register("saferZoneId")} value={String(myZone.id)} />
              <div>
                <Label>Zone</Label>
                <Input value={myZone.name} disabled aria-label="Zone (auto)" />
              </div>
            </>
          ) : isCollector ? (
            <div>
              <Label htmlFor="bf-zone">Safer Zone *</Label>
              <Select id="bf-zone" {...form.register("saferZoneId")} aria-invalid={!!form.formState.errors.saferZoneId}>
                <option value="">Select Zone</option>
                {filteredZones.map((z) => <option key={z.id} value={String(z.id)}>{z.name} — {z.kebele_name}</option>)}
              </Select>
              {form.formState.errors.saferZoneId && <p role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.saferZoneId.message}</p>}
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="bf-kebele">Kebele *</Label>
                <Select id="bf-kebele" {...form.register("kebeleId")} onChange={(e) => { form.setValue("kebeleId", e.target.value); form.setValue("saferZoneId", ""); }}>
                  <option value="">Select Kebele</option>
                  {Array.from(new Map(zones.map((z) => [z.kebele_id, z.kebele_name])).entries()).map(([id, name]) => <option key={String(id)} value={String(id)}>{name as string}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="bf-zone-cascade">Safer Zone *</Label>
                <Select id="bf-zone-cascade" {...form.register("saferZoneId")} disabled={!selectedKebele} aria-invalid={!!form.formState.errors.saferZoneId}>
                  <option value="">Select Zone</option>
                  {filteredZones.map((z) => <option key={z.id} value={String(z.id)}>{z.name}</option>)}
                </Select>
                {form.formState.errors.saferZoneId && <p role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.saferZoneId.message}</p>}
              </div>
            </>
          )}
          {business && (
            <div>
              <Label htmlFor="bf-active">Status</Label>
              <Select id="bf-active" value={form.watch("isActive") ? "1" : "0"} onChange={(e) => form.setValue("isActive", e.target.value === "1")}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </Select>
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="bf-notes">Notes</Label>
          <Textarea id="bf-notes" {...form.register("notes")} rows={2} />
        </div>
        {serverError && <Alert variant="danger">{serverError}</Alert>}
      </form>
    </Modal>
  );
}

export function BusinessDetailsDrawer({ business, onClose }: { business: Business; onClose: () => void }) {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    setLoadingPayments(true);
    paymentsApi
      .getAll({ businessId: String(business.id) })
      .then((res) => {
        if (cancelled) return;
        const arr = Array.isArray(res) ? res : (res as { data: Payment[] })?.data || [];
        setPayments(arr.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setPayments([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPayments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [business.id]);

  return (
    <Drawer open onClose={onClose} title={`Business — ${business.name}`}>
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Business Information</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-xs text-[var(--text-muted)]">Name</span><div className="font-medium">{business.name}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Type</span><div><Badge variant="gray">{business.type}</Badge></div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Monthly Target</span><div className="font-semibold">{fmtETB(business.monthly_target)}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Status</span><div>{business.is_active ? <StatusBadge status="active" /> : <Badge variant="gray">Inactive</Badge>}</div></div>
          </div>
        </section>
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Owner</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-xs text-[var(--text-muted)]">Owner Name</span><div className="font-medium">{business.owner_name}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Fayda/ID</span><div>{business.owner_fayda_id || "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Phone</span><div>{business.owner_phone || "—"}</div></div>
          </div>
        </section>
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Location</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-xs text-[var(--text-muted)]">Kebele</span><div>{(business as unknown as { kebele_name?: string }).kebele_name || "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Safer Zone</span><div>{(business as unknown as { safer_zone_name?: string }).safer_zone_name || "—"}</div></div>
          </div>
        </section>
        {business.notes && (
          <section className="space-y-3 border-t border-[var(--border)] pt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Notes</h3>
            <p className="text-sm">{business.notes}</p>
          </section>
        )}
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Payment History</h3>
          {loadingPayments ? (
            <div className="h-12 animate-pulse rounded bg-[var(--gray-100)]" />
          ) : payments.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No payments recorded for this business.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded border border-[var(--border)] p-2 text-sm">
                  <div>
                    <div className="font-mono text-xs">{p.receipt_number || `PAY-${p.id}`}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {p.month}/{p.year} · <Badge variant={p.status === "paid" ? "green" : p.status === "pending" ? "orange" : "gray"}>{p.status}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmtETB(p.amount)}</div>
                    <div className="text-xs text-[var(--text-muted)]">{p.method}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Activity</h3>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div><span className="text-xs text-[var(--text-muted)]">Created</span><div>{fmtDate(business.created_at)}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Updated</span><div>{fmtDate(business.updated_at)}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Kebele ID</span><div className="font-mono">{(business as unknown as { kebele_id?: number }).kebele_id || "—"}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Zone ID</span><div className="font-mono">{business.safer_zone_id}</div></div>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
