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
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
// ADMIN_PIN and STORAGE_KEYS kept only for reference / migration comments (no longer used)
import {
  getMedications,
  getActivityLog,
  getSuggestions,
  getAppSettings,
  addMedication as serverAddMedication,
  updateMedication as serverUpdateMedication,
  deleteMedication as serverDeleteMedication,
  dispense as serverDispense,
  updateTotalSlots as serverUpdateTotalSlots,
  addSuggestion as serverAddSuggestion,
  deleteSuggestion as serverDeleteSuggestion,
  importInventory as serverImportInventory,
  resetToSeed as serverResetToSeed,
  seedDatabaseIfEmpty as serverSeedDatabaseIfEmpty,
  ensureAdminUser as serverEnsureAdminUser,
} from "@/lib/actions";
import { ActivityEntry } from "@/types/activity";
import { Medication } from "@/types/medication";
import { MedicationSuggestion } from "@/types/suggestion";
import { isDegradedMode as prismaIsDegradedMode } from "@/lib/prisma";

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

  dispense: (id: string, qty: number) => Promise<boolean>;
  addMedication: (med: Omit<Medication, "id">) => Promise<boolean>;
  updateMedication: (med: Medication) => void;
  deleteMedication: (id: string) => void;
  importInventory: (data: unknown) => Promise<boolean>;
  exportInventory: () => void;
  resetToSeed: () => Promise<boolean>;
  seedDatabaseIfEmpty: () => Promise<boolean>;
  needsDatabaseSeeding: boolean;

  // Real Auth.js based admin (replaces old PIN system)
  isAuthenticatedAdmin: boolean;
  currentUser: { name?: string | null; email?: string | null } | null;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Degraded mode (when Prisma client has the wrong engine type)
  isDegradedMode: boolean;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

