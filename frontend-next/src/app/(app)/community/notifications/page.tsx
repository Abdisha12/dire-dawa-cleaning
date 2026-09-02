"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icon";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/utils";
import type { Notification } from "@/types";

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const limit = 25;

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (unreadOnly === "yes") params.unread = "true";
      else if (unreadOnly === "no") params.read = "true";
      const res = await api.getNotifications(params, { signal: ctrl.signal });
      const list = (res as { notifications: Notification[] }).notifications || [];
      const isPaginated = res && typeof res === "object" && "total" in (res as Record<string, unknown>);
      if (isPaginated) {
        const t = (res as unknown as { total: number; pages: number }).total;
        const p = (res as unknown as { total: number; pages: number }).pages;
        setTotal(t);
        setPages(p);
      } else {
        setTotal(list.length);
        setPages(1);
      }
      setNotifications(list);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }, [page, limit, unreadOnly]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkRead = async (n: Notification) => {
    if (n.is_read) return;
    try {
      await api.markNotificationRead(n.id);
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const handleMarkAll = async () => {
    try {
      await api.markAllNotificationsRead();
      toast("All marked as read", "success");
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const handleDelete = async (n: Notification) => {
    try {
      await api.deleteNotification(n.id);
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const columns: Column<Notification>[] = [
    { key: "created_at", header: "When", render: (n) => fmtDate(n.created_at) },
    { key: "title", header: "Title", render: (n) => <strong>{n.title}</strong> },
    { key: "type", header: "Type", render: (n) => <Badge variant="gray">{n.type}</Badge> },
    { key: "is_read", header: "Status", render: (n) => n.is_read ? <Badge variant="gray">Read</Badge> : <Badge variant="orange">Unread</Badge> },
    { key: "message", header: "Message", render: (n) => n.message },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-section">Notifications</h1>
          <p className="text-sm text-[var(--text-muted)]">Operational alerts relevant to your role and scope.</p>
        </div>
        <Button variant="outline" onClick={handleMarkAll} aria-label="Mark all notifications as read"><Icons.success size={16} /> Mark all read</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="n-unread">Status</Label>
          <Select id="n-unread" value={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.value); setPage(1); }} className="w-[140px]" aria-label="Filter by read status">
            <option value="">All</option>
            <option value="yes">Unread only</option>
            <option value="no">Read only</option>
          </Select>
        </div>
        <div className="text-xs text-[var(--text-muted)]">{total} total · page {page}/{pages}</div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="hidden sm:block">
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={notifications as unknown as Record<string, unknown>[]}
          loading={loading}
          error={error}
          onRetry={fetchData}
          emptyTitle="No notifications"
          emptyDescription="Backend returned no notifications for the current filter."
          getRowKey={(n, i) => String((n as unknown as { id: number }).id ?? i)}
          page={page}
          pages={pages}
          onPage={(p) => setPage(p)}
          rowActions={(n) => (
            <div className="flex gap-1">
              {!((n as { is_read: boolean }).is_read) && (
                <Button size="sm" variant="outline" onClick={() => handleMarkRead(n as unknown as Notification)} aria-label={`Mark ${(n as { title: string }).title} as read`}><Icons.success size={16} /></Button>
              )}
              <Button size="sm" variant="danger" onClick={() => handleDelete(n as unknown as Notification)} aria-label={`Delete ${(n as { title: string }).title}`}><Icons.trash size={16} /></Button>
            </div>
          )}
        />
      </div>

      <div className="space-y-3 sm:hidden">
        {notifications.map((n) => (
          <div key={n.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{n.title}</div>
                <div className="text-xs text-[var(--text-muted)]">{n.type} · {fmtDate(n.created_at)}</div>
                <div className="mt-1 text-sm">{n.message}</div>
              </div>
              {n.is_read ? <Badge variant="gray">Read</Badge> : <Badge variant="orange">Unread</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {!n.is_read && <Button size="sm" variant="outline" onClick={() => handleMarkRead(n)} className="min-h-[44px]">Mark read</Button>}
              <Button size="sm" variant="danger" onClick={() => handleDelete(n)} aria-label={`Delete ${n.title}`} className="min-h-[44px]"><Icons.trash size={16} /> Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
