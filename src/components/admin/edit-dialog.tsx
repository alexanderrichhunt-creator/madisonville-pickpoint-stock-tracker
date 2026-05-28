"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MedicationForm,
  MedicationFormData,
} from "@/components/inventory/medication-form";
import { useInventoryStore } from "@/hooks/use-inventory-store";
import { Medication } from "@/types/medication";

interface EditDialogProps {
  medication: Medication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDialog({
  medication,
  open,
  onOpenChange,
}: EditDialogProps) {
  const { updateMedication } = useInventoryStore();
  const [formData, setFormData] = useState<MedicationFormData | null>(null);

  useEffect(() => {
    if (medication) {
      const { id: _, ...rest } = medication;
      setFormData(rest);
    }
  }, [medication]);

  const handleSave = () => {
    if (!medication || !formData) return;
    updateMedication({ ...formData, id: medication.id });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Medication</DialogTitle>
        </DialogHeader>
        {formData && (
          <MedicationForm
            data={formData}
            onChange={setFormData}
            idPrefix="edit"
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
