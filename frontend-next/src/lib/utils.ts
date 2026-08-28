// lib/utils.ts — Strict helpers (no `any`)

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function escapeHtml(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtETB(n: unknown): string {
  const v = typeof n === "number" ? n : parseFloat(String(n || 0));
  return `ETB ${v.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: unknown): string {
  if (!d) return "—";
  return new Date(String(d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthName(m: number): string {
  return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m] || String(m);
}

export function validateFaydaId(val: string): boolean {
  if (!val) return true;
  const clean = val.replace(/[\s-]/g, "");
  return /^\d{12}$/.test(clean);
}

export function formatFaydaId(val: string): string {
  if (!val) return "";
  const clean = val.replace(/[\s-]/g, "");
  if (/^\d{12}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
  }
  return val;
}
