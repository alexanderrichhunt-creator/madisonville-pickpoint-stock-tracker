"use client";

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Medication } from "@/types/medication";
import { generateMedicationId } from "@/lib/inventory-utils";

const EXPORT_COLUMNS = [
  "NDC",
  "Drug Name",
  "Strength",
  "Package Size",
  "Class",
  "Categories",
  "Current Qty",
  "Low Qty",
  "High Qty",
  "Machine",
  "Drawer",
  "Row",
  "Cost",
] as const;

type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string | number>;

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

function medicationToExportRow(med: Medication): ExportRow {
  return {
    NDC: med.ndc,
    "Drug Name": med.name,
    Strength: med.strength,
    "Package Size": med.size,
    Class: med.class,
    Categories: (med.categories ?? []).join("; "),
    "Current Qty": med.qty,
    "Low Qty": med.lowQty,
    "High Qty": med.highQty,
    Machine: med.machine,
    Drawer: med.drawer,
    Row: med.row,
    Cost: med.cost,
  };
}

export function exportMedicationsExcel(
  medications: Medication[],
  filename = `pickpoint-inventory-${dateStamp()}.xlsx`
) {
  const rows = medications.map(medicationToExportRow);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_COLUMNS] });
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 42 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 6 },
    { wch: 8 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );
}

export function exportMedicationsPdf(
  medications: Medication[],
  dataAsOfLabel: string,
  filename = `pickpoint-inventory-${dateStamp()}.pdf`
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  doc.setFontSize(14);
  doc.text("Madisonville PickPoint Inventory", 40, 36);
  doc.setFontSize(10);
  doc.text(`Data as of ${dataAsOfLabel} · ${medications.length} medications`, 40, 52);

  autoTable(doc, {
    startY: 64,
    head: [
      [
        "NDC",
        "Drug Name",
        "Strength",
        "Size",
        "Class",
        "Qty",
        "Location",
        "Categories",
      ],
    ],
    body: medications.map((med) => [
      med.ndc,
      med.name,
      med.strength,
      med.size,
      med.class,
      String(med.qty),
      `M${med.machine} ${med.drawer}${med.row}`,
      (med.categories ?? []).join(", "),
    ]),
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 150 },
      2: { cellWidth: 70 },
      3: { cellWidth: 42 },
      4: { cellWidth: 58 },
      5: { cellWidth: 28 },
      6: { cellWidth: 52 },
      7: { cellWidth: 110 },
    },
  });

  doc.save(filename);
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

  return {
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
}

function sheetRowsToMedications(rows: Record<string, unknown>[]): Medication[] {
  const medications: Medication[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const med = rowToMedication(rows[index], index);
    if (med) medications.push(med);
  }
  return medications;
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

export function parseInventoryWorkbook(buffer: ArrayBuffer): Medication[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The uploaded spreadsheet has no worksheets.");
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheetName],
    { defval: "" }
  );
  const medications = sheetRowsToMedications(rows);
  if (medications.length === 0) {
    throw new Error("No medications were found in the uploaded file.");
  }
  return medications;
}

export async function parseInventoryFile(file: File): Promise<Medication[]> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "json") {
    return parseInventoryJson(await file.text());
  }

  if (extension === "csv") {
    const workbook = XLSX.read(await file.text(), { type: "string" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("The uploaded CSV file is empty.");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sheetName],
      { defval: "" }
    );
    const medications = sheetRowsToMedications(rows);
    if (medications.length === 0) {
      throw new Error("No medications were found in the uploaded CSV file.");
    }
    return medications;
  }

  if (extension === "xlsx" || extension === "xls") {
    return parseInventoryWorkbook(await file.arrayBuffer());
  }

  throw new Error("Upload an Excel (.xlsx), CSV, or JSON inventory file.");
}
