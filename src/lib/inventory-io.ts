"use client";

import { Medication } from "@/types/medication";
import { enrichMedication } from "@/lib/drug-classifier";
import { generateMedicationId } from "@/lib/inventory-utils";

const EXPORT_COLUMNS = [
  "NDC",
  "Drug Name",
  "Strength",
  "Package Size",
  "Class",
  "Categories",
  "Qty",
  "Low Qty",
  "High Qty",
  "Machine",
  "Drawer",
  "Row",
  "Cost",
] as const;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeCsvValue(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function medicationsToCsv(medications: Medication[]): string {
  const header = EXPORT_COLUMNS.join(",");
  const rows = medications.map((med) =>
    [
      med.ndc,
      med.name,
      med.strength,
      med.size,
      med.class,
      (med.categories ?? []).join("; "),
      med.qty,
      med.lowQty,
      med.highQty,
      med.machine,
      med.drawer,
      med.row,
      med.cost,
    ]
      .map(escapeCsvValue)
      .join(",")
  );
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}

export function exportMedicationsExcel(
  medications: Medication[],
  filename = `pickpoint-inventory-${dateStamp()}.csv`
) {
  downloadBlob(
    new Blob([medicationsToCsv(medications)], { type: "text/csv;charset=utf-8;" }),
    filename
  );
}

export function exportMedicationsPdf(
  medications: Medication[],
  dataAsOfLabel: string
) {
  const rows = medications
    .map(
      (med) => `
      <tr>
        <td>${escapeHtml(med.ndc)}</td>
        <td>${escapeHtml(med.name)}</td>
        <td>${escapeHtml(med.strength)}</td>
        <td>${escapeHtml(med.size)}</td>
        <td>${escapeHtml(med.class)}</td>
        <td>${med.qty}</td>
        <td>M${med.machine} ${escapeHtml(med.drawer)}${med.row}</td>
        <td>${escapeHtml((med.categories ?? []).join(", "))}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <head>
    <title>PickPoint Inventory</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      p { margin-top: 0; color: #555; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
      th { background: #0f766e; color: white; }
      tr:nth-child(even) { background: #f8fafc; }
      @media print { body { margin: 12px; } }
    </style>
  </head>
  <body>
    <h1>Madisonville PickPoint Inventory</h1>
    <p>Data as of ${escapeHtml(dataAsOfLabel)} · ${medications.length} medications</p>
    <table>
      <thead>
        <tr>
          <th>NDC</th>
          <th>Drug Name</th>
          <th>Strength</th>
          <th>Size</th>
          <th>Class</th>
          <th>Qty</th>
          <th>Location</th>
          <th>Categories</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Pop-up blocked. Allow pop-ups to download the PDF.");
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function pickValue(row: Record<string, unknown>, aliases: string[]): unknown {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const match = entries.find(([key]) => normalizeHeader(key) === target);
    if (match) return match[1];
  }
  return undefined;
}

function toStringValue(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeClass(value: unknown): Medication["class"] {
  const text = toStringValue(value).toLowerCase();
  if (text.includes("schedule") || text.includes("controlled") || text.includes("iii")) {
    return "Schedule III-V";
  }
  return "Uncontrolled";
}

function normalizeCategories(value: unknown): string[] {
  const text = toStringValue(value);
  if (!text) return [];
  return text
    .split(/[;,|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function rowToMedication(row: Record<string, unknown>, index: number): Medication | null {
  const ndc = toStringValue(pickValue(row, ["ndc", "ndc number", "ndc#"]));
  const name = toStringValue(pickValue(row, ["drug name", "name", "medication", "medication name"]));
  if (!ndc && !name) return null;

  const strength = toStringValue(pickValue(row, ["strength", "dose"]));
  const size = toStringValue(
    pickValue(row, ["package size", "size", "count", "pkg size", "package count"])
  );
  const machine = toNumberValue(pickValue(row, ["machine", "machine #", "machine number"]), 1);
  const drawer = toStringValue(pickValue(row, ["drawer"])).toUpperCase() || "A";
  const rowNum = toNumberValue(pickValue(row, ["row", "row #", "row number"]), 1);
  const resolvedNdc = ndc || `IMPORT-${index + 1}`;
  const id =
    toStringValue(pickValue(row, ["id"])) ||
    generateMedicationId(resolvedNdc, machine, drawer, rowNum);

  const base = {
    id,
    ndc: resolvedNdc,
    name: name || `Medication ${index + 1}`,
    strength,
    size,
    class: normalizeClass(pickValue(row, ["class", "drug class", "control class"])),
    categories: normalizeCategories(pickValue(row, ["categories", "category", "condition"])),
    qty: toNumberValue(pickValue(row, ["current qty", "qty", "quantity", "on hand", "current quantity"])),
    lowQty: toNumberValue(pickValue(row, ["low qty", "low quantity", "reorder point"]), 10),
    highQty: toNumberValue(pickValue(row, ["high qty", "high quantity", "par level"]), 10),
    machine,
    drawer,
    row: rowNum,
    cost: toNumberValue(pickValue(row, ["cost", "unit cost"])),
  };

  return enrichMedication(base, {
    preserveCategories: base.categories.length > 0,
  });
}

function sheetRowsToMedications(rows: Record<string, unknown>[]): Medication[] {
  const medications: Medication[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const med = rowToMedication(rows[index], index);
    if (med) medications.push(med);
  }
  return medications;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text: string): Record<string, unknown>[] {
  const normalized = text.replace(/^\uFEFF/, "");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("The uploaded CSV file has no medication rows.");
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

export function parseInventoryJson(text: string): Medication[] {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Inventory file must contain a list of medications.");
  }

  return parsed
    .map((item, index) =>
      typeof item === "object" && item !== null
        ? rowToMedication(item as Record<string, unknown>, index)
        : null
    )
    .filter((item): item is Medication => item !== null);
}

export function parseInventoryCsv(text: string): Medication[] {
  const medications = sheetRowsToMedications(parseCsv(text));
  if (medications.length === 0) {
    throw new Error("No medications were found in the uploaded CSV file.");
  }
  return medications;
}

export interface InventoryImportResult {
  medications: Medication[];
  dataAsOf?: string;
  warnings?: string[];
  source: "csv" | "json" | "pdf";
}

async function parseInventoryPdf(file: File): Promise<InventoryImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/parse-pdf", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as {
    medications?: Medication[];
    dataAsOf?: string;
    warnings?: string[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to parse the uploaded PDF.");
  }

  if (!payload.medications?.length) {
    throw new Error("No medications were found in the uploaded PDF.");
  }

  return {
    medications: payload.medications,
    dataAsOf: payload.dataAsOf,
    warnings: payload.warnings,
    source: "pdf",
  };
}

export async function parseInventoryFile(file: File): Promise<InventoryImportResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "pdf") {
    return parseInventoryPdf(file);
  }

  if (extension === "json") {
    return {
      medications: parseInventoryJson(await file.text()),
      source: "json",
    };
  }

  if (extension === "csv") {
    return {
      medications: parseInventoryCsv(await file.text()),
      source: "csv",
    };
  }

  if (extension === "xlsx" || extension === "xls") {
    throw new Error(
      "Please save your Excel file as CSV (File → Save As → CSV) and upload that file."
    );
  }

  throw new Error(
    "Upload a PickPoint inventory PDF, CSV, or JSON file exported from this app."
  );
}
