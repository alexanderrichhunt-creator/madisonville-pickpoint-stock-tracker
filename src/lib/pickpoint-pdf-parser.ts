import { enrichMedication } from "@/lib/drug-classifier";
import { generateMedicationId } from "@/lib/inventory-utils";
import { Medication } from "@/types/medication";

export interface PickPointParseResult {
  medications: Medication[];
  dataAsOf?: string;
  warnings: string[];
}

const DATA_AS_OF_PATTERN =
  /(?:data\s+as\s+of|inventory\s+(?:as\s+of|date)|report\s+date)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i;
const DATE_PATTERN = /\b([A-Za-z]+\s+\d{1,2},?\s+\d{4})\b/;
const CLASS_PATTERN = /(Schedule\s*III-V|Uncontrolled)/i;
const LOCATION_END_PATTERN = /(\d)([A-H])(\d{1,2})\s*$/i;
const STRENGTH_UNIT_PATTERN =
  /(?:MG|MCG|GM|G|ML|UG|UNIT|IU|%|U\/G|PACK|MEQ)/i;

const PAGE_NOISE_PATTERN =
  /(?:July|January|February|March|April|May|June|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}.*?Page\s+\d+/gi;
const HEADER_NOISE_PATTERN =
  /NDC\s*Drug\s*Name\s*Qty\s*Strength\s*Size\s*Class\s*Cost\s*Low\s*Qty\s*High\s*Qty\s*Machine\s*Row\s*Drawer/gi;

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

  const header = text.slice(0, 800);
  const dateMatch = header.match(DATE_PATTERN);
  if (dateMatch?.[1]) return dateMatch[1].trim();

  // JasperReports footers: "July 07, 2026  4:53 PM"
  const footer = text.match(
    /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/
  );
  return footer?.[1]?.trim();
}

