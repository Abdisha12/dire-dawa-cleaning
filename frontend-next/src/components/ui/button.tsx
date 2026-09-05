import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "success" | "danger" | "purple" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium transition-colors whitespace-nowrap focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--primary)] text-white hover:bg-[var(--primary-d)]",
  success: "bg-[var(--success)] text-white hover:brightness-90",
  danger: "bg-[var(--danger)] text-white hover:brightness-90",
  purple: "bg-[#7c3aed] text-white hover:brightness-90",
  outline: "bg-transparent border border-[var(--border-strong)] text-[var(--gray-700)] hover:bg-[var(--gray-100)]",
  ghost: "bg-transparent text-[var(--text-muted)] hover:bg-[var(--gray-100)]",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[0.78rem] rounded-[6px]",
  md: "px-4 py-2 text-[0.875rem] rounded-[6px]",
  lg: "px-6 py-3 text-[0.95rem] rounded-[6px]",
};

export function Button({ type = "button", className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}
