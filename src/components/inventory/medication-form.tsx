"use client";

import { Medication } from "@/types/medication";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DRAWER_OPTIONS, CONDITION_CATEGORIES } from "@/lib/inventory-utils";

export type MedicationFormData = Omit<Medication, "id">;

interface MedicationFormProps {
  data: MedicationFormData;
  onChange: (data: MedicationFormData) => void;
  idPrefix?: string;
}

export function MedicationForm({
  data,
  onChange,
  idPrefix = "med",
}: MedicationFormProps) {
  const update = (field: keyof MedicationFormData, value: string | number | string[]) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>Drug Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-ndc`}>NDC</Label>
        <Input
          id={`${idPrefix}-ndc`}
          value={data.ndc}
          onChange={(e) => update("ndc", e.target.value)}
          className="font-mono"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-strength`}>Strength</Label>
        <Input
          id={`${idPrefix}-strength`}
          value={data.strength}
          onChange={(e) => update("strength", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-size`}>Form/Size</Label>
        <Input
          id={`${idPrefix}-size`}
          value={data.size}
          onChange={(e) => update("size", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-class`}>Class</Label>
        <Select
          value={data.class}
          onValueChange={(value) =>
            update("class", value as Medication["class"])
          }
        >
          <SelectTrigger id={`${idPrefix}-class`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Uncontrolled">Uncontrolled</SelectItem>
            <SelectItem value="Schedule III-V">Schedule III-V</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label>Condition Categories (select all that apply)</Label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border p-3 text-sm sm:grid-cols-3">
          {CONDITION_CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.categories?.includes(cat) ?? false}
                onChange={(e) => {
                  const current = data.categories ?? [];
                  const next = e.target.checked
                    ? [...current, cat]
                    : current.filter((c) => c !== cat);
                  update("categories", next);
                }}
              />
              <span>{cat}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-qty`}>Current Qty</Label>
        <Input
          id={`${idPrefix}-qty`}
          type="number"
          min={0}
          value={data.qty}
          onChange={(e) => update("qty", parseInt(e.target.value, 10) || 0)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-highQty`}>High Qty (Par Level)</Label>
        <Input
          id={`${idPrefix}-highQty`}
          type="number"
          min={0}
          value={data.highQty}
          onChange={(e) => update("highQty", parseInt(e.target.value, 10) || 0)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-machine`}>Machine</Label>
        <Input
          id={`${idPrefix}-machine`}
          type="number"
          min={1}
          value={data.machine}
          onChange={(e) => update("machine", parseInt(e.target.value, 10) || 1)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-drawer`}>Drawer</Label>
        <Select
          value={data.drawer}
          onValueChange={(value) => update("drawer", value)}
        >
          <SelectTrigger id={`${idPrefix}-drawer`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DRAWER_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>
                Drawer {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-row`}>Row</Label>
        <Input
          id={`${idPrefix}-row`}
          type="number"
          min={1}
          value={data.row}
          onChange={(e) => update("row", parseInt(e.target.value, 10) || 1)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-cost`}>Cost</Label>
        <Input
          id={`${idPrefix}-cost`}
          type="number"
          min={0}
          step="0.01"
          value={data.cost}
          onChange={(e) => update("cost", parseFloat(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}

export const emptyMedicationForm = (): MedicationFormData => ({
  ndc: "",
  name: "",
  strength: "",
  size: "",
  class: "Uncontrolled",
  categories: ["Other"],
  qty: 0,
  lowQty: 2,   // Default for new items (global low stock rule is now qty <= 2)
  highQty: 10,
  machine: 1,
  drawer: "A",
  row: 1,
  cost: 0,
});
