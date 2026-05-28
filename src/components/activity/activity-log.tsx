"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInventoryStore } from "@/hooks/use-inventory-store";
import { exportActivityCsv } from "@/lib/inventory-utils";
import { downloadFile, formatDateTime } from "@/lib/utils";

export function ActivityLog() {
  const { activity } = useInventoryStore();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return activity;
    return activity.filter(
      (entry) =>
        entry.drugName.toLowerCase().includes(q) ||
        entry.ndc.includes(q)
    );
  }, [activity, search]);

  const handleExportCsv = () => {
    const csv = exportActivityCsv(filtered);
    downloadFile(
      csv,
      `pickpoint-activity-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv"
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Label htmlFor="activity-search" className="sr-only">
            Search activity log
          </Label>
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="activity-search"
            placeholder="Search by drug name or NDC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Search activity log"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          aria-label="Export activity log as CSV"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Drug Name</TableHead>
                <TableHead>NDC</TableHead>
                <TableHead className="text-right">Qty Dispensed</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {activity.length === 0
                      ? "No dispense activity yet."
                      : "No matching activity entries."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(entry.timestamp)}
                    </TableCell>
                    <TableCell className="font-medium">{entry.drugName}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.ndc}</TableCell>
                    <TableCell className="text-right">{entry.qtyDispensed}</TableCell>
                    <TableCell className="text-right">{entry.remainingQty}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {activity.length} entries (most recent first)
      </p>
    </div>
  );
}
