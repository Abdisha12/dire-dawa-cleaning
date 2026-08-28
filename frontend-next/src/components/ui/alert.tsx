import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, TriangleAlert } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "danger";

const styles: Record<AlertVariant, string> = {
  info: "border-[#bfdbfe] bg-[var(--information-l)] text-[#1e40af]",
  success: "border-[#bbf7d0] bg-[var(--success-l)] text-[#14532d]",
  warning: "border-[#fed7aa] bg-[var(--warning-l)] text-[#7c2d12]",
  danger: "border-[#fecaca] bg-[var(--danger-l)] text-[#7f1d1d]",
};

const Icon = {
  info: Info,
  success: CheckCircle,
  warning: TriangleAlert,
  danger: AlertCircle,
};

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const I = Icon[variant];
  return (
    <div
      role="alert"
      className={cn("flex gap-3 rounded-[var(--r-md)] border px-4 py-3 text-sm", styles[variant], className)}
    >
      <I size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
