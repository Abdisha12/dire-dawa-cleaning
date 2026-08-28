import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, id, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <select
          ref={ref}
          id={id}
          className={cn(
            "w-full rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm transition-colors focus:border-[var(--primary)] focus:outline-none disabled:opacity-50",
            error && "border-[var(--danger)]",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <span id={`${id}-error`} className="text-xs text-[var(--danger)]" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
