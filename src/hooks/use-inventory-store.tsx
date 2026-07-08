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
import {
  loadLocalInventory,
  resetLocalInventory,
  saveLocalActivity,
  saveLocalMedications,
  saveLocalDataAsOf,
  saveLocalSuggestions,
  saveLocalTotalSlots,
} from "@/lib/local-storage-backend";
import { isLocalMode } from "@/lib/runtime-mode";
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
// ADMIN_PIN and STORAGE_KEYS kept only for reference / migration comments (no longer used)
import {
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
  getSharedBackendStatus,
  refreshInventoryData,
  ensureAdminUser,
} from "@/lib/actions";
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

  dispense: (id: string, qty: number) => Promise<boolean>;
  addMedication: (med: Omit<Medication, "id">) => Promise<boolean>;
  updateMedication: (med: Medication) => void;
  deleteMedication: (id: string) => void;
  importInventory: (data: unknown, options?: { dataAsOf?: string }) => Promise<boolean>;
  exportInventory: () => void;
  resetToSeed: () => Promise<boolean>;
  seedDatabaseIfEmpty: () => Promise<boolean>;
  needsDatabaseSeeding: boolean;

  // Real Auth.js based admin (replaces old PIN system)
  isAuthenticatedAdmin: boolean;
  currentUser: { name?: string | null; email?: string | null } | null;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;

  sharedConnected: boolean | null;
  sharedError: string | null;
  isRefreshing: boolean;
  refreshFromServer: () => Promise<void>;
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

  // Admin only after explicit login (never default to admin on startup)
  const isAdmin = session?.user?.isAdmin === true;
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
  const [sharedConnected, setSharedConnected] = useState<boolean | null>(
    isLocalMode ? true : null
  );
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyRemoteData = useCallback(
    (data: {
      medications: Medication[];
      activity: ActivityEntry[];
      suggestions: MedicationSuggestion[];
      totalSlots: number;
      dataAsOf: string;
    }) => {
      setMedications(data.medications);
      setActivity(data.activity);
      setSuggestions(data.suggestions);
      setTotalSlots(data.totalSlots);
      setLastUpdated(data.dataAsOf);
    },
    []
  );

  const refreshFromServer = useCallback(async () => {
    if (isLocalMode) return;

    setIsRefreshing(true);
    try {
      const status = await getSharedBackendStatus();
      setSharedConnected(status.connected);
      setSharedError(status.error ?? null);

      if (!status.connected) {
        setMedications([]);
        setActivity([]);
        setSuggestions([]);
        return;
      }

      await ensureAdminUser();
      const data = await refreshInventoryData();
      if (data) {
        applyRemoteData(data);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to refresh shared inventory.";
      setSharedConnected(false);
      setSharedError(message);
      toast.error(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [applyRemoteData]);

  useEffect(() => {
    async function loadFromDatabase() {
      if (isLocalMode) {
        const local = loadLocalInventory();
        setMedications(local.medications);
        setActivity(local.activity);
        setSuggestions(local.suggestions);
        setTotalSlots(local.totalSlots);
        setLastUpdated(local.lastUpdated);
        setSharedConnected(true);
        setSharedError(null);
        setIsHydrated(true);
        return;
      }

      await refreshFromServer();
      setIsHydrated(true);
    }

    loadFromDatabase();
  }, [refreshFromServer]);

  useEffect(() => {
    if (isLocalMode) return;

    const interval = window.setInterval(() => {
      refreshFromServer();
    }, 30_000);

    const onFocus = () => refreshFromServer();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshFromServer]);

  // LocalStorage persistence disabled — data is now stored in the database via Server Actions

  const updateTimestamp = useCallback(() => {
    setLastUpdated(new Date().toISOString());
  }, []);

  const dispense = useCallback(
    async (id: string, qty: number): Promise<boolean> => {
      if (!isAdmin) {
        toast.error("Admin login required to dispense.");
        return false;
      }

      const med = medications.find((m) => m.id === id);
      if (!med || qty <= 0 || qty > med.qty) return false;

      const remainingQty = med.qty - qty;
      const nextMeds = medications.map((m) =>
        m.id === id ? { ...m, qty: remainingQty } : m
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
      const nextActivity = [entry, ...activity];

      if (isLocalMode) {
        setMedications(nextMeds);
        setActivity(nextActivity);
        updateTimestamp();
        saveLocalMedications(nextMeds);
        saveLocalActivity(nextActivity);
        toast.success(`Dispensed ${qty}× ${med.name}. ${remainingQty} remaining.`);
        return true;
      }

      try {
        await serverDispense(id, qty);
        await refreshFromServer();
        toast.success(`Dispensed ${qty}× ${med.name}. ${remainingQty} remaining.`);
        return true;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to dispense medication.";
        toast.error(msg.length > 120 ? msg.substring(0, 120) + "..." : msg);
        return false;
      }
    },
    [medications, activity, isAdmin, updateTimestamp, refreshFromServer]
  );

  const addMedication = useCallback(
    async (med: Omit<Medication, "id">): Promise<boolean> => {
      const id = generateMedicationId(med.ndc, med.machine, med.drawer, med.row);
      if (medications.some((m) => m.id === id)) {
        toast.error("A medication with this NDC and location already exists.");
        return false;
      }

      const newMed = { ...med, id } as Medication;

      if (isLocalMode) {
        const next = [...medications, newMed];
        setMedications(next);
        updateTimestamp();
        saveLocalMedications(next);
        toast.success("Medication added.");
        return true;
      }

      try {
        await serverAddMedication(med as Medication);
        await refreshFromServer();
        toast.success("Medication added.");
        return true;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to add medication.";
        toast.error(msg.length > 120 ? msg.substring(0, 120) + "..." : msg);
        return false;
      }
    },
    [medications, updateTimestamp, refreshFromServer]
  );

  const updateMedication = useCallback(
    async (med: Medication): Promise<boolean> => {
      if (isLocalMode) {
        const next = medications.map((m) => (m.id === med.id ? med : m));
        setMedications(next);
        updateTimestamp();
        saveLocalMedications(next);
        toast.success("Medication updated.");
        return true;
      }

      try {
        await serverUpdateMedication(med as Medication);
        await refreshFromServer();
        toast.success("Medication updated.");
        return true;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to update medication.";
        toast.error(msg.length > 120 ? msg.substring(0, 120) + "..." : msg);
        return false;
      }
    },
    [medications, updateTimestamp, refreshFromServer]
  );

  const deleteMedication = useCallback(
    async (id: string): Promise<boolean> => {
      if (isLocalMode) {
        const next = medications.filter((m) => m.id !== id);
        setMedications(next);
        updateTimestamp();
        saveLocalMedications(next);
        toast.success("Medication deleted.");
        return true;
      }

      try {
        await serverDeleteMedication(id);
        await refreshFromServer();
        toast.success("Medication deleted.");
        return true;
      } catch {
        toast.error("Failed to delete medication.");
        return false;
      }
    },
    [medications, updateTimestamp, refreshFromServer]
  );

  const importInventory = useCallback(
    async (data: unknown, options?: { dataAsOf?: string }): Promise<boolean> => {
      if (!Array.isArray(data)) {
        toast.error("Invalid inventory file format.");
        return false;
      }

      const dataAsOfLabel = options?.dataAsOf;

      if (isLocalMode) {
        const normalized = (data as Record<string, unknown>[]).map((item) => ({
          id: String(item.id ?? ""),
          ndc: String(item.ndc ?? ""),
          name: String(item.name ?? ""),
          strength: String(item.strength ?? ""),
          size: String(item.size ?? ""),
          class: item.class === "Schedule III-V" ? "Schedule III-V" : "Uncontrolled",
          categories: Array.isArray(item.categories) ? item.categories : [],
          qty: Number(item.qty ?? 0),
          lowQty: Number(item.lowQty ?? 10),
          highQty: Number(item.highQty ?? 10),
          machine: Number(item.machine ?? 1),
          drawer: String(item.drawer ?? "A"),
          row: Number(item.row ?? 1),
          cost: Number(item.cost ?? 0),
        })) as Medication[];
        setMedications(normalized);
        setActivity([]);
        saveLocalMedications(normalized);
        saveLocalActivity([]);
        if (dataAsOfLabel) {
          setLastUpdated(dataAsOfLabel);
          saveLocalDataAsOf(dataAsOfLabel);
        } else {
          updateTimestamp();
        }
        toast.success(`Imported ${normalized.length} medications.`);
        return true;
      }

      if (!data.every(isValidMedication)) {
        toast.error("Inventory file contains invalid medication records.");
        return false;
      }

      try {
        await serverImportInventory(data as Medication[], dataAsOfLabel);
        await refreshFromServer();
        toast.success(`Imported ${data.length} medications.`);
        return true;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to import inventory.";
        toast.error(msg);
        return false;
      }
    },
    [updateTimestamp, refreshFromServer]
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
    if (isLocalMode) {
      resetLocalInventory();
      setMedications(SEED_MEDICATIONS);
      setActivity([]);
      setSuggestions([]);
      setTotalSlots(90);
      setLastUpdated(SEED_METADATA.dataAsOf);
      toast.success("Inventory reset to original PDF data.");
      return true;
    }

    try {
      await serverResetToSeed();
      await refreshFromServer();
      toast.success("Inventory reset to original PDF data.");
      return true;
    } catch {
      toast.error("Failed to reset inventory.");
      return false;
    }
  }, [refreshFromServer]);

  const seedDatabaseIfEmpty = useCallback(async (): Promise<boolean> => {
    if (isLocalMode) {
      if (medications.length === 0) {
        resetLocalInventory();
        setMedications(SEED_MEDICATIONS);
        toast.success("Inventory initialized with original medications.");
        return true;
      }
      return false;
    }

    try {
      const seeded = await serverSeedDatabaseIfEmpty();
      if (seeded) {
        await refreshFromServer();
        toast.success("Database initialized with original medications.");
        return true;
      }
      return false;
    } catch {
      toast.error("Failed to initialize database.");
      return false;
    }
  }, [medications.length, refreshFromServer]);

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
    if (isLocalMode) {
      setTotalSlots(newTotal);
      saveLocalTotalSlots(newTotal);
      toast.success(`Machine capacity updated to ${newTotal} slots.`);
      return;
    }
    try {
      await serverUpdateTotalSlots(newTotal);
      await refreshFromServer();
      toast.success(`Machine capacity updated to ${newTotal} slots.`);
    } catch {
      toast.error("Failed to update total slots.");
    }
  }, [occupiedSlots, refreshFromServer]);

  const addSuggestion = useCallback(
    async (suggestion: Omit<MedicationSuggestion, "id" | "requestedAt">) => {
      const newSuggestion: MedicationSuggestion = {
        ...suggestion,
        id: crypto.randomUUID(),
        requestedAt: new Date().toISOString(),
      };

      if (isLocalMode) {
        const next = [newSuggestion, ...suggestions];
        setSuggestions(next);
        saveLocalSuggestions(next);
        toast.success("Suggestion submitted. Thank you!");
        return;
      }

      try {
        await serverAddSuggestion(suggestion);
        await refreshFromServer();
        toast.success("Suggestion submitted. Thank you!");
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to submit suggestion.";
        toast.error(msg.length > 120 ? msg.substring(0, 120) + "..." : msg);
      }
    },
    [refreshFromServer]
  );

  const deleteSuggestion = useCallback(async (id: string) => {
    if (isLocalMode) {
      const next = suggestions.filter((s) => s.id !== id);
      setSuggestions(next);
      saveLocalSuggestions(next);
      toast.success("Suggestion removed.");
      return;
    }
    try {
      await serverDeleteSuggestion(id);
      await refreshFromServer();
      toast.success("Suggestion removed.");
    } catch {
      toast.error("Failed to remove suggestion.");
    }
  }, [refreshFromServer]);

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

      sharedConnected,
      sharedError,
      isRefreshing,
      refreshFromServer,
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
      sharedConnected,
      sharedError,
      isRefreshing,
      refreshFromServer,
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
