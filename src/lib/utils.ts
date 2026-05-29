import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Legacy constants kept only for migration reference. The app is now 100% server-backed (Neon + Prisma).
// ADMIN_PIN and localStorage persistence were removed in favor of Auth.js + database.
export const LEGACY_ADMIN_PIN = "mpp2026" as const;

export const LEGACY_STORAGE_KEYS = {
  medications: "pickpoint-medications",
  activity: "pickpoint-activity",
  lastUpdated: "pickpoint-last-updated",
  totalSlots: "pickpoint-total-slots",
  suggestions: "pickpoint-suggestions",
} as const;
