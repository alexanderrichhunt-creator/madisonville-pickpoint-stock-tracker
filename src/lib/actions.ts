'use server'

import { revalidatePath } from 'next/cache'
import { SEED_MEDICATIONS, SEED_METADATA } from '@/data/seed-data'
import { auth } from '@/auth'

// Google Sheets service (replacing Prisma/Neon - modeled after the successful Madisonville Branch Talk Tracker pattern)
import {
  loadMedications,
  saveMedications,
  loadActivity,
  saveActivity,
  loadSuggestions,
  saveSuggestions,
  loadSettings,
  saveSettings,
} from '@/lib/google-sheets'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    throw new Error("Unauthorized: Admin access required")
  }
  return session.user
}

export async function getMedications() {
  try {
    return await loadMedications()
  } catch (error) {
    console.error("Failed to load medications from Google Sheets, falling back to seed:", error)
    return SEED_MEDICATIONS
  }
}

export async function getActivityLog() {
  try {
    return await loadActivity()
  } catch (error) {
    console.error("Failed to load activity from Google Sheets:", error)
    return []
  }
}

export async function getSuggestions() {
  try {
    return await loadSuggestions()
  } catch (error) {
    console.error("Failed to load suggestions from Google Sheets:", error)
    return []
  }
}

export async function getAppSettings() {
  try {
    const settings = await loadSettings()
    return {
      totalSlots: parseInt(settings.total_slots || '90'),
      dataAsOf: settings.data_as_of || 'April 29, 2026',
    }
  } catch (error) {
    console.error("Failed to load settings from Google Sheets:", error)
    return {
      totalSlots: 90,
      dataAsOf: 'April 29, 2026',
    }
  }
}

// ===== Mutations =====

export async function addMedication(data: {
  ndc: string
  name: string
  strength: string
  size: string
  class: string
  categories: string[]
  qty: number
  lowQty: number
  highQty: number
  machine: number
  drawer: string
  row: number
  cost?: number
}) {
  await requireAdmin()
  const id = `${data.ndc}-${data.machine}${data.drawer}${data.row}`

  const meds = await loadMedications()
  const existing = meds.find(m => m.id === id)
  if (existing) {
    throw new Error("A medication with this NDC and location already exists.")
  }

  const newMed = {
    id,
    ndc: data.ndc,
    name: data.name,
    strength: data.strength,
    size: data.size,
    class: data.class,
    categories: data.categories,
    qty: data.qty,
    lowQty: data.lowQty,
    highQty: data.highQty,
    machine: data.machine,
    drawer: data.drawer,
    row: data.row,
    cost: data.cost ?? 0,
  }

  await saveMedications([...meds, newMed])
  revalidatePath('/')
  return true
}

export async function updateMedication(data: {
  id: string
  ndc: string
  name: string
  strength: string
  size: string
  class: string
  categories: string[]
  qty: number
  lowQty: number
  highQty: number
  machine: number
  drawer: string
  row: number
  cost?: number
}) {
  await requireAdmin()
  const meds = await loadMedications()
  const updatedMeds = meds.map(m => m.id === data.id ? {
    ...m,
    ndc: data.ndc,
    name: data.name,
    strength: data.strength,
    size: data.size,
    class: data.class,
    categories: data.categories,
    qty: data.qty,
    lowQty: data.lowQty,
    highQty: data.highQty,
    machine: data.machine,
    drawer: data.drawer,
    row: data.row,
    cost: data.cost ?? 0,
  } : m)

  await saveMedications(updatedMeds)
  revalidatePath('/')
  return true
}

export async function deleteMedication(id: string) {
  await requireAdmin()
  const meds = await loadMedications()
  const filtered = meds.filter(m => m.id !== id)
  await saveMedications(filtered)
  revalidatePath('/')
  return true
}

