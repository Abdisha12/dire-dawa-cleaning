"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Kebele, SaferZone } from "@/types";

type KebeleContextValue = {
  kebeles: Kebele[];
  loading: boolean;
  error: string | null;
  // For Admin: null = All Kebeles, number = selected id
  // For Kebele Admin: always their assigned id (locked)
  // For Leader: derived from zone.kebele_id (read-only)
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  selectedKebele: Kebele | null;
  isLocked: boolean;
  // Zone context for Leader
  myZoneId: number | null;
  reload: () => void;
};

const Ctx = React.createContext<KebeleContextValue | null>(null);

export function KebeleProvider({ children }: { children: React.ReactNode }) {
  const user = typeof window !== "undefined" ? getUser() : null;
  const role = user?.role;
  const zone = user?.zone as (SaferZone & { kebele_id?: number }) | null | undefined;

  const [kebeles, setKebeles] = React.useState<Kebele[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getKebeles();
      setKebeles(res.kebeles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load kebeles");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Derive locked id for Kebele Admin / Leader
  const derivedLockedId = React.useMemo(() => {
    if (role === "collector") {
      // Kebele Admin: find kebele where collector_id == me
      const mine = kebeles.find((k) => k.collector_id === user?.id);
      return mine ? mine.id : null;
    }
    if (role === "leader" && zone?.kebele_id) {
      return zone.kebele_id;
    }
    return null;
  }, [role, kebeles, user?.id, zone?.kebele_id]);

  const isLocked = role === "collector" || role === "leader";

  // Enforce lock: if locked, selected is forced to derived
  const effectiveSelectedId = isLocked ? derivedLockedId : selectedId;
  const selectedKebele = effectiveSelectedId ? kebeles.find((k) => k.id === effectiveSelectedId) || null : null;

  const myZoneId = zone?.id ?? null;

  // Initialize admin to “All” (null) — keep if user switches
  const setSelectedIdSafe = React.useCallback(
    (id: number | null) => {
      if (isLocked) return; // UX foundation: do not allow switch
      setSelectedId(id);
    },
    [isLocked]
  );

  const value: KebeleContextValue = {
    kebeles,
    loading,
    error,
    selectedId: effectiveSelectedId,
    setSelectedId: setSelectedIdSafe,
    selectedKebele,
    isLocked,
    myZoneId,
    reload: load,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKebele(): KebeleContextValue {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useKebele must be inside KebeleProvider");
  return v;
}
