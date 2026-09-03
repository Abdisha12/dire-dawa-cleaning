"use client";

export function MapLoadingState() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-muted rounded-lg">
      <div className="text-center space-y-2">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-muted-foreground">Loading map data…</p>
      </div>
    </div>
  );
}

export function MapErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-destructive/5 rounded-lg border border-destructive/20">
      <div className="text-center p-4">
        <p className="font-semibold text-destructive">Map error</p>
        <p className="text-sm text-muted-foreground mt-1">{message}</p>
      </div>
    </div>
  );
}

export function MapEmptyState() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-muted rounded-lg">
      <div className="text-center p-4">
        <p className="text-sm text-muted-foreground">No geographic data available for your scope.</p>
      </div>
    </div>
  );
}

export function MapListAlternative<T extends { id: number; name?: string; fullName?: string }>({
  items,
  onSelect,
  entityType,
}: {
  items: T[];
  onSelect: (item: T) => void;
  entityType: string;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground p-2">No {entityType}s found.</p>;
  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.name ?? item.fullName ?? `#${item.id}`}
        </button>
      ))}
    </div>
  );
}