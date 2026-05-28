"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInventoryStore } from "@/hooks/use-inventory-store";
import { formatDateTime } from "@/lib/utils";

export function SuggestionsList() {
  const { suggestions, deleteSuggestion, isAdmin, startAddingFromSuggestion } = useInventoryStore();

  if (suggestions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No medication suggestions yet. Providers can submit requests using the form above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{suggestion.name}</span>
              <Badge variant="outline" className="text-xs">
                {suggestion.strength}
              </Badge>
            </div>

            {suggestion.ndc && (
              <div className="font-mono text-xs text-muted-foreground">
                NDC: {suggestion.ndc}
              </div>
            )}

            {suggestion.suggestedCount && (
              <div className="text-xs">
                <span className="text-muted-foreground">Suggested count:</span>{" "}
                <span className="font-medium">{suggestion.suggestedCount}</span>
              </div>
            )}

            {suggestion.notes && (
              <p className="text-sm text-muted-foreground">{suggestion.notes}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
              {suggestion.requestedBy && <span>Requested by: {suggestion.requestedBy}</span>}
              <span>Submitted: {formatDateTime(suggestion.requestedAt)}</span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-2 self-start sm:flex-row">
              <Button
                variant="default"
                size="sm"
                onClick={() => startAddingFromSuggestion(suggestion)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add to Inventory
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteSuggestion(suggestion.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Remove
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
