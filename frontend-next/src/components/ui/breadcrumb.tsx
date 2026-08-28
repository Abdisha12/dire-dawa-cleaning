import Link from "next/link";
import { Icons } from "./icon";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
      {items.map((it, idx) => (
        <span key={idx} className="flex items-center gap-1">
          {idx > 0 && <Icons.chevronRight size={14} className="opacity-50" aria-hidden />}
          {it.href ? (
            <Link href={it.href} className="hover:text-[var(--text)] hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="font-medium text-[var(--text)]">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
