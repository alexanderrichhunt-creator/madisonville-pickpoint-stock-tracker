"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  MedicationForm,
  emptyMedicationForm,
  MedicationFormData,
} from "@/components/inventory/medication-form";
import { useInventoryStore } from "@/hooks/use-inventory-store";

export function AdminMenu() {
  const {
    addMedication,
    exportInventory,
    importInventory,
    resetToSeed,
    suggestionForAdding,
    clearSuggestionForAdding,
    deleteSuggestion,
  } = useInventoryStore();
  const [addOpen, setAddOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [formData, setFormData] = useState<MedicationFormData>(
    emptyMedicationForm()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // React to admin clicking "Add to Inventory" from a suggestion
  useEffect(() => {
    if (suggestionForAdding) {
      setFormData({
        ...emptyMedicationForm(),
        name: suggestionForAdding.name,
        strength: suggestionForAdding.strength,
        ndc: suggestionForAdding.ndc || "",
        qty: suggestionForAdding.suggestedCount ?? 0,
      });
      setAddOpen(true);
      // We intentionally do NOT clear here — handleAdd will clean up after successful add
    }
  }, [suggestionForAdding]);

  const handleAdd = () => {
    if (addMedication(formData)) {
      // If we added from a suggestion, auto-remove the suggestion
      if (suggestionForAdding) {
        deleteSuggestion(suggestionForAdding.id);
        clearSuggestionForAdding();
      }

      setFormData(emptyMedicationForm());
      setAddOpen(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        importInventory(data);
      } catch {
        importInventory(null);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm" aria-label="Admin actions menu">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            Admin Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add New Medication
          </DropdownMenuItem>

          <DropdownMenuItem onClick={exportInventory}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export Inventory
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            Import Inventory
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setResetOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reset to Original PDF Data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            // User closed the dialog (cancel or after add)
            clearSuggestionForAdding();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Medication</DialogTitle>
          </DialogHeader>
          <MedicationForm
            data={formData}
            onChange={setFormData}
            idPrefix="add"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add Medication</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImport}
        aria-hidden="true"
      />

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Original Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore all 69 medications from the April 29, 2026 PDF
              export and clear the activity log. All dispense history will be
              lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetToSeed();
                setResetOpen(false);
              }}
            >
              Reset Inventory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
