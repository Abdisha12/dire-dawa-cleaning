import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={ref}
          className={cn(
            "w-full rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm transition-colors focus:border-[var(--primary)] focus:outline-none",
            error && "border-[var(--danger)]",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${props.id}-error` : undefined}
          {...props}
        />
        {error && (
          <span id={`${props.id}-error`} className="text-xs text-[var(--danger)]">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-[0.8rem] font-semibold text-[var(--gray-700)]", className)}
      {...props}
    />
  );
}