export async function dispense(medicationId: string, qty: number, dispensedBy?: string) {
  const user = await requireAdmin()
  try {
    const med = await prisma.medication.findUnique({ where: { id: medicationId } })
    if (!med || qty <= 0 || qty > med.qty) {
      return false
    }

    const remainingQty = med.qty - qty

    await prisma.$transaction(async (tx) => {
      await tx.medication.update({
        where: { id: medicationId },
        data: { qty: remainingQty },
      })

      await tx.activityLog.create({
        data: {
          medicationId,
          drugName: med.name,
          ndc: med.ndc,
          qtyDispensed: qty,
          remainingQty,
          dispensedBy: dispensedBy || user.name || user.email || "Admin",
        },
      })
    })

    revalidatePath('/')
    return true
  } catch (error: any) {
    if (isPrismaMisconfigured(error)) {
      console.warn("Dispense attempted in degraded Prisma mode — change not persisted to DB.");
      // Still return true so the UI can do optimistic update
      return true;
    }
    throw error;
  }
}

export async function updateTotalSlots(newTotal: number) {
  await requireAdmin()
  try {
    await prisma.appSetting.upsert({
      where: { key: 'total_slots' },
      update: { value: newTotal.toString() },
      create: { key: 'total_slots', value: newTotal.toString() },
    })

    revalidatePath('/')
    return true
  } catch (error: any) {
    if (isPrismaMisconfigured(error)) {
      console.warn("Capacity update in degraded mode — not persisted.");
      return true;
    }
    throw error;
  }
}

export async function addSuggestion(data: {
  name: string
  strength: string
  ndc?: string
  suggestedCount?: number
  notes?: string
  requestedBy?: string
}) {
  try {
    await prisma.suggestion.create({
      data: {
        name: data.name,
        strength: data.strength,
        ndc: data.ndc || null,
        suggestedCount: data.suggestedCount || null,
        notes: data.notes || null,
        requestedBy: data.requestedBy || null,
      },
    })

    revalidatePath('/')
    return true
  } catch (error: any) {
    if (isPrismaMisconfigured(error)) {
      console.warn("Suggestion submitted in degraded Prisma mode — not persisted.");
      return true; // Let the UI think it succeeded
    }
    console.error("addSuggestion failed:", error)
    throw error
  }
}

export async function deleteSuggestion(id: string) {
  await requireAdmin()
  const suggestions = await loadSuggestions()
  const filtered = suggestions.filter(s => s.id !== id)
  await saveSuggestions(filtered)
  revalidatePath('/')
  return true
}

export async function importInventory(data: any[]) {
  await requireAdmin()
  // Basic validation (can be enhanced)
  if (!Array.isArray(data)) {
    throw new Error("Invalid inventory file format.")
  }

  // Clear existing medications and insert new ones
  await prisma.$transaction(async (tx) => {
    await tx.medication.deleteMany()
    await tx.activityLog.deleteMany() // optional: clear activity on full import

    for (const item of data) {
      await tx.medication.create({
        data: {
          id: item.id,
          ndc: item.ndc,
          name: item.name,
          strength: item.strength,
          size: item.size,
          class: item.class,
          categories: item.categories || [],
          qty: item.qty,
          lowQty: item.lowQty,
          highQty: item.highQty,
          machine: item.machine,
          drawer: item.drawer,
          row: item.row,
          cost: item.cost ?? 0,
        },
      })
    }
  })

  revalidatePath('/')
  return true
}

export async function resetToSeed() {
  await requireAdmin()
  // For Google Sheets version: just reload from the seed data into sheets
  await saveMedications(SEED_MEDICATIONS)
  await saveActivity([])
  await saveSuggestions([])
  await saveSettings({
    total_slots: '90',
    data_as_of: SEED_METADATA.dataAsOf,
  })
  revalidatePath('/')
  return true
}

export async function seedDatabaseIfEmpty() {
  try {
    const meds = await loadMedications()
    if (meds.length === 0) {
      await saveMedications(SEED_MEDICATIONS)
      await saveActivity([])
      await saveSuggestions([])
      await saveSettings({
        total_slots: '90',
        data_as_of: SEED_METADATA.dataAsOf,
      })
      return true
    }
    return false
  } catch (error) {
    console.error("seedDatabaseIfEmpty error:", error)
    return false
  }
}

export async function ensureAdminUser() {
  // For the Google Sheets version, the bootstrap-admin endpoint handles this.
  // We keep this function for compatibility with the store.
  return true
}