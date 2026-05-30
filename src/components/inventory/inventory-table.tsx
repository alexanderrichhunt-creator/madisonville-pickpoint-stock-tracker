"use client";

import { type ReactNode, useState } from "react";
import { ArrowUpDown, Copy, Pencil, Pill, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DispenseDialog } from "@/components/inventory/dispense-dialog";
import { EditDialog } from "@/components/admin/edit-dialog";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { useInventoryStore } from "@/hooks/use-inventory-store";
import {
  formatLocation,
  formatRxText,
  getStockStatus,
  SortColumn,
  SortDirection,
} from "@/lib/inventory-utils";
import { Medication } from "@/types/medication";

interface InventoryTableProps {
  medications: Medication[];
}

export function InventoryTable({ medications }: InventoryTableProps) {
  const { dispense, isAuthenticatedAdmin } = useInventoryStore();
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [dispenseMed, setDispenseMed] = useState<Medication | null>(null);
  const [editMed, setEditMed] = useState<Medication | null>(null);
  const [deleteMed, setDeleteMed] = useState<Medication | null>(null);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sorted = [...medications].sort((a, b) => {
    let cmp = 0;
    switch (sortColumn) {
      case "ndc":
        cmp = a.ndc.localeCompare(b.ndc);
        break;
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "strength":
        cmp = a.strength.localeCompare(b.strength);
        break;
      case "size":
        cmp = a.size.localeCompare(b.size);
        break;
      case "class":
        cmp = a.class.localeCompare(b.class);
        break;
      case "category":
        cmp = (a.categories?.[0] || "").localeCompare(b.categories?.[0] || "");
        break;
      case "qty":
        cmp = a.qty - b.qty;
        break;
      case "drawer":
        cmp =
          a.drawer.localeCompare(b.drawer) || a.row - b.row || a.machine - b.machine;
        break;
    }
    return sortDirection === "asc" ? cmp : -cmp;
  });

  const copyRx = async (med: Medication) => {
    try {
      await navigator.clipboard.writeText(formatRxText(med));
      toast.success("Rx text copied to clipboard.");
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const SortButton = ({
    column,
    children,
  }: {
    column: SortColumn;
    children: ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 gap-1 font-medium"
      onClick={() => handleSort(column)}
      aria-label={`Sort by ${column}`}
    >
      {children}
      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  );

  return (
    <>
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">
                  <SortButton column="name">Drug Name</SortButton>
                </TableHead>
                <TableHead className="min-w-[100px]">
                  <SortButton column="strength">Strength</SortButton>
                </TableHead>
                <TableHead className="min-w-[80px]">
                  <SortButton column="size">Count</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="class">Class</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="category">Category</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="qty">Current Qty</SortButton>
                </TableHead>
                <TableHead className="min-w-[160px]">
                  <SortButton column="drawer">Location</SortButton>
                </TableHead>
                <TableHead className="sticky right-0 z-10 min-w-[320px] bg-card text-right shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No medications match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((med) => {
                  const status = getStockStatus(med);
                  return (
                    <TableRow key={med.id}>
                      <TableCell className="max-w-[260px] whitespace-normal break-words font-medium leading-tight" title={med.name}>
                        {med.name}
                      </TableCell>
                      <TableCell className="text-sm">{med.strength}</TableCell>
                      <TableCell className="text-sm">{med.size}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            med.class === "Schedule III-V"
                              ? "controlled"
                              : "uncontrolled"
                          }
                        >
                          {med.class}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {(med.categories ?? []).length > 0 ? (
                            med.categories.map((cat, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                                {cat}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{med.qty}</span>
                          {status === "low" && (
                            <Badge variant="low">Low</Badge>
                          )}
                          {status === "out" && (
                            <Badge variant="out">Out</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatLocation(med)}
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 whitespace-nowrap bg-card p-2 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center justify-end gap-1 flex-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 px-2"
                            onClick={() => copyRx(med)}
                            aria-label={`Copy Rx text for ${med.name}`}
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="ml-1 hidden lg:inline">Copy</span>
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 shrink-0 px-2.5"
                            onClick={() => setDispenseMed(med)}
                            disabled={med.qty === 0}
                            aria-label={`Dispense ${med.name}`}
                          >
                            <Pill className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="ml-1">Dispense</span>
                          </Button>
                          {isAuthenticatedAdmin && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0 px-2.5"
                                onClick={() => setEditMed(med)}
                                aria-label={`Edit ${med.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="ml-1">Edit</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0 px-2.5 text-destructive hover:text-destructive"
                                onClick={() => setDeleteMed(med)}
                                aria-label={`Delete ${med.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="ml-1">Delete</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DispenseDialog
        medication={dispenseMed}
        open={!!dispenseMed}
        onOpenChange={(open) => !open && setDispenseMed(null)}
        onConfirm={dispense}
      />

      <EditDialog
        medication={editMed}
        open={!!editMed}
        onOpenChange={(open) => !open && setEditMed(null)}
      />

      <DeleteDialog
        medication={deleteMed}
        open={!!deleteMed}
        onOpenChange={(open) => !open && setDeleteMed(null)}
      />
    </>
  );
}