function normalizeStrength(raw: string): string {
  let value = raw
    .replace(/\s+/g, " ")
    .replace(/;/g, " / ")
    // PickPoint unit suffix only (MG/1), not drug amounts like "1 MG/ML"
    .replace(/\bMG\/1\b/gi, "MG")
    .replace(/\bMCG\/1\b/gi, "MCG")
    .replace(/\bG\/1\b/gi, "G")
    // "2.5MG" → "2.5 MG", "875/125MG" → "875/125 MG"
    .replace(/(\d)(MG|MCG|GM|G|ML|UG|%)\b/gi, "$1 $2")
    // Leading ".5" → "0.5"
    .replace(/(^|\/\s*)\.(\d)/g, "$10.$2")
    .replace(/\s+/g, " ")
    .trim();

  // Compound forms from PickPoint multi-part strengths
  value = value
    // "300 / 30 MG / MG" → "300 MG / 30 MG"
    .replace(
      /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*MG\s*\/\s*MG$/i,
      "$1 MG / $2 MG"
    )
    // "3 / 1 MG/ML / MG/ML" → "3 MG/ML / 1 MG/ML"
    .replace(
      /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*MG\/ML\s*\/\s*MG\/ML$/i,
      "$1 MG/ML / $2 MG/ML"
    )
    // "3 / 0.5 MG/3 ML / MG/3 ML" → "3 MG/3 ML / 0.5 MG/3 ML"
    .replace(
      /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*MG\/3\s*ML\s*\/\s*MG\/3\s*ML$/i,
      "$1 MG/3 ML / $2 MG/3 ML"
    )
    .replace(/\s*\/\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return value;
}

function stripNoise(text: string): string {
  return text
    .replace(PAGE_NOISE_PATTERN, "\n")
    .replace(HEADER_NOISE_PATTERN, "\n")
    .replace(/Inventory Report/gi, "\n")
    .replace(/\bMADISONVILLE\b/g, "\n")
    .replace(/\d+\s+Records/gi, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * PickPoint JasperReports inventory PDFs emit rows like:
 *   007817296851090 MCG6.710Uncontrolled9$ 0.00ALBUTEROL HFA INHALER1A1
 * i.e. NDC(11) + Qty + Strength + Size + LowQty + Class + HighQty + $Cost + Name + MachineDrawerRow
 *
 * NDCs are glued to the quantity (no separator), so word-boundary NDC regexes fail.
 */
function splitJasperRecords(text: string): string[] {
  const cleaned = stripNoise(text);
  const parts = cleaned.split(/(?=^\d{11})/m).map((part) => part.trim());
  return parts.filter((part) => /^\d{11}/.test(part));
}

function formatSize(raw: string): string {
  // JasperReports prints package size with one decimal place: 20.0, 6.7, 100.0
  if (/^\d+\.0$/.test(raw)) return raw.slice(0, -2);
  return raw;
}

function splitSizeAndLowQty(beforeClass: string): {
  qtyStrength: string;
  size: string;
  lowQty: number;
} | null {
  // Jasper emits size with exactly one decimal digit, then low-qty digits:
  //   "6.710"   → 6.7 + 10
  //   "100.010" → 100.0 + 10
  //   "30.08"   → 30.0 + 8
  // Ambiguous when strength uses PickPoint's "/1" unit suffix:
  //   "500 MG/120.010" can be size 120 or size 20 (from "500 MG/1" + "20.010").
  // Score every valid end-split and pick the best.
  type Candidate = {
    qtyStrength: string;
    size: string;
    lowQty: number;
    score: number;
  };
  const candidates: Candidate[] = [];

  for (let i = 0; i < beforeClass.length; i += 1) {
    const rest = beforeClass.slice(i);
    const match = rest.match(/^(\d+\.\d)(\d{1,2})$/);
    if (!match) continue;

    const qtyStrength = beforeClass.slice(0, i);
    const sizeRaw = match[1];
    const lowQty = Number(match[2]);
    const sizeNum = Number(sizeRaw);
    if (!qtyStrength) continue;

    let score = 0;
    if (lowQty === 10) score += 6;
    else if (lowQty >= 5 && lowQty <= 15) score += 3;
    else score -= 2;

    if (sizeNum > 0 && sizeNum <= 500) score += 5;
    if (sizeNum === 0) score -= 40;

    // Prefer leaving PickPoint "/1" unit on the strength side.
    if (/\/1\s*$/.test(qtyStrength)) score += 25;
    if (/\/\s*$/.test(qtyStrength)) score -= 35;

    if (STRENGTH_UNIT_PATTERN.test(qtyStrength)) score += 8;
    if (
      /(?:MG|MCG|GM|G|ML|UG|%|PACK|U\/G)\s*$/i.test(qtyStrength) ||
      /\*\s*$/.test(qtyStrength) ||
      /ONLY\*\s*$/i.test(qtyStrength)
    ) {
      score += 12;
    }

    // Trailing bare digits usually means we ate part of size into strength.
    if (/\d\s*$/.test(qtyStrength) && !/\/1\s*$/.test(qtyStrength)) {
      score -= 6;
    }

    candidates.push({
      qtyStrength,
      size: formatSize(sizeRaw),
      lowQty,
      score,
    });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  // Fallback: integer size + 2-digit low qty
  const intEnd = beforeClass.match(/^(.*?)(\d+)(\d{2})$/);
  if (intEnd && intEnd[1]) {
    return {
      qtyStrength: intEnd[1],
      size: intEnd[2],
      lowQty: Number(intEnd[3]),
    };
  }

  return null;
}

function splitQtyAndStrength(
  qtyStrength: string
): { qty: number; strength: string } | null {
  const input = qtyStrength.trim();
  if (!input) return null;

  type Candidate = { qty: number; strength: string; score: number };
  const candidates: Candidate[] = [];

  for (let len = 1; len <= 3 && len < input.length; len += 1) {
    const qtyToken = input.slice(0, len);
    if (!/^\d+$/.test(qtyToken)) continue;

    const qty = Number(qtyToken);
    // Inventory counts are small; package sizes live in the size field.
    if (qty > 500) continue;

    let strength = input.slice(len).trim();
    if (!strength) continue;
    if (!STRENGTH_UNIT_PATTERN.test(strength) && !/;/.test(strength)) continue;

    let score = 0;
    if (qty <= 30) score += 10;
    if (qty <= 15) score += 5;
    if (/^[\d.;]/.test(strength)) score += 8;
    if (/^\d+(?:\.\d+)?\s*(?:MG|MCG|G|ML|%|UG|U\/G|PACK)/i.test(strength)) {
      score += 20;
    }
    if (/^\d+\s*\/\s*\d+/.test(strength)) score += 15;
    if (/^\d+\s*;/.test(strength) || /^;\s*\d+/.test(strength)) score += 20;
    if (/^\d+\.\d+/.test(strength)) score += 10;
    // Penalize strengths that look like they still include qty digits (leading zeros)
    if (/^0\d/.test(strength) && !/^\d+\.\d/.test(strength)) score -= 12;
    // Prefer not treating "90 MCG" as qty=1 + "090 MCG"
    if (/^0+\d/.test(strength)) score -= 8;

    candidates.push({ qty, strength, score });
  }

  // Qty can be 0 (out of stock) with strength starting immediately: "02.5 MG/..."
  if (/^0(?=[\d.])/.test(input)) {
    const strength = input.slice(1).trim();
    if (STRENGTH_UNIT_PATTERN.test(strength)) {
      candidates.push({ qty: 0, strength, score: 25 });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return {
    qty: candidates[0].qty,
    strength: normalizeStrength(candidates[0].strength),
  };
}

function resolveHighQty(
  highFromPdf: number,
  size: string,
  lowQty: number
): number {
  const sizeNum = Number(size);
  // PickPoint package-size high levels often equal the bottle count.
  if (Number.isFinite(sizeNum) && sizeNum >= 10 && sizeNum === Math.floor(sizeNum)) {
    return sizeNum;
  }
  if (highFromPdf >= lowQty && highFromPdf >= 5) return highFromPdf;
  return Math.max(lowQty, highFromPdf, 10);
}

function parseJasperRecord(
  segment: string,
  index: number,
  warnings: string[]
): Medication | null {
  // Collapse to a single line for field extraction, but keep enough spaces for names.
  let line = segment
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  line = line
    .replace(PAGE_NOISE_PATTERN, " ")
    .replace(HEADER_NOISE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();

  const ndcMatch = line.match(/^(\d{11})/);
  if (!ndcMatch) {
    warnings.push(`Skipped record ${index + 1}: no NDC found.`);
    return null;
  }

  const ndc = ndcMatch[1];
  const rest = line.slice(11);

  const classMatch = rest.match(CLASS_PATTERN);
  if (!classMatch || classMatch.index === undefined) {
    warnings.push(`Skipped NDC ${ndc}: could not find controlled-class field.`);
    return null;
  }

  const beforeClass = rest.slice(0, classMatch.index).trim();
  const className: Medication["class"] = /schedule/i.test(classMatch[1])
    ? "Schedule III-V"
    : "Uncontrolled";
  const afterClass = rest.slice(classMatch.index + classMatch[0].length).trim();

  // highQty $ cost name location
  const afterMatch = afterClass.match(/^(\d+)\s*\$\s*([\d.]+)\s*(.+)$/);
  if (!afterMatch) {
    warnings.push(`Skipped NDC ${ndc}: could not parse cost/name/location.`);
    return null;
  }

  const highFromPdf = Number(afterMatch[1]);
  const cost = Number(afterMatch[2]) || 0;
  let nameAndLoc = afterMatch[3].trim();

  const locMatch = nameAndLoc.match(LOCATION_END_PATTERN);
  if (!locMatch || locMatch.index === undefined) {
    warnings.push(`Skipped NDC ${ndc}: could not parse machine/drawer/row.`);
    return null;
  }

  const machine = Number(locMatch[1]) || 1;
  const drawer = locMatch[2].toUpperCase();
  const row = Number(locMatch[3]) || 1;
  const name = nameAndLoc
    .slice(0, locMatch.index)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (!name) {
    warnings.push(`Skipped NDC ${ndc}: missing drug name.`);
    return null;
  }

  const sizeLow = splitSizeAndLowQty(beforeClass);
  if (!sizeLow) {
    warnings.push(`Skipped NDC ${ndc}: could not parse size/low qty.`);
    return null;
  }

  const qtyStrength = splitQtyAndStrength(sizeLow.qtyStrength);
  if (!qtyStrength) {
    warnings.push(
      `Skipped NDC ${ndc}: could not split quantity/strength from "${sizeLow.qtyStrength}".`
    );
    return null;
  }

  const highQty = resolveHighQty(highFromPdf, sizeLow.size, sizeLow.lowQty);

  const partial = {
    ndc,
    name,
    strength: qtyStrength.strength,
    size: sizeLow.size || "1",
    class: className,
    categories: [] as string[],
    qty: qtyStrength.qty,
    lowQty: sizeLow.lowQty,
    highQty,
    machine,
    drawer,
    row,
    cost,
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
  const records = splitJasperRecords(normalized);

  if (records.length === 0) {
    throw new Error(
      "No medications found in the PDF. Make sure you uploaded a PickPoint inventory report with NDC numbers."
    );
  }

  const medications: Medication[] = [];
  const seenIds = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    const med = parseJasperRecord(records[index], index, warnings);
    if (!med) continue;

    if (seenIds.has(med.id)) {
      warnings.push(
        `Duplicate location for ${med.name} (${med.ndc}); keeping first entry.`
      );
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
