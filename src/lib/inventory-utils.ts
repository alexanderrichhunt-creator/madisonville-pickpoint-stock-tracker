import { ActivityEntry } from "@/types/activity";
import { Medication } from "@/types/medication";

export type StockStatus = "in-stock" | "low" | "out";

export type SortColumn =
  | "ndc"
  | "name"
  | "strength"
  | "size"
  | "class"
  | "category"
  | "qty"
  | "drawer";

export type SortDirection = "asc" | "desc";

export interface FilterOptions {
  search: string;
  classFilter: "all" | "Uncontrolled" | "Schedule III-V";
  stockFilter: "all" | "in-stock" | "low" | "out";
  drawerFilter: string;
  categoryFilter: "all" | string;
}

export interface InventoryStats {
  totalItems: number;
  inStock: number;
  lowStock: number;
  controlled: number;
}

export interface LowStockItem extends Medication {
  suggestedReorder: number;
}

export function getStockStatus(med: Medication): StockStatus {
  if (med.qty === 0) return "out";
  if (med.qty <= 2) return "low"; // Hard threshold: only show as low stock if 2 or fewer remain
  return "in-stock";
}

export function filterMedications(
  meds: Medication[],
  options: FilterOptions
): Medication[] {
  const search = options.search.toLowerCase().trim();

  return meds.filter((med) => {
    if (options.classFilter !== "all" && med.class !== options.classFilter) {
      return false;
    }

    if (options.drawerFilter !== "all" && med.drawer !== options.drawerFilter) {
      return false;
    }

    if (options.categoryFilter !== "all" && !med.categories?.includes(options.categoryFilter)) {
      return false;
    }

    const status = getStockStatus(med);
    if (options.stockFilter !== "all" && status !== options.stockFilter) {
      return false;
    }

    if (search) {
      const haystack = `${med.name} ${med.ndc} ${med.strength} ${med.categories?.join(" ") || ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

export function sortMedications(
  meds: Medication[],
  column: SortColumn,
  direction: SortDirection
): Medication[] {
  const sorted = [...meds].sort((a, b) => {
    let comparison = 0;

    switch (column) {
      case "ndc":
        comparison = a.ndc.localeCompare(b.ndc);
        break;
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "strength":
        comparison = a.strength.localeCompare(b.strength);
        break;
      case "size":
        comparison = a.size.localeCompare(b.size);
        break;
      case "class":
        comparison = a.class.localeCompare(b.class);
        break;
      case "category":
        comparison = (a.categories?.[0] || "").localeCompare(b.categories?.[0] || "");
        break;
      case "qty":
        comparison = a.qty - b.qty;
        break;
      case "drawer":
        comparison =
          a.drawer.localeCompare(b.drawer) ||
          a.row - b.row ||
          a.machine - b.machine;
        break;
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

export function computeStats(meds: Medication[]): InventoryStats {
  return {
    totalItems: meds.length,
    inStock: meds.filter((m) => getStockStatus(m) === "in-stock").length,
    lowStock: meds.filter((m) => {
      const s = getStockStatus(m);
      return s === "low" || s === "out";
    }).length,
    controlled: meds.filter((m) => m.class === "Schedule III-V").length,
  };
}

export function getLowStockItems(meds: Medication[]): LowStockItem[] {
  return meds
    .filter((m) => getStockStatus(m) !== "in-stock")
    .map((m) => ({
      ...m,
      suggestedReorder: 10, // Fixed suggestion when low (qty <= 2)
    }))
    .sort((a, b) => a.qty - b.qty);
}

export function formatRxText(med: Medication): string {
  return `Prescribe exactly: ${med.name} ${med.strength} ${med.size} (NDC ${med.ndc}) – Dispense from PickPoint Machine ${med.machine}, Drawer ${med.drawer} Row ${med.row}`;
}

export function formatLocation(med: Medication): string {
  return `Machine ${med.machine} / Drawer ${med.drawer} / Row ${med.row}`;
}

export function exportActivityCsv(activity: ActivityEntry[]): string {
  const headers = [
    "Timestamp",
    "Drug Name",
    "NDC",
    "Qty Dispensed",
    "Remaining Qty",
  ];
  const rows = activity.map((entry) => [
    entry.timestamp,
    `"${entry.drugName.replace(/"/g, '""')}"`,
    entry.ndc,
    entry.qtyDispensed.toString(),
    entry.remainingQty.toString(),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function generateMedicationId(
  ndc: string,
  machine: number,
  drawer: string,
  row: number
): string {
  return `${ndc}-${machine}${drawer}${row}`;
}

export function isValidMedication(data: unknown): data is Medication {
  if (!data || typeof data !== "object") return false;
  const med = data as Record<string, unknown>;
  return (
    typeof med.id === "string" &&
    typeof med.ndc === "string" &&
    typeof med.name === "string" &&
    typeof med.strength === "string" &&
    typeof med.size === "string" &&
    (med.class === "Uncontrolled" || med.class === "Schedule III-V") &&
    Array.isArray(med.categories) &&
    typeof med.qty === "number" &&
    typeof med.lowQty === "number" &&
    typeof med.highQty === "number" &&
    typeof med.machine === "number" &&
    typeof med.drawer === "string" &&
    typeof med.row === "number" &&
    typeof med.cost === "number"
  );
}

export const DRAWER_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export const CONDITION_CATEGORIES = [
  "Respiratory (Asthma/COPD)",
  "Acute Infection",
  "Diabetes & Endocrine",
  "Psych / Mental Health",
  "Hypertension & Cardiovascular",
  "GI (Laxatives & Acid)",
  "Pain & Inflammation",
  "Allergy",
  "Dermatology & Topical",
  "Other",
] as const;
