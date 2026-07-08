import { SEED_MEDICATIONS } from "@/data/seed-data";
import { CONDITION_CATEGORIES } from "@/lib/inventory-utils";
import { Medication } from "@/types/medication";

type DrugClass = Medication["class"];

export interface ClassificationResult {
  class: DrugClass;
  categories: string[];
  source: "ndc" | "name" | "keywords" | "default";
}

const CONTROLLED_PATTERNS = [
  /\bcodeine\b/i,
  /\btramadol\b/i,
  /\bhydrocodone\b/i,
  /\boxycodone\b/i,
  /\bmorphine\b/i,
  /\bfentanyl\b/i,
  /\btestosterone\b/i,
  /\bphentermine\b/i,
  /\bschedule\s*(?:iii|iv|v|3|4|5)\b/i,
  /\bc-?iii\b/i,
  /\bc-?iv\b/i,
  /\bc-?v\b/i,
];

const CATEGORY_RULES: { pattern: RegExp; categories: string[] }[] = [
  {
    pattern:
      /\b(albuterol|ipratropium|fluticasone|budesonide|montelukast|dulera|salmeterol|tiotropium|wixela|breo|symbicort|advair|combivent)\b/i,
    categories: ["Respiratory (Asthma/COPD)"],
  },
  {
    pattern:
      /\b(amoxicillin|azithromycin|cephalexin|ciprofloxacin|clindamycin|cefdinir|ceftriaxone|doxycycline|metronidazole|nitrofurantoin|ofloxacin|oseltamivir|sulfamethoxazole|trimethoprim|valacyclovir|penicillin|levofloxacin)\b/i,
    categories: ["Acute Infection"],
  },
  {
    pattern:
      /\b(metformin|glipizide|insulin|lantus|ozempic|mounjaro|semaglutide|tirzepatide|levothyroxine|synthroid|glimepiride|januvia|jardiance)\b/i,
    categories: ["Diabetes & Endocrine"],
  },
  {
    pattern:
      /\b(sertraline|fluoxetine|trazodone|duloxetine|venlafaxine|buspirone|gabapentin|hydroxyzine|tizanidine|promethazine|bupropion|escitalopram|citalopram|mirtazapine)\b/i,
    categories: ["Psych / Mental Health"],
  },
  {
    pattern:
      /\b(amlodipine|lisinopril|losartan|metoprolol|carvedilol|hydrochlorothiazide|clopidogrel|isosorbide|atenolol|valsartan|olmesartan|furosemide|spironolactone)\b/i,
    categories: ["Hypertension & Cardiovascular"],
  },
  {
    pattern:
      /\b(omeprazole|pantoprazole|lansoprazole|esomeprazole|docusate|bisacodyl|lactulose|linzess|lubiprostone|polyethylene glycol|magnesium citrate|famotidine|ondansetron)\b/i,
    categories: ["GI (Laxatives & Acid)"],
  },
  {
    pattern:
      /\b(ibuprofen|naproxen|meloxicam|ketorolac|acetaminophen|cyclobenzaprine|prednisone|methylprednisolone|diclofenac|celecoxib|indomethacin)\b/i,
    categories: ["Pain & Inflammation"],
  },
  {
    pattern: /\b(cetirizine|loratadine|diphenhydramine|fexofenadine|levocetirizine|montelukast)\b/i,
    categories: ["Allergy"],
  },
  {
    pattern:
      /\b(clotrimazole|mupirocin|hydrocortisone|triamcinolone|nystatin|betamethasone|miconazole|ketoconazole|permethrin|silver sulfadiazine)\b/i,
    categories: ["Dermatology & Topical"],
  },
];

function normalizeNdc(ndc: string): string {
  return ndc.replace(/\D/g, "");
}

