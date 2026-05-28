"use client";

import {
  AlertTriangle,
  Package,
  Pill,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InventoryStats } from "@/lib/inventory-utils";

interface StatsCardsProps {
  stats: InventoryStats;
}

const cards = [
  {
    key: "totalItems" as const,
    label: "Total Items",
    icon: Package,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    key: "inStock" as const,
    label: "Items In Stock",
    icon: Pill,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    key: "lowStock" as const,
    label: "Low Stock Items",
    icon: AlertTriangle,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    key: "controlled" as const,
    label: "Controlled Substances",
    icon: ShieldAlert,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
];

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {cards.map(({ key, label, icon: Icon, color, bg }) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {label}
            </CardTitle>
            <div className={`rounded-md p-2 ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats[key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
