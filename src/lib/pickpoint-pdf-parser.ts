import { enrichMedication } from "@/lib/drug-classifier";
import { generateMedicationId } from "@/lib/inventory-utils";
import { Medication } from "@/types/medication";

export interface PickPointParseResult {
  medications: Medication[];
  dataAsOf?: string;
  warnings: string[];
}

const NDC_PATTERN = /\b(\d{5}-?\d{4}-?\d{2}|\d{11})\b/g;
const NDC_LINE_START = /^(?:NDC[:\s#]*)?(\d{5}-?\d{4}-?\d{2}|\d{11})\b/i;
const DATA_AS_OF_PATTERN =
  /(?:data\s+as\s+of|inventory\s+(?:as\s+of|date)|report\s+date)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i;
const DATE_PATTERN = /\b([A-Za-z]+\s+\d{1,2},?\s+\d{4})\b/;

const LOCATION_PATTERNS = [
  /machine\s*#?\s*(\d+)\s*[,/]?\s*drawer\s*([A-H])\s*[,/]?\s*row\s*#?\s*(\d+)/i,
  /m\s*#?\s*(\d+)\s*[,/]?\s*d\s*([A-H])\s*[,/]?\s*r\s*#?\s*(\d+)/i,
  /\bm\s*(\d+)\s*([A-H])\s*(\d+)\b/i,
  /(\d+)\s*\/\s*([A-H])\s*\/\s*(\d+)/,
  /drawer\s*([A-H])\s*[,/]?\s*row\s*#?\s*(\d+)/i,
  /\b([A-H])\s*(\d{1,2})\b/,
];

const CLASS_PATTERN =
  /\b(schedule\s*(?:iii|iv|v|3|4|5)|c-?iii|c-?iv|c-?v|controlled|uncontrolled)\b/i;

const STRENGTH_PATTERN =
  /\b\d+(?:\.\d+)?\s*(?:MG|MCG|GM|G|ML|UNIT|IU|%)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:MG|MCG|ML|UNIT)?)?(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:MG|MCG|ML|UNIT)?)?/gi;

