"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
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
import { parseInventoryFile } from "@/lib/inventory-io";

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

  const handleAdd = async () => {
    const success = await addMedication(formData);
    if (success) {
      // If we added from a suggestion, auto-remove the suggestion
      if (suggestionForAdding) {
        await deleteSuggestion(suggestionForAdding.id);
        clearSuggestionForAdding();
      }

      setFormData(emptyMedicationForm());
      setAddOpen(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const parsed = await parseInventoryFile(file);
      await importInventory(parsed.medications, { dataAsOf: parsed.dataAsOf });
      if (parsed.source === "pdf") {
        toast.success(
          `Imported ${parsed.medications.length} medications from PDF with auto-assigned categories.`
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not import inventory file.";
      toast.error(message);
    }
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
            Export JSON Backup
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            Import from File
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setResetOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reset to Original PDF Data
          </DropdownMenuItem>

          {/* Auto-initialize runs on first load when DB is empty. Manual trigger removed to avoid confusion. */}
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
        accept=".pdf,.csv,.json,application/pdf,text/csv,application/json"
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
              onClick={async () => {
                await resetToSeed();
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
