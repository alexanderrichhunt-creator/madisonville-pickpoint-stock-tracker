export interface ActivityEntry {
  id: string;
  timestamp: string;
  medicationId: string;
  drugName: string;
  ndc: string;
  qtyDispensed: number;
  remainingQty: number;
}
