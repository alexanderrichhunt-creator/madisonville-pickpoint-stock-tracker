"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInventoryStore } from "@/hooks/use-inventory-store";

export function PinDialog() {
  const { toggleAdmin } = useInventoryStore();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (toggleAdmin(pin)) {
      setPin("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Enable admin mode">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Admin Mode
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enter Admin PIN</DialogTitle>
            <DialogDescription>
              Admin access is required to add, edit, delete, or import inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="admin-pin" className="sr-only">
              Admin PIN
            </Label>
            <Input
              id="admin-pin"
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
              aria-label="Admin PIN"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Unlock</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
