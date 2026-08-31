"use client";

import * as React from "react";

export function NetworkStatus() {
  const [online, setOnline] = React.useState<boolean>(() => typeof navigator !== "undefined" ? navigator.onLine : true);

  React.useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="sticky top-0 z-50 bg-[var(--warning)] px-4 py-2 text-center text-sm text-white">
      ⚠ You are offline. Changes will sync when reconnected.
    </div>
  );
}