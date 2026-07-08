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
  const [pendingDataAsOf, setPendingDataAsOf] = useState<string | undefined>();
  const [pendingWarnings, setPendingWarnings] = useState<string[]>([]);
  const [pendingSource, setPendingSource] = useState<"csv" | "json" | "pdf" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const handleDownloadExcel = () => {
    exportMedicationsExcel(medications);
    toast.success("Excel file downloaded (opens in Excel).");
  };

  const handleDownloadPdf = () => {
    exportMedicationsPdf(medications, dataAsOfLabel);
    toast.success("Print dialog opened — choose Save as PDF.");
  };

  const resetPending = () => {
    setPendingFile(null);
    setPendingMedications([]);
    setPendingDataAsOf(undefined);
    setPendingWarnings([]);
    setPendingSource(null);
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsParsing(true);
    try {
      const parsed = await parseInventoryFile(file);
      setPendingFile(file);
      setPendingMedications(parsed.medications);
      setPendingDataAsOf(parsed.dataAsOf);
      setPendingWarnings(parsed.warnings ?? []);
      setPendingSource(parsed.source);
      setConfirmOpen(true);

      if (parsed.source === "pdf") {
        toast.success(
          `Parsed ${parsed.medications.length} medications from PDF with auto-assigned categories.`
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not read the uploaded file.";
      toast.error(message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (pendingMedications.length === 0) {
      toast.error("No medications to import.");
      setConfirmOpen(false);
      resetPending();
      return;
    }

    await importInventory(pendingMedications, { dataAsOf: pendingDataAsOf });
    setConfirmOpen(false);
    resetPending();
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-medium">Inventory Files</h3>
          <p className="text-sm text-muted-foreground">
            Upload a PickPoint inventory PDF to update medications automatically —
            categories and controlled-substance designations are assigned for you.
            You can also download Excel, edit quantities and locations, save as CSV,
            and upload that file.
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
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
          >
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {isParsing ? "Reading PDF..." : "Upload Inventory"}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.csv,.json,application/pdf,text/csv,application/json"
        className="hidden"
        onChange={handleFileSelected}
        aria-hidden="true"
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace inventory from file?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {pendingFile ? (
                  <>
                    <p>
                      Uploading <strong>{pendingFile.name}</strong> will replace the
                      current inventory with{" "}
                      <strong>{pendingMedications.length}</strong> medications from
                      the file.
                    </p>
                    {pendingSource === "pdf" && (
                      <p>
                        Categories and drug class designations were automatically
                        assigned from the medication names and NDC codes.
                        {pendingDataAsOf
                          ? ` Report date: ${pendingDataAsOf}.`
                          : ""}
                      </p>
                    )}
                    {pendingWarnings.length > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
                        <p className="font-medium">Parser notes</p>
                        <ul className="mt-1 list-disc pl-5">
                          {pendingWarnings.slice(0, 5).map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                        {pendingWarnings.length > 5 && (
                          <p className="mt-1">
                            …and {pendingWarnings.length - 5} more warnings.
                          </p>
                        )}
                      </div>
                    )}
                    <p>
                      Machine, drawer, row, and quantity values from the file will be
                      applied automatically. The activity log will be cleared.
                    </p>
                  </>
                ) : (
                  <p>
                    This will replace the current inventory with the uploaded file.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetPending}>Cancel</AlertDialogCancel>
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
