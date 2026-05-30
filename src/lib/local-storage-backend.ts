import { SEED_MEDICATIONS, SEED_METADATA } from "@/data/seed-data";
import { ActivityEntry } from "@/types/activity";
import { Medication } from "@/types/medication";
import { MedicationSuggestion } from "@/types/suggestion";

const KEYS = {
  medications: "pickpoint-medications",
  activity: "pickpoint-activity",
  lastUpdated: "pickpoint-last-updated",
  totalSlots: "pickpoint-total-slots",
  suggestions: "pickpoint-suggestions",
} as const;

export interface LocalInventorySnapshot {
  medications: Medication[];
  activity: ActivityEntry[];
  lastUpdated: string;
  totalSlots: number;
  suggestions: MedicationSuggestion[];
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadLocalInventory(): LocalInventorySnapshot {
  return {
    medications: readJson(KEYS.medications, SEED_MEDICATIONS),
    activity: readJson(KEYS.activity, []),
    lastUpdated: readJson(KEYS.lastUpdated, SEED_METADATA.dataAsOf),
    totalSlots: readJson(KEYS.totalSlots, 90),
    suggestions: readJson(KEYS.suggestions, []),
  };
}

export function saveLocalMedications(medications: Medication[]) {
  writeJson(KEYS.medications, medications);
  writeJson(KEYS.lastUpdated, new Date().toISOString());
}

export function saveLocalActivity(activity: ActivityEntry[]) {
  writeJson(KEYS.activity, activity);
  writeJson(KEYS.lastUpdated, new Date().toISOString());
}

export function saveLocalSuggestions(suggestions: MedicationSuggestion[]) {
  writeJson(KEYS.suggestions, suggestions);
}

export function saveLocalTotalSlots(totalSlots: number) {
  writeJson(KEYS.totalSlots, totalSlots);
}

export function resetLocalInventory() {
  writeJson(KEYS.medications, SEED_MEDICATIONS);
  writeJson(KEYS.activity, []);
  writeJson(KEYS.suggestions, []);
  writeJson(KEYS.totalSlots, 90);
  writeJson(KEYS.lastUpdated, SEED_METADATA.dataAsOf);
}
