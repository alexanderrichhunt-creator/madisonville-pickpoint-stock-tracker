"use client";

import { useInventoryStore } from "@/hooks/use-inventory-store";

export function DegradedModeBanner() {
  const { isDegradedMode } = useInventoryStore();

  if (!isDegradedMode) return null;

  return (
    <div className="bg-yellow-500 text-black px-4 py-2 text-center text-sm font-medium">
      ⚠️ Running in <strong>degraded mode</strong> due to a Prisma configuration issue. 
      Changes may not save properly. A fix is in progress.
    </div>
  );
}
