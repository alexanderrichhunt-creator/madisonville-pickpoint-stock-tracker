export interface MedicationSuggestion {
  id: string;
  name: string;
  strength: string;
  ndc?: string;
  suggestedCount?: number;   // Recommended quantity / pack count to stock
  notes?: string;
  requestedBy?: string;
  requestedAt: string;
}
