"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { SharedSyncBanner } from "@/components/layout/shared-sync-banner";
import { Footer } from "@/components/layout/footer";
import { StatsCards } from "@/components/inventory/stats-cards";
import { SearchFilters } from "@/components/inventory/search-filters";
import { LowStockAlerts } from "@/components/inventory/low-stock-alerts";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { ActivityLog } from "@/components/activity/activity-log";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventoryStore } from "@/hooks/use-inventory-store";
import { MachineCapacity } from "@/components/layout/machine-capacity";
import { SuggestionForm } from "@/components/suggestions/suggestion-form";
import { SuggestionsList } from "@/components/suggestions/suggestions-list";
import {
  computeStats,
  filterMedications,
  getLowStockItems,
  FilterOptions,
} from "@/lib/inventory-utils";

const defaultFilters: FilterOptions = {
  search: "",
  classFilter: "all",
  stockFilter: "all",
  drawerFilter: "all",
  categoryFilter: "all",
};

export default function HomePage() {
  const { medications, isHydrated, needsDatabaseSeeding, isAuthenticatedAdmin } = useInventoryStore();
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);

  const filteredMeds = useMemo(
    () => filterMedications(medications, filters),
    [medications, filters]
  );

  const stats = useMemo(() => computeStats(medications), [medications]);
  const lowStockItems = useMemo(
    () => getLowStockItems(medications),
    [medications]
  );

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <SharedSyncBanner />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-6">
            {needsDatabaseSeeding && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="font-medium text-yellow-800">
                  Database is empty.
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Auto-initialization is running. If this persists, an administrator can use the Reset action after logging in.
                </p>
              </div>
            )}
            <StatsCards stats={stats} />
            <MachineCapacity />
            <SearchFilters filters={filters} onChange={setFilters} />
            <LowStockAlerts items={lowStockItems} />
            <InventoryTable medications={filteredMeds} />
            <p className="text-sm text-muted-foreground">
              Showing {filteredMeds.length} of {medications.length} medications
            </p>
          </TabsContent>

          <TabsContent value="activity">
            <ActivityLog />
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Medication Suggestions</h2>
              <p className="text-muted-foreground">
                Providers can request medications they would like added to the PickPoint machine.
                Suggestions are visible to the team and can be actioned by admins.
              </p>
            </div>

            <SuggestionForm />

            <div className="pt-4">
              <h3 className="mb-3 font-medium">Current Requests</h3>
              <SuggestionsList />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
