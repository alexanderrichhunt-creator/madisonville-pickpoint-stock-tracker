"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Medication } from "@/types/medication";
import { useInventoryStore } from "@/hooks/use-inventory-store";

interface DeleteDialogProps {
  medication: Medication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteDialog({
  medication,
  open,
  onOpenChange,
}: DeleteDialogProps) {
  const { deleteMedication } = useInventoryStore();

  const handleDelete = () => {
    if (medication) {
      deleteMedication(medication.id);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Medication?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove{" "}
            <strong>{medication?.name}</strong> (NDC {medication?.ndc}) from
            the inventory. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
