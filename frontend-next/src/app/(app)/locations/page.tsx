export default function LocationsPlaceholder() {
  return (
    <div className="rounded-lg bg-[var(--surface)] p-8 text-center shadow-[var(--shadow)]">
      <h2 className="text-lg font-semibold">Locations — 9 Kebeles / 108 Zones</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Kebeles (K01–K09) and Safer Zones with future PostGIS boundaries. Migrated next phase.</p>
    </div>
  );
}
