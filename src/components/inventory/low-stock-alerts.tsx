"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocation } from "@/lib/inventory-utils";
import { LowStockItem } from "@/lib/inventory-utils";

interface LowStockAlertsProps {
  items: LowStockItem[];
}

export function LowStockAlerts({ items }: LowStockAlertsProps) {
  if (items.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-orange-900">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          Low Stock Alerts ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded-md border border-orange-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.strength} · {formatLocation(item)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={item.qty === 0 ? "out" : "low"}>
                  {item.qty === 0 ? "Out" : `Low (${item.qty} left)`}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Suggested reorder: {item.suggestedReorder}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
