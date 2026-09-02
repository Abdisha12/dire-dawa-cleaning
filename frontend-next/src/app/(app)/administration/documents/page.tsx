"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/utils";

type Doc = {
  id: number;
  title: string;
  description?: string | null;
  category?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  uploader_name?: string;
  created_at?: string;
  updated_at?: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function DocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.role;
  const canUpload = role === "admin" || role === "collector" || role === "leader";
  const canDelete = role === "admin" || role === "collector";

  const [docs, setDocs] = React.useState<Doc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;

  const [showForm, setShowForm] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

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
      const res = await api.getDocuments(params, { signal: ctrl.signal });
      const arr = Array.isArray(res) ? (res as unknown as Doc[]) : (res as { documents: Doc[] }).documents || [];
      const isPaginated = res && typeof res === "object" && "total" in (res as Record<string, unknown>);
      if (isPaginated) {
        const t = (res as unknown as { total: number; pages: number }).total;
        const p = (res as unknown as { total: number; pages: number }).pages;
        setTotal(t);
        setPages(p);
      } else {
        setTotal(arr.length);
        setPages(1);
      }
      setDocs(arr);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, debouncedSearch]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete document "${title}"? This cannot be undone.`)) return;
    try {
      await api.deleteDocument(id);
      toast("Document deleted", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const downloadDoc = async (id: number, title: string) => {
    try {
      const res = await fetch(api.documentDownloadUrl(id), { headers: { "x-session-token": localStorage.getItem("ddcms_token") || "" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = title;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Download failed", "error");
    }
  };

  const columns: Column<Doc>[] = [
    { key: "title", header: "Title", render: (d) => <strong>{d.title}</strong> },
    { key: "category", header: "Category", render: (d) => d.category || "—" },
    { key: "file_name", header: "File", render: (d) => d.file_name || "—" },
    { key: "file_size", header: "Size", render: (d) => d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "—" },
    { key: "uploader_name", header: "Uploader", render: (d) => d.uploader_name || "—" },
    { key: "created_at", header: "Created", render: (d) => d.created_at ? fmtDate(d.created_at) : "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Documents</h1>
          <p className="text-sm text-[var(--text-muted)]">Document library — max 10 MB upload, authenticated access only.</p>
        </div>
        {canUpload && <Button onClick={() => setShowForm(true)}>＋ Upload Document</Button>}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="d-search">Search</Label>
          <Input id="d-search" placeholder="Title, file name…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[200px]" aria-label="Search documents" />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="hidden sm:block">
        <DataTable
          columns={columns as Column<Record<string, unknown>>[]}
          data={docs as unknown as Record<string, unknown>[]}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No documents"
          emptyDescription="Backend returned no documents for the current filter."
          getRowKey={(d, i) => String((d as unknown as { id: number }).id ?? i)}
          page={page}
          pages={pages}
          onPage={(p) => setPage(p)}
          rowActions={(d) => (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => downloadDoc((d as { id: number }).id, (d as { title: string }).title)} aria-label={`Download ${(d as { title: string }).title}`}><Icons.save size={16} /></Button>
              {canDelete && <Button size="sm" variant="danger" onClick={() => handleDelete((d as { id: number }).id, (d as { title: string }).title)} aria-label={`Delete ${(d as { title: string }).title}`}><Icons.trash size={16} /></Button>}
            </div>
          )}
        />
      </div>

      <div className="space-y-3 sm:hidden">
        {docs.map((d) => (
          <div key={d.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="font-semibold">{d.title}</div>
            <div className="text-xs text-[var(--text-muted)]">{d.category || "—"} · {d.file_name || "—"}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">By {d.uploader_name || "—"} · {d.created_at ? fmtDate(d.created_at) : "—"}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => downloadDoc(d.id, d.title)} className="min-h-[44px]">Download</Button>
              {canDelete && <Button size="sm" variant="danger" onClick={() => handleDelete(d.id, d.title)} aria-label={`Delete ${d.title}`} className="min-h-[44px]"><Icons.trash size={16} /></Button>}
            </div>
          </div>
        ))}
      </div>

      {showForm && canUpload && (
        <UploadModal
          uploading={uploading}
          setUploading={setUploading}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function UploadModal({ uploading, setUploading, onClose, onSaved }: { uploading: boolean; setUploading: (b: boolean) => void; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const f = e.target.files?.[0] || null;
    if (!f) { setFile(null); return; }
    if (f.size > MAX_FILE_SIZE) { setFileError(`File too large: max 10 MB (current ${Math.round(f.size / 1024 / 1024)} MB)`); setFile(null); return; }
    setFile(f);
  };

  const handleSave = async () => {
    setServerError(null);
    if (!title) { setServerError("Title required"); return; }
    if (!file) { setServerError("File required"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("category", category);
    fd.append("file", file);
    try {
      await api.uploadDocument(fd);
      toast("Document uploaded", "success");
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed";
      setServerError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Upload Document"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</Button></>}
    >
      <div className="space-y-3">
        <div><Label htmlFor="ud-title">Title *</Label><Input id="ud-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label htmlFor="ud-cat">Category</Label><Input id="ud-cat" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
        <div><Label htmlFor="ud-desc">Description</Label><Input id="ud-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div>
          <Label htmlFor="ud-file">File * (max 10 MB)</Label>
          <Input id="ud-file" type="file" onChange={handleFile} />
          {file && <div className="mt-1 text-xs text-[var(--text-muted)]">Selected: {file.name} ({Math.round(file.size / 1024)} KB)</div>}
          {fileError && <div className="mt-1 text-xs text-[var(--danger)]">{fileError}</div>}
        </div>
        {uploading && <div className="text-sm text-[var(--text-muted)]" role="status" aria-live="polite">Uploading…</div>}
        {serverError && <Alert variant="danger">{serverError}</Alert>}
      </div>
    </Modal>
  );
}
