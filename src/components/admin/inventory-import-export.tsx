"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { useInventoryStore } from "@/hooks/use-inventory-store";
import {
  exportMedicationsExcel,
  exportMedicationsPdf,
  parseInventoryFile,
} from "@/lib/inventory-io";
import { Medication } from "@/types/medication";

export function InventoryImportExport() {
  const { medications, dataAsOfLabel, importInventory } = useInventoryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMedications, setPendingMedications] = useState<Medication[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDownloadExcel = () => {
    exportMedicationsExcel(medications);
    toast.success("Excel inventory downloaded.");
  };

  const handleDownloadPdf = () => {
    exportMedicationsPdf(medications, dataAsOfLabel);
    toast.success("PDF inventory downloaded.");
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = await parseInventoryFile(file);
      setPendingFile(file);
      setPendingMedications(parsed);
      setConfirmOpen(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not read the uploaded file.";
      toast.error(message);
    }
  };

  const handleConfirmImport = async () => {
    if (pendingMedications.length === 0) {
      toast.error("No medications to import.");
      setConfirmOpen(false);
      setPendingFile(null);
      return;
    }

    await importInventory(pendingMedications);
    setConfirmOpen(false);
    setPendingFile(null);
    setPendingMedications([]);
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-medium">Inventory Files</h3>
          <p className="text-sm text-muted-foreground">
            Download the current stock list, edit it in Excel if needed, then upload it
            to replace inventory with the locations and quantities from your file.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
            Download Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
            Download PDF
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            Upload Inventory
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/json"
        className="hidden"
        onChange={handleFileSelected}
        aria-hidden="true"
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace inventory from file?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingFile ? (
                <>
                  Uploading <strong>{pendingFile.name}</strong> will replace the current
                  inventory with <strong>{pendingMedications.length}</strong> medications
                  from the file. Machine, drawer, row, and quantity values from the
                  spreadsheet will be applied automatically. The activity log will be
                  cleared.
                </>
              ) : (
                "This will replace the current inventory with the uploaded file."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingFile(null);
                setPendingMedications([]);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Import Inventory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
