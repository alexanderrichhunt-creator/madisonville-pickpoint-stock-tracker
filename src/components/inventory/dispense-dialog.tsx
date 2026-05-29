"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatLocation } from "@/lib/inventory-utils";
import { Medication } from "@/types/medication";

interface DispenseDialogProps {
  medication: Medication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string, qty: number) => Promise<boolean> | boolean;
}

export function DispenseDialog({
  medication,
  open,
  onOpenChange,
  onConfirm,
}: DispenseDialogProps) {
  const [qty, setQty] = useState(1);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setQty(1);
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (!medication) return;
    const success = await onConfirm(medication.id, qty);
    if (success) {
      handleOpenChange(false);
    }
  };

  if (!medication) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dispense Medication</DialogTitle>
          <DialogDescription>
            Confirm dispense from PickPoint machine inventory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="font-semibold">{medication.name}</p>
            <p className="text-sm text-muted-foreground">
              {medication.strength} · {medication.size}
            </p>
            <p className="mt-1 font-mono text-sm">NDC {medication.ndc}</p>
            <p className="mt-2 text-sm">
              <span className="font-medium">Location:</span>{" "}
              {formatLocation(medication)}
            </p>
            <p className="mt-1 text-sm">
              <span className="font-medium">Current stock:</span>{" "}
              <Badge variant={medication.qty <= 2 ? "low" : "secondary"}>
                {medication.qty}
              </Badge>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dispense-qty">Quantity to dispense</Label>
            <Input
              id="dispense-qty"
              type="number"
              min={1}
              max={medication.qty}
              value={qty}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setQty(Math.min(Math.max(1, val), medication.qty));
                }
              }}
              aria-describedby="dispense-qty-help"
            />
            <p id="dispense-qty-help" className="text-xs text-muted-foreground">
              Maximum: {medication.qty}
            </p>
          </div>

          {medication.qty - qty <= 2 && (
            <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                After dispense, stock will be{" "}
                {medication.qty - qty === 0 ? "depleted" : "at or below the low stock threshold (2 or fewer)"}.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={medication.qty === 0}>
            Confirm Dispense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
