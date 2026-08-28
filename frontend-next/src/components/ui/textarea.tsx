import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          ref={ref}
          id={id}
          className={cn(
            "w-full rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm transition-colors focus:border-[var(--primary)] focus:outline-none",
            error && "border-[var(--danger)]",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        {error && (
          <span id={`${id}-error`} className="text-xs text-[var(--danger)]" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
