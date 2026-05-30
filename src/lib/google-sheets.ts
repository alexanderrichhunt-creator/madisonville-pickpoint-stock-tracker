import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Types (we'll keep the existing ones)
import type { Medication } from '@/types/medication';
import type { ActivityEntry } from '@/types/activity';
import type { MedicationSuggestion } from '@/types/suggestion';

let doc: GoogleSpreadsheet | null = null;

async function getDoc(): Promise<GoogleSpreadsheet> {
  if (doc) return doc;

  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
  }

  let parsedCreds;
  try {
    parsedCreds = JSON.parse(credentials);
  } catch {
    // Support base64 encoded JSON (common on Render)
    parsedCreds = JSON.parse(Buffer.from(credentials, 'base64').toString('utf8'));
  }

  const serviceAccountAuth = new JWT({
    email: parsedCreds.client_email,
    key: parsedCreds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID environment variable is not set');
  }

  doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
  await doc.loadInfo();
  return doc;
}

async function getSheet(title: string, headers: string[]) {
  const document = await getDoc();
  let sheet = document.sheetsByTitle[title];

  if (!sheet) {
    sheet = await document.addSheet({ title, headerValues: headers });
  } else {
    await sheet.loadHeaderRow();
    // Ensure headers exist
    const currentHeaders = sheet.headerValues || [];
    if (currentHeaders.length === 0) {
      await sheet.setHeaderRow(headers);
    }
  }

  return sheet;
}

// ====================== MEDICATIONS ======================
const MEDICATION_HEADERS = [
  'id', 'ndc', 'name', 'strength', 'size', 'class', 'categories',
  'qty', 'lowQty', 'highQty', 'machine', 'drawer', 'row', 'cost'
];

export async function loadMedications(): Promise<Medication[]> {
  const sheet = await getSheet('Medications', MEDICATION_HEADERS);
  const rows = await sheet.getRows();

  return rows.map(row => ({
    id: row.get('id') || '',
    ndc: row.get('ndc') || '',
    name: row.get('name') || '',
    strength: row.get('strength') || '',
    size: row.get('size') || '',
    class: row.get('class') as Medication['class'] || 'Uncontrolled',
    categories: row.get('categories') ? row.get('categories').split('|') : [],
    qty: parseInt(row.get('qty') || '0', 10),
    lowQty: parseInt(row.get('lowQty') || '0', 10),
    highQty: parseInt(row.get('highQty') || '0', 10),
    machine: parseInt(row.get('machine') || '1', 10),
    drawer: row.get('drawer') || '',
    row: parseInt(row.get('row') || '1', 10),
    cost: parseInt(row.get('cost') || '0', 10),
  }));
}

export async function saveMedications(meds: Medication[]) {
  const sheet = await getSheet('Medications', MEDICATION_HEADERS);
  await sheet.clear();

  const rows = meds.map(m => ({
    id: m.id,
    ndc: m.ndc,
    name: m.name,
    strength: m.strength,
    size: m.size,
    class: m.class,
    categories: m.categories.join('|'),
    qty: m.qty,
    lowQty: m.lowQty,
    highQty: m.highQty,
    machine: m.machine,
    drawer: m.drawer,
    row: m.row,
    cost: m.cost,
  }));

  if (rows.length > 0) {
    await sheet.addRows(rows);
  }
}

// ====================== ACTIVITY ======================
const ACTIVITY_HEADERS = [
  'id', 'timestamp', 'medicationId', 'drugName', 'ndc', 'qtyDispensed', 'remainingQty'
];

export async function loadActivity(): Promise<ActivityEntry[]> {
  const sheet = await getSheet('Activity', ACTIVITY_HEADERS);
  const rows = await sheet.getRows();

  return rows.map(row => ({
    id: row.get('id') || '',
    timestamp: row.get('timestamp') || '',
    medicationId: row.get('medicationId') || '',
    drugName: row.get('drugName') || '',
    ndc: row.get('ndc') || '',
    qtyDispensed: parseInt(row.get('qtyDispensed') || '0', 10),
    remainingQty: parseInt(row.get('remainingQty') || '0', 10),
  }));
}

export async function saveActivity(activity: ActivityEntry[]) {
  const sheet = await getSheet('Activity', ACTIVITY_HEADERS);
  await sheet.clear();

  const rows = activity.map(a => ({
    id: a.id,
    timestamp: a.timestamp,
    medicationId: a.medicationId,
    drugName: a.drugName,
    ndc: a.ndc || '',
    qtyDispensed: a.qtyDispensed,
    remainingQty: a.remainingQty,
  }));

  if (rows.length > 0) {
    await sheet.addRows(rows);
  }
}

// ====================== SUGGESTIONS ======================
const SUGGESTION_HEADERS = [
  'id', 'name', 'strength', 'ndc', 'suggestedCount', 'notes', 'requestedBy', 'requestedAt'
];

export async function loadSuggestions(): Promise<MedicationSuggestion[]> {
  const sheet = await getSheet('Suggestions', SUGGESTION_HEADERS);
  const rows = await sheet.getRows();

  return rows.map(row => ({
    id: row.get('id') || '',
    name: row.get('name') || '',
    strength: row.get('strength') || '',
    ndc: row.get('ndc') || undefined,
    suggestedCount: row.get('suggestedCount') ? parseInt(row.get('suggestedCount'), 10) : undefined,
    notes: row.get('notes') || undefined,
    requestedBy: row.get('requestedBy') || undefined,
    requestedAt: row.get('requestedAt') || '',
  }));
}

export async function saveSuggestions(suggestions: MedicationSuggestion[]) {
  const sheet = await getSheet('Suggestions', SUGGESTION_HEADERS);
  await sheet.clear();

  const rows = suggestions.map(s => ({
    id: s.id,
    name: s.name,
    strength: s.strength,
    ndc: s.ndc || '',
    suggestedCount: s.suggestedCount ?? '',
    notes: s.notes || '',
    requestedBy: s.requestedBy || '',
    requestedAt: s.requestedAt,
  }));

  if (rows.length > 0) {
    await sheet.addRows(rows);
  }
}

// ====================== SETTINGS ======================
const SETTING_HEADERS = ['key', 'value'];

export async function loadSettings(): Promise<Record<string, string>> {
  const sheet = await getSheet('Settings', SETTING_HEADERS);
  const rows = await sheet.getRows();

  const settings: Record<string, string> = {};
  rows.forEach(row => {
    const key = row.get('key');
    const value = row.get('value');
    if (key) settings[key] = value || '';
  });

  return settings;
}

export async function saveSettings(settings: Record<string, string>) {
  const sheet = await getSheet('Settings', SETTING_HEADERS);
  await sheet.clear();

  const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
  if (rows.length > 0) {
    await sheet.addRows(rows);
  }
}