function normalizeDrugName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLookups() {
  const byNdc = new Map<string, { class: DrugClass; categories: string[] }>();
  const byName = new Map<string, { class: DrugClass; categories: string[] }>();

  for (const med of SEED_MEDICATIONS) {
    const entry = { class: med.class, categories: [...med.categories] };
    byNdc.set(normalizeNdc(med.ndc), entry);
    byName.set(normalizeDrugName(med.name), entry);
  }

  return { byNdc, byName };
}

const { byNdc, byName } = buildLookups();

function findByName(name: string): { class: DrugClass; categories: string[] } | null {
  const normalized = normalizeDrugName(name);
  const exact = byName.get(normalized);
  if (exact) return exact;

  for (const [seedName, entry] of Array.from(byName.entries())) {
    if (normalized.includes(seedName) || seedName.includes(normalized)) {
      return entry;
    }
  }

  const firstToken = normalized.split(" ")[0];
  if (firstToken.length >= 5) {
    for (const [seedName, entry] of Array.from(byName.entries())) {
      if (seedName.startsWith(firstToken) || firstToken.startsWith(seedName.split(" ")[0])) {
        return entry;
      }
    }
  }

  return null;
}

function classifyByKeywords(name: string): string[] {
  const categories = new Set<string>();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) {
      rule.categories.forEach((cat) => categories.add(cat));
    }
  }
  return Array.from(categories);
}

function isControlled(name: string, pdfClass?: string): boolean {
  if (pdfClass) {
    const text = pdfClass.toLowerCase();
    if (text.includes("schedule") || text.includes("controlled") || /\bc-?i{1,3}v?\b/.test(text)) {
      return true;
    }
    if (text.includes("uncontrolled") || text.includes("otc")) {
      return false;
    }
  }

  return CONTROLLED_PATTERNS.some((pattern) => pattern.test(name));
}

function sanitizeCategories(categories: string[]): string[] {
  const valid = new Set<string>(CONDITION_CATEGORIES);
  const cleaned = categories.filter((cat) => valid.has(cat));
  return cleaned.length > 0 ? cleaned : ["Other"];
}

export function classifyDrug(
  name: string,
  ndc?: string,
  pdfClass?: string
): ClassificationResult {
  if (ndc) {
    const ndcMatch = byNdc.get(normalizeNdc(ndc));
    if (ndcMatch) {
      return {
        class: ndcMatch.class,
        categories: [...ndcMatch.categories],
        source: "ndc",
      };
    }
  }

  const nameMatch = findByName(name);
  if (nameMatch) {
    return {
      class: nameMatch.class,
      categories: [...nameMatch.categories],
      source: "name",
    };
  }

  const keywordCategories = classifyByKeywords(name);
  const drugClass: DrugClass = isControlled(name, pdfClass) ? "Schedule III-V" : "Uncontrolled";

  if (keywordCategories.length > 0) {
    return {
      class: drugClass,
      categories: sanitizeCategories(keywordCategories),
      source: "keywords",
    };
  }

  return {
    class: drugClass,
    categories: ["Other"],
    source: "default",
  };
}

export function enrichMedication(
  med: Omit<Medication, "id"> & { id?: string },
  options?: { preserveCategories?: boolean }
): Medication {
  const pdfClassHint =
    med.class === "Schedule III-V" ? "Schedule III-V" : undefined;
  const classification = classifyDrug(med.name, med.ndc, pdfClassHint);

  const hasCategories =
    options?.preserveCategories !== false &&
    Array.isArray(med.categories) &&
    med.categories.length > 0 &&
    !(med.categories.length === 1 && med.categories[0] === "Other");

  const resolvedClass =
    med.class === "Schedule III-V" || classification.class === "Schedule III-V"
      ? "Schedule III-V"
      : classification.class;

  return {
    ...med,
    id: med.id ?? "",
    class: resolvedClass,
    categories: hasCategories ? med.categories : classification.categories,
  } as Medication;
}

export function enrichMedications(medications: Medication[]): Medication[] {
  return medications.map((med) => enrichMedication(med));
}
