"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { SEED_MEDICATIONS, SEED_METADATA } from "@/data/seed-data";
import { generateMedicationId, isValidMedication } from "@/lib/inventory-utils";
import { ADMIN_PIN, STORAGE_KEYS } from "@/lib/utils";
import { ActivityEntry } from "@/types/activity";
import { Medication } from "@/types/medication";
import { MedicationSuggestion } from "@/types/suggestion";

interface InventoryContextValue {
  medications: Medication[];
  activity: ActivityEntry[];
  lastUpdated: string;
  dataAsOfLabel: string;
  isAdmin: boolean;
  isHydrated: boolean;

  // Machine capacity
  totalSlots: number;
  occupiedSlots: number;
  availableSlots: number;
  updateTotalSlots: (newTotal: number) => void;

  // Provider medication suggestions
  suggestions: MedicationSuggestion[];
  addSuggestion: (suggestion: Omit<MedicationSuggestion, "id" | "requestedAt">) => void;
  deleteSuggestion: (id: string) => void;

  // Conversion from suggestion to actual inventory (admin only)
  suggestionForAdding: MedicationSuggestion | null;
  startAddingFromSuggestion: (suggestion: MedicationSuggestion) => void;
  clearSuggestionForAdding: () => void;

  dispense: (id: string, qty: number) => boolean;
  addMedication: (med: Omit<Medication, "id">) => boolean;
  updateMedication: (med: Medication) => void;
  deleteMedication: (id: string) => void;
  importInventory: (data: unknown) => boolean;
  exportInventory: () => void;
  resetToSeed: () => void;
  toggleAdmin: (pin: string) => boolean;
  logoutAdmin: () => void;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [medications, setMedications] = useState<Medication[]>(SEED_MEDICATIONS);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState(SEED_METADATA.dataAsOf);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Machine capacity (total physical slots in the PickPoint machine)
  const [totalSlots, setTotalSlots] = useState(90); // Default total physical slots in the PickPoint machine

  // Provider suggestions / requests for new medications
  const [suggestions, setSuggestions] = useState<MedicationSuggestion[]>([]);

  // For converting a suggestion into a real medication (admin flow)
  const [suggestionForAdding, setSuggestionForAdding] = useState<MedicationSuggestion | null>(null);

  useEffect(() => {
    try {
      let loadedMeds = loadFromStorage(STORAGE_KEYS.medications, SEED_MEDICATIONS);

      // Robustness: If the saved data doesn't have the current schema (e.g. old "category" string
      // instead of "categories" array), fall back to the fresh categorized seed data.
      const hasValidSchema =
        Array.isArray(loadedMeds) &&
        loadedMeds.length > 0 &&
        Array.isArray(loadedMeds[0]?.categories);

      if (!hasValidSchema) {
        // Clear the bad data so we don't keep trying to use it
        localStorage.removeItem(STORAGE_KEYS.medications);
        loadedMeds = SEED_MEDICATIONS;
      }

      setMedications(loadedMeds);
      setActivity(loadFromStorage(STORAGE_KEYS.activity, []));
      setLastUpdated(
        loadFromStorage(STORAGE_KEYS.lastUpdated, SEED_METADATA.dataAsOf)
      );
      setTotalSlots(loadFromStorage(STORAGE_KEYS.totalSlots, 90));
      setSuggestions(loadFromStorage(STORAGE_KEYS.suggestions, []));
    } catch (err) {
      // If anything goes wrong during load, start fresh with the seed data
      console.error("Failed to hydrate inventory data:", err);
      localStorage.removeItem(STORAGE_KEYS.medications);
      setMedications(SEED_MEDICATIONS);
      setActivity([]);
      setLastUpdated(SEED_METADATA.dataAsOf);
      setTotalSlots(90);
      setSuggestions([]);
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    saveToStorage(STORAGE_KEYS.medications, medications);
  }, [medications, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveToStorage(STORAGE_KEYS.activity, activity);
  }, [activity, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveToStorage(STORAGE_KEYS.lastUpdated, lastUpdated);
  }, [lastUpdated, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveToStorage(STORAGE_KEYS.totalSlots, totalSlots);
  }, [totalSlots, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveToStorage(STORAGE_KEYS.suggestions, suggestions);
  }, [suggestions, isHydrated]);

  const updateTimestamp = useCallback(() => {
    setLastUpdated(new Date().toISOString());
  }, []);

  const dispense = useCallback(
    (id: string, qty: number): boolean => {
      if (!isAdmin) {
        toast.error("Dispensing is restricted to Admin users only.");
        return false;
      }
      const med = medications.find((m) => m.id === id);
      if (!med || qty <= 0 || qty > med.qty) return false;

      const remainingQty = med.qty - qty;
      setMedications((prev) =>
        prev.map((m) => (m.id === id ? { ...m, qty: remainingQty } : m))
      );

      const entry: ActivityEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        medicationId: id,
        drugName: med.name,
        ndc: med.ndc,
        qtyDispensed: qty,
        remainingQty,
      };

      setActivity((prev) => [entry, ...prev]);
      updateTimestamp();

      toast.success(
        `Dispensed ${qty}× ${med.name}. ${remainingQty} remaining.`
      );
      return true;
    },
    [medications, updateTimestamp]
  );

