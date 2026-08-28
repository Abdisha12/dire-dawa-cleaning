"use client";

import * as React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "./icon";

type Toast = { id: number; message: string; variant: "success" | "error" | "info" };

const Ctx = createContext<{ toast: (msg: string, variant?: Toast["variant"]) => void } | null>(null);

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast outside ToasterProvider");
  return v;
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, variant: Toast["variant"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[var(--z-toast)] flex max-w-[340px] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-[var(--shadow-md)]",
              t.variant === "success" && "bg-[var(--success)] text-white",
              t.variant === "error" && "bg-[var(--danger)] text-white",
              t.variant === "info" && "bg-[var(--primary)] text-white"
            )}
          >
            <span aria-hidden>{t.variant === "success" ? "✅" : t.variant === "error" ? "❌" : "ℹ️"}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
