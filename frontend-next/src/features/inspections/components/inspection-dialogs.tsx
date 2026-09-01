"use client";
import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { inspectionsApi } from "@/features/inspections/services/inspections-api";
import type { Inspection, SaferZone, Kebele } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/utils";
import { ApiError } from "@/lib/api";

const inspectionSchema = z.object({
  kebeleId: z.string().min(1, "Kebele is required"),
  saferZoneId: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  status: z.enum(["active", "warning", "danger"]),
  notes: z.string().max(5000).optional().nullable(),
});

type InspectionFormValues = z.infer<typeof inspectionSchema>;

export function InspectionFormModal({
  inspection,
  kebeles,
  zones,
  myZone,
  onClose,
  onSaved,
}: {
  inspection: Inspection | null;
  kebeles: Kebele[];
  zones: SaferZone[];
  myZone?: SaferZone | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [previews, setPreviews] = React.useState<string[]>([]);

  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      kebeleId: myZone ? String(myZone.kebele_id) : inspection ? String(inspection.kebele_id) : "",
      saferZoneId: myZone ? String(myZone.id) : inspection?.safer_zone_id ? String(inspection.safer_zone_id) : "",
      date: inspection?.date ? inspection.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      status: (inspection?.status as "active" | "warning" | "danger") || "active",
      notes: inspection?.notes || "",
    },
  });

  const watchedKebele = form.watch("kebeleId");
  const filteredZones = React.useMemo(() => {
    if (myZone) return [myZone];
    if (!watchedKebele) return [];
    return zones.filter((z) => String(z.kebele_id) === watchedKebele);
  }, [zones, watchedKebele, myZone]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (list.length > 10) {
      setFileError("Maximum 10 photos allowed");
      return;
    }
    for (const f of list) {
      if (!f.type.startsWith("image/")) {
        setFileError(`Invalid type: ${f.name} — only images allowed`);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setFileError(`Too large: ${f.name} — max 5MB`);
        return;
      }
    }
    setFiles(list);
    // previews
    const urls = list.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
  };

  React.useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  const onSubmit = async (values: InspectionFormValues) => {
    setServerError(null);
    if (files.length > 10) {
      setFileError("Maximum 10 photos");
      return;
    }
    const fd = new FormData();
    fd.append("kebeleId", values.kebeleId);
    fd.append("saferZoneId", values.saferZoneId || "");
    fd.append("date", values.date);
    fd.append("status", values.status);
    fd.append("notes", values.notes || "");
    for (const f of files) fd.append("photos", f);
    try {
      if (inspection) await inspectionsApi.update(inspection.id, fd);
      else await inspectionsApi.create(fd);
      toast(inspection ? "Inspection updated" : "Inspection saved", "success");
      onSaved();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Save failed";
      setServerError(msg);
    }
  };

  return (
    <Modal open onClose={onClose} title={inspection ? "Edit Inspection" : "New Inspection"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : <><Icons.save size={16} /> Save</>}</Button></>}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {myZone ? (
          <div>
            <Label>Zone</Label>
            <Input value={`${myZone.name} — ${myZone.kebele_name}`} disabled aria-label="Zone (auto)" />
            <input type="hidden" {...form.register("kebeleId")} value={String(myZone.kebele_id)} />
            <input type="hidden" {...form.register("saferZoneId")} value={String(myZone.id)} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="if-kebele">Kebele *</Label>
              <Select id="if-kebele" {...form.register("kebeleId")} onChange={(e) => { form.setValue("kebeleId", e.target.value); form.setValue("saferZoneId", ""); }} aria-invalid={!!form.formState.errors.kebeleId} aria-describedby={form.formState.errors.kebeleId ? "if-kebele-error" : undefined}>
                <option value="">Select Kebele</option>
                {kebeles.map((k) => <option key={k.id} value={String(k.id)}>{k.name}</option>)}
              </Select>
              {form.formState.errors.kebeleId && <p id="if-kebele-error" role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.kebeleId.message}</p>}
            </div>
            <div>
              <Label htmlFor="if-zone">Zone (optional)</Label>
              <Select id="if-zone" {...form.register("saferZoneId")} disabled={!watchedKebele} aria-invalid={!!form.formState.errors.saferZoneId}>
                <option value="">Kebele-level (no specific zone)</option>
                {filteredZones.map((z) => <option key={z.id} value={String(z.id)}>{z.name} — {z.kebele_name}</option>)}
              </Select>
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="if-date">Date *</Label>
            <Input id="if-date" type="date" {...form.register("date")} aria-invalid={!!form.formState.errors.date} aria-describedby={form.formState.errors.date ? "if-date-error" : undefined} />
            {form.formState.errors.date && <p id="if-date-error" role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.date.message}</p>}
          </div>
          <div>
            <Label>Status</Label>
            <div className="flex gap-3 pt-1">
              {(["active", "warning", "danger"] as const).map((s) => (
                <label key={s} className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" value={s} checked={form.watch("status") === s} onChange={() => form.setValue("status", s)} />
                  <Badge variant={s === "active" ? "green" : s === "warning" ? "orange" : "red"}>{s}</Badge>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="if-notes">Notes / Issues</Label>
          <Textarea id="if-notes" {...form.register("notes")} rows={3} />
          {form.formState.errors.notes && <p role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.notes.message}</p>}
        </div>
        <div>
          <Label htmlFor="if-photos">Photos (max 10, 5MB each, images only)</Label>
          <Input id="if-photos" type="file" multiple accept="image/*" onChange={handleFiles} />
          {fileError && <p role="alert" className="text-xs text-[var(--danger)]">{fileError}</p>}
          {previews.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={`preview ${i + 1}`} className="h-20 w-full object-cover rounded border" loading="lazy" />
              ))}
            </div>
          )}
          {inspection?.photos?.length ? (
            <div className="mt-2">
              <div className="text-xs text-[var(--text-muted)] mb-1">Existing photos</div>
              <div className="grid grid-cols-3 gap-2">
                {inspection.photos.map((p) => (
                  <div key={p.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.file_path} alt="existing photo" className="h-20 w-full object-cover rounded border" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {serverError && <Alert variant="danger">{serverError}</Alert>}
      </form>
    </Modal>
  );
}

export function InspectionDetailDrawer({ inspection, onClose }: { inspection: Inspection; onClose: () => void }) {
  return (
    <Drawer open onClose={onClose} title={`Inspection — ${fmtDate(inspection.date)}`}>
      <div className="space-y-6 text-sm">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Inspection Information</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-xs text-[var(--text-muted)]">Date</span><div className="font-medium">{fmtDate(inspection.date)}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Status</span><div><Badge variant={inspection.status === "active" ? "green" : inspection.status === "warning" ? "orange" : "red"}>{inspection.status}</Badge></div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Inspector</span><div>{inspection.inspector_name || "—"}</div></div>
          </div>
        </section>
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Location</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-xs text-[var(--text-muted)]">Kebele</span><div>{inspection.kebele_name || "—"} {inspection.kebele_code ? `(${inspection.kebele_code})` : ""}</div></div>
            <div><span className="text-xs text-[var(--text-muted)]">Safer Zone</span><div>{inspection.zone_name || "Kebele-level"}</div></div>
          </div>
        </section>
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Findings</h3>
          <p className="whitespace-pre-wrap">{inspection.notes || "No notes"}</p>
        </section>
        <section className="space-y-3 border-t border-[var(--border)] pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Photos</h3>
          {!inspection.photos?.length ? (
            <p className="text-[var(--text-muted)]">No photos</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {inspection.photos.map((p) => (
                <a key={p.id} href={p.file_path} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.file_path} alt="inspection photo" className="h-32 w-full object-cover rounded border" loading="lazy" />
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}

export function PhotoGalleryModal({ inspection, onClose }: { inspection: Inspection; onClose: () => void }) {
  const [current, setCurrent] = React.useState<Inspection | null>(inspection);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const { toast } = useToast();

  const handleDeletePhoto = async (photoId: number) => {
    setDeleting(photoId);
    try {
      await inspectionsApi.deletePhoto(photoId);
      setCurrent((prev) => (prev ? { ...prev, photos: prev.photos?.filter((p) => p.id !== photoId) } : prev));
      toast("Photo removed", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Photos — ${current?.kebele_name || ""} (${current ? fmtDate(current.date) : ""})`} footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      {!current?.photos?.length ? (
        <p className="text-sm text-[var(--text-muted)]">No photos</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {current.photos.map((p) => (
            <div key={p.id} className="relative">
              <a href={p.file_path} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.file_path} alt="photo" className="h-32 w-40 object-cover rounded border" loading="lazy" />
              </a>
              <button onClick={() => handleDeletePhoto(p.id)} disabled={deleting === p.id} className="absolute -right-1 -top-1 rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-xs text-white" aria-label="Delete photo">✕</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