  const addMedication = useCallback(
    (med: Omit<Medication, "id">): boolean => {
      const id = generateMedicationId(
        med.ndc,
        med.machine,
        med.drawer,
        med.row
      );
      if (medications.some((m) => m.id === id)) {
        toast.error("A medication with this NDC and location already exists.");
        return false;
      }
      setMedications((prev) => [...prev, { ...med, id }]);
      updateTimestamp();
      toast.success("Medication added.");
      return true;
    },
    [medications, updateTimestamp]
  );

  const updateMedication = useCallback(
    (med: Medication) => {
      setMedications((prev) => prev.map((m) => (m.id === med.id ? med : m)));
      updateTimestamp();
      toast.success("Medication updated.");
    },
    [updateTimestamp]
  );

  const deleteMedication = useCallback(
    (id: string) => {
      setMedications((prev) => prev.filter((m) => m.id !== id));
      updateTimestamp();
      toast.success("Medication deleted.");
    },
    [updateTimestamp]
  );

  const importInventory = useCallback(
    (data: unknown): boolean => {
      if (!Array.isArray(data)) {
        toast.error("Invalid inventory file format.");
        return false;
      }
      if (!data.every(isValidMedication)) {
        toast.error("Inventory file contains invalid medication records.");
        return false;
      }
      setMedications(data);
      updateTimestamp();
      toast.success(`Imported ${data.length} medications.`);
      return true;
    },
    [updateTimestamp]
  );

  const exportInventory = useCallback(() => {
    const blob = new Blob([JSON.stringify(medications, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pickpoint-inventory-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Inventory exported.");
  }, [medications]);

  const resetToSeed = useCallback(() => {
    setMedications(SEED_MEDICATIONS);
    setActivity([]);
    setLastUpdated(SEED_METADATA.dataAsOf);
    toast.success("Inventory reset to original PDF data.");
  }, []);

  const toggleAdmin = useCallback((pin: string): boolean => {
    if (pin === ADMIN_PIN) {
      setIsAdmin(true);
      toast.success("Admin mode enabled.");
      return true;
    }
    toast.error("Incorrect PIN.");
    return false;
  }, []);

  const logoutAdmin = useCallback(() => {
    setIsAdmin(false);
    toast.info("Admin mode disabled.");
  }, []);

  // Derived slot counts
  const occupiedSlots = medications.length;
  const availableSlots = Math.max(0, totalSlots - occupiedSlots);

  const updateTotalSlots = useCallback((newTotal: number) => {
    if (newTotal < occupiedSlots) {
      toast.error(`Total slots cannot be lower than currently occupied slots (${occupiedSlots}).`);
      return;
    }
    setTotalSlots(newTotal);
    toast.success(`Machine capacity updated to ${newTotal} slots.`);
  }, [occupiedSlots]);

  // Suggestion methods
  const addSuggestion = useCallback(
    (suggestion: Omit<MedicationSuggestion, "id" | "requestedAt">) => {
      const newSuggestion: MedicationSuggestion = {
        ...suggestion,
        id: crypto.randomUUID(),
        requestedAt: new Date().toISOString(),
      };
      setSuggestions((prev) => [newSuggestion, ...prev]);
      toast.success("Suggestion submitted. Thank you!");
    },
    []
  );

  const deleteSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    toast.success("Suggestion removed.");
  }, []);

  const startAddingFromSuggestion = useCallback((suggestion: MedicationSuggestion) => {
    setSuggestionForAdding(suggestion);
    // Note: The actual dialog opening + prefill happens in AdminMenu
    // because that's where the add dialog state lives.
  }, []);

  const clearSuggestionForAdding = useCallback(() => {
    setSuggestionForAdding(null);
  }, []);

  const dataAsOfLabel = useMemo(() => {
    if (lastUpdated === SEED_METADATA.dataAsOf) return SEED_METADATA.dataAsOf;
    try {
      return new Date(lastUpdated).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return lastUpdated;
    }
  }, [lastUpdated]);

  const value = useMemo(
    () => ({
      medications,
      activity,
      lastUpdated,
      dataAsOfLabel,
      isAdmin,
      isHydrated,

      totalSlots,
      occupiedSlots,
      availableSlots,
      updateTotalSlots,

      suggestions,
      addSuggestion,
      deleteSuggestion,

      suggestionForAdding,
      startAddingFromSuggestion,
      clearSuggestionForAdding,

      dispense,
      addMedication,
      updateMedication,
      deleteMedication,
      importInventory,
      exportInventory,
      resetToSeed,
      toggleAdmin,
      logoutAdmin,
    }),
    [
      medications,
      activity,
      lastUpdated,
      dataAsOfLabel,
      isAdmin,
      isHydrated,
      totalSlots,
      occupiedSlots,
      availableSlots,
      suggestions,
      suggestionForAdding,
      dispense,
      addMedication,
      updateMedication,
      deleteMedication,
      importInventory,
      exportInventory,
      resetToSeed,
      toggleAdmin,
      logoutAdmin,
    ]
  );

  return (
    <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
  );
}

export function useInventoryStore() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error("useInventoryStore must be used within InventoryProvider");
  }
  return context;
}
