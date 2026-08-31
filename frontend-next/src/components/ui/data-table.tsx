"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Pagination } from "./pagination";
import { SkeletonTable } from "./skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/states";

export type Column<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  priority?: number; // 1 = always, 2 = hide on mobile
  hidden?: boolean;
  render?: (row: T) => React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  ariaLabel?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  // sorting
  sortKey?: string | null;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  // pagination (server)
  page?: number;
  pages?: number;
  onPage?: (p: number) => void;
  // filtering is external; this table is presentation only
  // row actions & bulk
  rowActions?: (row: T) => React.ReactNode;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onToggle?: (key: string) => void;
  getRowKey: (row: T) => string;
};

export function DataTable<T>({
  columns,
  data,
  ariaLabel,
  loading,
  error,
  onRetry,
  emptyTitle = "No data",
  emptyDescription,
  emptyAction,
  sortKey,
  sortDir,
  onSort,
  page,
  pages,
  onPage,
  rowActions,
  getRowKey,
}: DataTableProps<T>) {
  const visible = columns.filter((c) => !c.hidden);

  if (loading) return <SkeletonTable rows={5} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (data.length === 0)
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  return (
    <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)]">
      {/* desktop table */}
      <table className="hidden w-full border-collapse text-sm md:table" aria-label={ariaLabel}>
        <caption className="sr-only">{ariaLabel ?? "Data table"}</caption>
        <thead>
          <tr className="bg-[var(--gray-50)]">
            {visible.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={
                  sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                }
                className="whitespace-nowrap border-b border-[var(--border)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
              >
                {col.sortable && onSort ? (
                  <button
                    onClick={() => onSort(col.key)}
                    aria-label={`Sort by ${col.header}`}
                    className="inline-flex items-center gap-1 hover:text-[var(--text)] focus-visible:outline-none"
                  >
                    {col.header}
                    <span aria-hidden className="text-[10px]">
                      {sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
            {rowActions && <th scope="col" className="px-3 py-2 text-left text-xs">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-[var(--gray-100)] last:border-0 hover:bg-[var(--gray-50)]">
              {visible.map((col) => (
                <td key={col.key} className="px-3 py-2 align-middle">
                  {col.render ? col.render(row) : col.accessor ? col.accessor(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                </td>
              ))}
              {rowActions && <td className="whitespace-nowrap px-3 py-2">{rowActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {/* mobile cards */}
      <div className="divide-y divide-[var(--border)] md:hidden">
        {data.map((row) => (
          <div key={getRowKey(row)} className="p-3">
            <div className="grid grid-cols-2 gap-2">
              {visible
                .filter((c) => (c.priority ?? 1) === 1)
                .map((col) => (
                  <div key={col.key} className="min-w-0">
                    <div className="text-xs font-medium uppercase text-[var(--text-muted)]">{col.header}</div>
                    <div className="truncate text-sm">
                      {col.render ? col.render(row) : col.accessor ? col.accessor(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                    </div>
                  </div>
                ))}
            </div>
            {rowActions && <div className="mt-2 flex justify-end gap-2">{rowActions(row)}</div>}
          </div>
        ))}
      </div>

      {page !== undefined && pages !== undefined && onPage && <div className="p-3"><Pagination page={page} pages={pages} onPage={onPage} /></div>}
    </div>
  );
}
