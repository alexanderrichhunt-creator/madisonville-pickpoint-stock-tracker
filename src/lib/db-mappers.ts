import { ActivityEntry } from "@/types/activity";
import { Medication } from "@/types/medication";
import { MedicationSuggestion } from "@/types/suggestion";

export function mapMedication(row: {
  id: string;
  ndc: string;
  name: string;
  strength: string;
  size: string;
  class: string;
  categories: string[];
  qty: number;
  lowQty: number;
  highQty: number;
  machine: number;
  drawer: string;
  row: number;
  cost: number;
}): Medication {
  return {
    id: row.id,
    ndc: row.ndc,
    name: row.name,
    strength: row.strength,
    size: row.size,
    class: row.class as Medication["class"],
    categories: row.categories,
    qty: row.qty,
    lowQty: row.lowQty,
    highQty: row.highQty,
    machine: row.machine,
    drawer: row.drawer,
    row: row.row,
    cost: row.cost,
  };
}

export function mapActivity(row: {
  id: string;
  timestamp: Date;
  medicationId: string;
  drugName: string;
  ndc: string | null;
  qtyDispensed: number;
  remainingQty: number;
}): ActivityEntry {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    medicationId: row.medicationId,
    drugName: row.drugName,
    ndc: row.ndc ?? "",
    qtyDispensed: row.qtyDispensed,
    remainingQty: row.remainingQty,
  };
}

export function mapSuggestion(row: {
  id: string;
  name: string;
  strength: string;
  ndc: string | null;
  suggestedCount: number | null;
  notes: string | null;
  requestedBy: string | null;
  requestedAt: Date;
}): MedicationSuggestion {
  return {
    id: row.id,
    name: row.name,
    strength: row.strength,
    ndc: row.ndc ?? undefined,
    suggestedCount: row.suggestedCount ?? undefined,
    notes: row.notes ?? undefined,
    requestedBy: row.requestedBy ?? undefined,
    requestedAt: row.requestedAt.toISOString(),
  };
}