function normalizeNdc(raw: string): string {
  return raw.replace(/\D/g, "");
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractDataAsOf(text: string): string | undefined {
  const labeled = text.match(DATA_AS_OF_PATTERN);
  if (labeled?.[1]) return labeled[1].trim();

  const header = text.slice(0, 500);
  const dateMatch = header.match(DATE_PATTERN);
  return dateMatch?.[1]?.trim();
}

function normalizeStrength(raw: string): string {
  return raw
    .replace(/;/g, " / ")
    .replace(/\s*\/\s*1\b/g, "")
    .replace(/\bMG\/1\b/gi, "MG")
    .replace(/\bMCG\/1\b/gi, "MCG")
    .replace(/\s+/g, " ")
    .trim();
}

function parseClass(text: string): Medication["class"] | undefined {
  const match = text.match(CLASS_PATTERN);
  if (!match) return undefined;
  const value = match[1].toLowerCase();
  if (value.includes("uncontrolled")) return "Uncontrolled";
  return "Schedule III-V";
}

function parseLocation(text: string): {
  machine: number;
  drawer: string;
  row: number;
} {
  for (const pattern of LOCATION_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;

    if (match.length === 4) {
      return {
        machine: Number(match[1]) || 1,
        drawer: match[2].toUpperCase(),
        row: Number(match[3]) || 1,
      };
    }

    if (match.length === 3 && /drawer/i.test(pattern.source)) {
      return {
        machine: 1,
        drawer: match[1].toUpperCase(),
        row: Number(match[2]) || 1,
      };
    }

    if (match.length === 3) {
      return {
        machine: 1,
        drawer: match[1].toUpperCase(),
        row: Number(match[2]) || 1,
      };
    }
  }

  return { machine: 1, drawer: "A", row: 1 };
}

function extractStrength(text: string): string {
  const matches = text.match(STRENGTH_PATTERN);
  if (!matches || matches.length === 0) return "";
  if (matches.length === 1) return normalizeStrength(matches[0]);

  const combined = matches
    .slice(0, 2)
    .map((part) => part.trim())
    .join(" / ");
  return normalizeStrength(combined);
}

function extractNumbers(text: string): number[] {
  return (text.match(/\b\d+(?:\.\d+)?\b/g) ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function inferQuantities(text: string, packageSize: string): {
  qty: number;
  lowQty: number;
  highQty: number;
} {
  const numbers = extractNumbers(text).filter((n) => String(n) !== packageSize);
  if (numbers.length >= 3) {
    const [qty, lowQty, highQty] = numbers.slice(-3);
    return { qty, lowQty, highQty };
  }
  if (numbers.length === 2) {
    const [qty, highQty] = numbers;
    return { qty, lowQty: Math.min(qty, 10), highQty };
  }
  if (numbers.length === 1) {
    return { qty: numbers[0], lowQty: 10, highQty: 10 };
  }
  return { qty: 0, lowQty: 10, highQty: 10 };
}

function extractPackageSize(text: string): string {
  const countMatch = text.match(/\b(?:pkg|package|size|count)[:\s#]*(\d+(?:\.\d+)?)\b/i);
  if (countMatch) return countMatch[1];

  const trailingCount = text.match(/\b(\d+(?:\.\d+)?)\s*(?:ea|each|tabs?|caps?|tablets?|capsules?)\b/i);
  if (trailingCount) return trailingCount[1];

  const numbers = extractNumbers(text);
  if (numbers.length > 0) {
    const candidate = numbers.find((n) => n >= 1 && n <= 500);
    if (candidate !== undefined) return String(candidate);
  }

  return "";
}

function extractDrugName(block: string, ndc: string): string {
  let working = block.replace(ndc, " ").trim();

  const headerPatterns = [
    /^drug\s*name[:\s]*/i,
    /^medication[:\s]*/i,
    /^description[:\s]*/i,
  ];
  for (const pattern of headerPatterns) {
    working = working.replace(pattern, "");
  }

  working = working
    .replace(CLASS_PATTERN, " ")
    .replace(STRENGTH_PATTERN, " ")
    .replace(/\b(?:machine|drawer|row|m\d|qty|quantity|on hand|par|low|high|cost)\b[^A-Za-z]*/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = working.split(" ").filter(Boolean);
  if (words.length === 0) return "UNKNOWN MEDICATION";

  return words
    .slice(0, Math.min(words.length, 12))
    .join(" ")
    .toUpperCase();
}

function splitIntoBlocks(text: string): string[] {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (NDC_LINE_START.test(line) || /^\d{11}$/.test(line.replace(/\D/g, ""))) {
      if (current.length > 0) {
        blocks.push(current.join("\n"));
      }
      current = [line];
      continue;
    }

    if (current.length > 0) {
      current.push(line);
    }
  }

  if (current.length > 0) {
    blocks.push(current.join("\n"));
  }

  if (blocks.length > 0) return blocks;

  const inlineMatches = Array.from(text.matchAll(NDC_PATTERN));
  if (inlineMatches.length === 0) return [];

  for (let index = 0; index < inlineMatches.length; index += 1) {
    const start = inlineMatches[index].index ?? 0;
    const end =
      index + 1 < inlineMatches.length
        ? (inlineMatches[index + 1].index ?? text.length)
        : text.length;
    blocks.push(text.slice(start, end).trim());
  }

  return blocks;
}

function parseBlock(block: string, index: number, warnings: string[]): Medication | null {
  const ndcMatch = block.match(NDC_PATTERN);
  if (!ndcMatch?.[0]) return null;

  const ndc = normalizeNdc(ndcMatch[0]);
  if (ndc.length !== 11) {
    warnings.push(`Skipped record ${index + 1}: invalid NDC "${ndcMatch[0]}".`);
    return null;
  }

  const name = extractDrugName(block, ndcMatch[0]);
  const strength = extractStrength(block);
  const size = extractPackageSize(block) || "1";
  const pdfClass = parseClass(block);
  const location = parseLocation(block);
  const quantities = inferQuantities(block, size);

  const partial = {
    ndc,
    name,
    strength,
    size,
    class: pdfClass ?? "Uncontrolled",
    categories: [] as string[],
    qty: quantities.qty,
    lowQty: quantities.lowQty,
    highQty: quantities.highQty,
    machine: location.machine,
    drawer: location.drawer,
    row: location.row,
    cost: 0,
  };

  const enriched = enrichMedication(partial, { preserveCategories: false });
  const id = generateMedicationId(
    enriched.ndc,
    enriched.machine,
    enriched.drawer,
    enriched.row
  );

  return { ...enriched, id };
}

export function parsePickPointPdfText(text: string): PickPointParseResult {
  const normalized = normalizeWhitespace(text);
  const warnings: string[] = [];
  const dataAsOf = extractDataAsOf(normalized);
  const blocks = splitIntoBlocks(normalized);

  if (blocks.length === 0) {
    throw new Error(
      "No medications found in the PDF. Make sure you uploaded a PickPoint inventory report with NDC numbers."
    );
  }

  const medications: Medication[] = [];
  const seenIds = new Set<string>();

  for (let index = 0; index < blocks.length; index += 1) {
    const med = parseBlock(blocks[index], index, warnings);
    if (!med) continue;

    if (seenIds.has(med.id)) {
      warnings.push(`Duplicate location for ${med.name} (${med.ndc}); keeping first entry.`);
      continue;
    }

    seenIds.add(med.id);
    medications.push(med);
  }

  if (medications.length === 0) {
    throw new Error(
      "Could not parse any valid medication rows from the PDF. Try exporting a fresh inventory report from PickPoint."
    );
  }

  return { medications, dataAsOf, warnings };
}
