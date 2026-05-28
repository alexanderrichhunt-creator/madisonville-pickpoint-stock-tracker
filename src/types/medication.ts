export interface Medication {
  id: string;
  ndc: string;
  name: string;
  strength: string;
  size: string;
  class: "Uncontrolled" | "Schedule III-V";
  categories: string[];
  qty: number;
  lowQty: number;
  highQty: number;
  machine: number;
  drawer: string;
  row: number;
  cost: number;
}
