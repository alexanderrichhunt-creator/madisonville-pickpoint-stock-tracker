"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInventoryStore } from "@/hooks/use-inventory-store";

interface SuggestionFormProps {
  onSubmitted?: () => void;
}

export function SuggestionForm({ onSubmitted }: SuggestionFormProps) {
  const { addSuggestion } = useInventoryStore();

  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [ndc, setNdc] = useState("");
  const [suggestedCount, setSuggestedCount] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [requestedBy, setRequestedBy] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !strength.trim()) {
      return;
    }

    await addSuggestion({
      name: name.trim(),
      strength: strength.trim(),
      ndc: ndc.trim() || undefined,
      suggestedCount: suggestedCount === "" ? undefined : suggestedCount,
      notes: notes.trim() || undefined,
      requestedBy: requestedBy.trim() || undefined,
    });

    // Reset form
    setName("");
    setStrength("");
    setNdc("");
    setSuggestedCount("");
    setNotes("");
    setRequestedBy("");
    onSubmitted?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sugg-name">Medication Name *</Label>
          <Input
            id="sugg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Atorvastatin Tablet"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sugg-strength">Strength / Dose *</Label>
          <Input
            id="sugg-strength"
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
            placeholder="e.g. 20 MG"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sugg-ndc">NDC (optional)</Label>
        <Input
          id="sugg-ndc"
          value={ndc}
          onChange={(e) => setNdc(e.target.value)}
          placeholder="e.g. 12345678901"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sugg-count">Suggested Quantity / Count (optional)</Label>
        <Input
          id="sugg-count"
          type="number"
          min={1}
          value={suggestedCount}
          onChange={(e) => {
            const val = e.target.value;
            setSuggestedCount(val === "" ? "" : parseInt(val, 10));
          }}
          placeholder="e.g. 10"
        />
        <p className="text-xs text-muted-foreground">
          How many units/packs do you recommend stocking?
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sugg-notes">Why is this needed? / Notes</Label>
        <textarea
          id="sugg-notes"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Frequently prescribed, patients often have to wait for it to be ordered"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sugg-by">Your name / Provider (optional)</Label>
        <Input
          id="sugg-by"
          value={requestedBy}
          onChange={(e) => setRequestedBy(e.target.value)}
          placeholder="Dr. Smith or Nursing"
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Submit Suggestion
      </Button>
    </form>
  );
}