// Local storage helpers are no longer used for main data (now in database)
// Keeping the functions in case we need them for small client-only preferences later.

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();

  const [medications, setMedications] = useState<Medication[]>(SEED_MEDICATIONS);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState(SEED_METADATA.dataAsOf);
  const [isHydrated, setIsHydrated] = useState(false);

  // Real admin state comes from Auth.js session (isAdmin flag on the JWT + User)
  const isAdmin = !!session?.user?.isAdmin;
  const currentUser = useMemo(
    () =>
      session?.user
        ? { name: session.user.name, email: session.user.email }
        : null,
    [session]
  );
  const isAuthenticatedAdmin = isAdmin;

  // Machine capacity (total physical slots in the PickPoint machine)
  const [totalSlots, setTotalSlots] = useState(90); // Default total physical slots in the PickPoint machine

  // Provider suggestions / requests for new medications
  const [suggestions, setSuggestions] = useState<MedicationSuggestion[]>([]);

  // For converting a suggestion into a real medication (admin flow)
  const [suggestionForAdding, setSuggestionForAdding] = useState<MedicationSuggestion | null>(null);

  useEffect(() => {
    async function loadFromDatabase() {
      try {
        // Auto-seed on first run / empty DB (works for anyone; safe no-op if data exists)
        await serverSeedDatabaseIfEmpty();
        await serverEnsureAdminUser();

        const [meds, act, sugg, settings] = await Promise.all([
          getMedications(),
          getActivityLog(),
          getSuggestions(),
          getAppSettings(),
        ]);

        setMedications(meds as any);
        setActivity(act as any);
        setSuggestions(sugg as any);
        setTotalSlots(settings.totalSlots);
        setLastUpdated(settings.dataAsOf);
      } catch (err) {
        console.error("Failed to load from database, falling back to seed data:", err);
        // Fallback to seed data if DB is unavailable
        setMedications(SEED_MEDICATIONS);
        setActivity([]);
        setSuggestions([]);
        setTotalSlots(90);
        setLastUpdated(SEED_METADATA.dataAsOf);
      }

      setIsHydrated(true);
    }

    loadFromDatabase();
  }, []);

  // LocalStorage persistence disabled — data is now stored in the database via Server Actions

  const updateTimestamp = useCallback(() => {
    setLastUpdated(new Date().toISOString());
  }, []);

  const dispense = useCallback(
    async (id: string, qty: number): Promise<boolean> => {
      if (!isAdmin) {
        toast.error("Dispensing is restricted to logged-in administrators only.");
        return false;
      }

      try {
        const success = await serverDispense(id, qty);
        if (success) {
          // Optimistic update
          const med = medications.find((m) => m.id === id);
          if (med) {
            const remainingQty = Math.max(0, med.qty - qty);
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
          }

          toast.success(`Dispensed ${qty}× ${med?.name}.`);
          return true;
        }
        return false;
      } catch (error: any) {
        const msg = error?.message || "Failed to dispense medication.";
        toast.error(msg.length > 120 ? msg.substring(0, 120) + "..." : msg);
        return false;
      }
    },
    [medications, isAdmin]
  );

  const addMedication = useCallback(
    async (med: Omit<Medication, "id">): Promise<boolean> => {
      try {
        const success = await serverAddMedication(med as any);
        if (success) {
          // Optimistic update
          const id = generateMedicationId(med.ndc, med.machine, med.drawer, med.row);
          setMedications((prev) => [...prev, { ...med, id } as Medication]);
          updateTimestamp();
          toast.success("Medication added.");
          return true;
        }
        return false;
      } catch (error: any) {
        const msg = error?.message || "Failed to add medication.";
        toast.error(msg.length > 120 ? msg.substring(0, 120) + "..." : msg);
        return false;
      }
    },
    [updateTimestamp]
  );

  const updateMedication = useCallback(
    async (med: Medication): Promise<boolean> => {
      try {
        const success = await serverUpdateMedication(med as any);
        if (success) {
          setMedications((prev) => prev.map((m) => (m.id === med.id ? med : m)));
          updateTimestamp();
          toast.success("Medication updated.");
          return true;
        }
        return false;
      } catch (error: any) {
        const msg = error?.message || "Failed to update medication.";
        toast.error(msg.length > 120 ? msg.substring(0, 120) + "..." : msg);
        return false;
      }
    },
    [updateTimestamp]
  );

  const deleteMedication = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const success = await serverDeleteMedication(id);
        if (success) {
          setMedications((prev) => prev.filter((m) => m.id !== id));
          updateTimestamp();
          toast.success("Medication deleted.");
          return true;
        }
        return false;
      } catch (error) {
        toast.error("Failed to delete medication.");
        return false;
      }
    },
    [updateTimestamp]
  );

  const importInventory = useCallback(
    async (data: unknown): Promise<boolean> => {
      if (!Array.isArray(data)) {
        toast.error("Invalid inventory file format.");
        return false;
      }
      try {
        const success = await serverImportInventory(data as any);
        if (success) {
          // Re-fetch fresh data after bulk import
          const freshMeds = await getMedications();
          setMedications(freshMeds as any);
          updateTimestamp();
          toast.success(`Imported ${data.length} medications.`);
          return true;
        }
        return false;
      } catch (error: any) {
        toast.error(error.message || "Failed to import inventory.");
        return false;
      }
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

  const resetToSeed = useCallback(async (): Promise<boolean> => {
    try {
      const success = await serverResetToSeed();
      if (success) {
        const freshMeds = await getMedications();
        setMedications(freshMeds.length > 0 ? (freshMeds as any) : SEED_MEDICATIONS);
        setActivity([]);
        setLastUpdated(SEED_METADATA.dataAsOf);
        toast.success("Inventory reset to original PDF data.");
        return true;
      }
      return false;
    } catch (error) {
      toast.error("Failed to reset inventory.");
      return false;
    }
  }, []);

  const seedDatabaseIfEmpty = useCallback(async (): Promise<boolean> => {
    try {
      const seeded = await serverSeedDatabaseIfEmpty();
      if (seeded) {
        const freshMeds = await getMedications();
        setMedications(freshMeds as any);
        toast.success("Database initialized with original medications.");
        return true;
      }
      return false;
    } catch (error) {
      toast.error("Failed to initialize database.");
      return false;
    }
  }, []);

  // Real authentication using Auth.js Credentials provider (replaces PIN entirely)
  const loginAdmin = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const result = await nextAuthSignIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid username or password.");
        return false;
      }

      if (result?.ok) {
        toast.success("Admin login successful.");
        return true;
      }

      toast.error("Login failed.");
      return false;
    } catch (error) {
      toast.error("Login error. Please try again.");
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await nextAuthSignOut({ redirect: false });
    toast.info("Logged out.");
  }, []);

  // Derived slot counts
  const occupiedSlots = medications.length;
  const availableSlots = Math.max(0, totalSlots - occupiedSlots);

  // Simple flag for empty database state
  const needsDatabaseSeeding = medications.length === 0;

  const updateTotalSlots = useCallback(async (newTotal: number) => {
    if (newTotal < occupiedSlots) {
      toast.error(`Total slots cannot be lower than currently occupied slots (${occupiedSlots}).`);
      return;
    }
    try {
      await serverUpdateTotalSlots(newTotal);
      setTotalSlots(newTotal);
      toast.success(`Machine capacity updated to ${newTotal} slots.`);
    } catch (error) {
      toast.error("Failed to update total slots.");
    }
  }, [occupiedSlots]);

  // Suggestion methods
  const addSuggestion = useCallback(
    async (suggestion: Omit<MedicationSuggestion, "id" | "requestedAt">) => {
      try {
        await serverAddSuggestion(suggestion);
        // Optimistic update
        const newSuggestion: MedicationSuggestion = {
          ...suggestion,
          id: crypto.randomUUID(),
          requestedAt: new Date().toISOString(),
        };
        setSuggestions((prev) => [newSuggestion, ...prev]);
        toast.success("Suggestion submitted. Thank you!");
      } catch (error: any) {
        const msg = error?.message || "Failed to submit suggestion.";
        toast.error(msg.length > 120 ? msg.substring(0, 120) + "..." : msg);
      }
    },
    []
  );

  const deleteSuggestion = useCallback(async (id: string) => {
    try {
      await serverDeleteSuggestion(id);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Suggestion removed.");
    } catch (error) {
      toast.error("Failed to remove suggestion.");
    }
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
      seedDatabaseIfEmpty,
      needsDatabaseSeeding,

      isAuthenticatedAdmin: isAdmin,
      currentUser,
      loginAdmin,
      logout,

      isDegradedMode: prismaIsDegradedMode,
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
      seedDatabaseIfEmpty,
      needsDatabaseSeeding,
      currentUser,
      loginAdmin,
      logout,
      updateTotalSlots,
      addSuggestion,
      deleteSuggestion,
      startAddingFromSuggestion,
      clearSuggestionForAdding,
      prismaIsDegradedMode,
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
