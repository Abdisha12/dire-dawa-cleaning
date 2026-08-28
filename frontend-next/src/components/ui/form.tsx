"use client";

import * as React from "react";
import { useForm, type FieldValues, type UseFormProps, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { cn } from "@/lib/utils";

type FormProps<T extends FieldValues> = {
  schema: z.ZodType<T>;
  defaultValues?: UseFormProps<T>["defaultValues"];
  onSubmit: (values: T) => Promise<void> | void;
  children: (methods: UseFormReturn<T> & { serverError: string | null; isSubmitting: boolean }) => React.ReactNode;
  // server error mapping: { field: message, _form: message }
  serverErrors?: Record<string, string> | null;
};

// Generic form foundation: RHF + Zod, handles field/server errors, loading/disabled, a11y
export function Form<T extends FieldValues>({ schema, defaultValues, onSubmit, children, serverErrors }: FormProps<T>) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const methods = useForm<T>({
    resolver: zodResolver(schema as unknown as Parameters<typeof zodResolver>[0]),
    defaultValues,
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (!serverErrors) return;
    for (const [key, msg] of Object.entries(serverErrors)) {
      if (key === "_form") setServerError(msg);
      else methods.setError(key as never, { type: "server", message: msg });
    }
  }, [serverErrors, methods]);

  const submit = methods.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSubmit(values as T);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      setServerError(msg);
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      {children({ ...methods, serverError, isSubmitting: methods.formState.isSubmitting })}
      {serverError && (
        <div role="alert" className="mt-3 rounded border border-[#fecaca] bg-[var(--danger-l)] px-3 py-2 text-sm text-[var(--danger)]">
          {serverError}
        </div>
      )}
    </form>
  );
}

// Helper field wrapper: label + input + error (accessible)
export function Field({
  label,
  id,
  error,
  children,
  required,
}: {
  label: string;
  id: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-[var(--gray-700)]">
        {label} {required && <span className="text-[var(--danger)]" aria-hidden>*</span>}
      </label>
      {children}
      {error && (
        <span id={`${id}-error`} className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
