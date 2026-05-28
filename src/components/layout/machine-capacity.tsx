"use client";

import { Package, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventoryStore } from "@/hooks/use-inventory-store";

export function MachineCapacity() {
  const { totalSlots, occupiedSlots, availableSlots, isAdmin } = useInventoryStore();

  const usagePercent = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;
  const isLowCapacity = availableSlots <= 5;

  return (
    <Card className={isLowCapacity ? "border-orange-200 bg-orange-50/50" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5" aria-hidden="true" />
          PickPoint Machine Capacity
          {isAdmin && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              (editable in Admin mode)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{totalSlots}</div>
            <div className="text-xs text-muted-foreground">Total Slots</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{occupiedSlots}</div>
            <div className="text-xs text-muted-foreground">Occupied</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${isLowCapacity ? "text-orange-600" : "text-emerald-600"}`}>
              {availableSlots}
            </div>
            <div className="text-xs text-muted-foreground">Available</div>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-2 rounded-full transition-all ${isLowCapacity ? "bg-orange-500" : "bg-primary"}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {usagePercent}% full
        </div>

        {isLowCapacity && availableSlots > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-700">
            <TrendingDown className="h-3.5 w-3.5" />
            Only {availableSlots} slots remaining — consider adding capacity or reviewing stock.
          </div>
        )}
        {availableSlots === 0 && (
          <div className="mt-2 text-xs font-medium text-orange-700">
            Machine is at full capacity.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
