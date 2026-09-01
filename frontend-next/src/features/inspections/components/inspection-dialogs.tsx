"use client";
import * as React from "react";
import { inspectionsApi } from "@/features/inspections/services/inspections-api";
import type { Inspection, SaferZone, Kebele } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/utils";
import { ApiError } from "@/lib/api";

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
  const [kebeleId, setKebeleId] = React.useState<string>(() => {
    if (myZone) return String(myZone.kebele_id);
    return inspection ? String(inspection.kebele_id) : "";
  });
  const [zoneId, setZoneId] = React.useState<string>(() => {
    if (myZone) return String(myZone.id);
    return inspection?.safer_zone_id ? String(inspection.safer_zone_id) : "";
  });
  const [date, setDate] = React.useState(() => (inspection?.date ? inspection.date.slice(0, 10) : new Date().toISOString().slice(0, 10)));
  const [status, setStatus] = React.useState<Inspection["status"]>(() => inspection?.status || "active");
  const [notes, setNotes] = React.useState(() => inspection?.notes || "");
  const [files, setFiles] = React.useState<FileList | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const filteredZones = React.useMemo(() => {
    if (myZone) return [myZone];
    if (!kebeleId) return zones;
    // legacy: when kebele selected, filter zones to that kebele for UI, but allow any zone (optional)
    return zones.filter((z) => String(z.kebele_id) === kebeleId);
  }, [zones, kebeleId, myZone]);

  const handleSave = async () => {
    setError(null);
    if (!kebeleId || !date) {
      setError("Kebele and date are required");
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.append("kebeleId", kebeleId);
    fd.append("saferZoneId", zoneId || "");
    fd.append("date", date);
    fd.append("status", status);
    fd.append("notes", notes);
    if (files) {
      for (const f of Array.from(files)) fd.append("photos", f);
    }
    try {
      if (inspection) await inspectionsApi.update(inspection.id, fd);
      else await inspectionsApi.create(fd);
      toast(inspection ? "Inspection updated" : "Inspection saved", "success");
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={inspection ? "Edit Inspection" : "New Inspection"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : <><Icons.save size={16} /> Save</>}</Button></>}>
      <div className="space-y-4">
        {myZone ? (
          <div>
            <Label>Zone</Label>
            <Input value={`${myZone.name} — ${myZone.kebele_name}`} disabled aria-label="Zone (auto)" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="if-kebele">Kebele *</Label>
              <Select id="if-kebele" value={kebeleId} onChange={(e) => { setKebeleId(e.target.value); setZoneId(""); }} aria-label="Kebele">
                <option value="">Select Kebele</option>
                {kebeles.map((k) => <option key={k.id} value={String(k.id)}>{k.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="if-zone">Zone (optional)</Label>
              <Select id="if-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)} aria-label="Zone">
                <option value="">Kebele-level (no specific zone)</option>
                {filteredZones.map((z) => <option key={z.id} value={String(z.id)}>{z.name} — {z.kebele_name}</option>)}
              </Select>
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="if-date">Date *</Label>
            <Input id="if-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <div className="flex gap-3 pt-1">
              {(["active", "warning", "danger"] as const).map((s) => (
                <label key={s} className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="if-status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                  <Badge variant={s === "active" ? "green" : s === "warning" ? "orange" : "red"}>{s}</Badge>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="if-notes">Notes / Issues</Label>
          <Textarea id="if-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <div>
          <Label htmlFor="if-photos">Photos (max 10)</Label>
          <Input id="if-photos" type="file" multiple accept="image/*" onChange={(e) => setFiles(e.target.files)} />
          {inspection?.photos?.length ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {inspection.photos.map((p) => (
                <div key={p.id} id={`photo-${p.id}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.file_path} alt="photo" className="h-20 w-full object-cover rounded border" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
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
                <img src={p.file_path} alt="photo" className="h-32 w-40 object-cover rounded border" />
              </a>
              <button
                onClick={() => handleDeletePhoto(p.id)}
                disabled={deleting === p.id}
                className="absolute -right-1 -top-1 rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-xs text-white"
                aria-label="Delete photo"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
