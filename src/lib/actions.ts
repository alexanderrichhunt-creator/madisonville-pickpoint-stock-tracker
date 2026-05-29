'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { SEED_MEDICATIONS, SEED_METADATA } from '@/data/seed-data'
import bcrypt from 'bcryptjs'
import { auth } from '@/auth'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    throw new Error("Unauthorized: Admin access required")
  }
  return session.user
}

export async function getMedications() {
  return prisma.medication.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getActivityLog() {
  return prisma.activityLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 100,
  })
}

export async function getSuggestions() {
  return prisma.suggestion.findMany({
    orderBy: { requestedAt: 'desc' },
  })
}

export async function getAppSettings() {
  const settings = await prisma.appSetting.findMany()
  const map: Record<string, any> = {}
  settings.forEach(s => {
    map[s.key] = s.value
  })
  return {
    totalSlots: parseInt(map.total_slots || '90'),
    dataAsOf: map.data_as_of || 'April 29, 2026',
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

  const existing = await prisma.medication.findUnique({ where: { id } })
  if (existing) {
    throw new Error("A medication with this NDC and location already exists.")
  }

  await prisma.medication.create({
    data: {
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
    },
  })

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
  await prisma.medication.update({
    where: { id: data.id },
    data: {
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
    },
  })

  revalidatePath('/')
  return true
}

export async function deleteMedication(id: string) {
  await requireAdmin()
  await prisma.medication.delete({ where: { id } })
  revalidatePath('/')
  return true
}

export async function dispense(medicationId: string, qty: number, dispensedBy?: string) {
  const user = await requireAdmin()
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
}

export async function updateTotalSlots(newTotal: number) {
  await requireAdmin()
  await prisma.appSetting.upsert({
    where: { key: 'total_slots' },
    update: { value: newTotal.toString() },
    create: { key: 'total_slots', value: newTotal.toString() },
  })

  revalidatePath('/')
  return true
}

export async function addSuggestion(data: {
  name: string
  strength: string
  ndc?: string
  suggestedCount?: number
  notes?: string
  requestedBy?: string
}) {
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
}

export async function deleteSuggestion(id: string) {
  await requireAdmin()
  await prisma.suggestion.delete({ where: { id } })
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
  return seedDatabaseFromOriginalData()
}

export async function seedDatabaseIfEmpty() {
  const count = await prisma.medication.count()
  if (count === 0) {
    return seedDatabaseFromOriginalData()
  }
  return false
}

async function seedDatabaseFromOriginalData() {
  await prisma.$transaction(async (tx) => {
    await tx.activityLog.deleteMany()
    await tx.medication.deleteMany()
    await tx.suggestion.deleteMany()

    // Re-insert all original medications
    for (const med of SEED_MEDICATIONS) {
      await tx.medication.create({
        data: {
          id: med.id,
          ndc: med.ndc,
          name: med.name,
          strength: med.strength,
          size: med.size,
          class: med.class,
          categories: med.categories,
          qty: med.qty,
          lowQty: med.lowQty,
          highQty: med.highQty,
          machine: med.machine,
          drawer: med.drawer,
          row: med.row,
          cost: med.cost,
        },
      })
    }

    // Reset settings
    await tx.appSetting.upsert({
      where: { key: 'total_slots' },
      update: { value: '90' },
      create: { key: 'total_slots', value: '90' },
    })

    await tx.appSetting.upsert({
      where: { key: 'data_as_of' },
      update: { value: JSON.stringify(SEED_METADATA.dataAsOf) },
      create: { key: 'data_as_of', value: JSON.stringify(SEED_METADATA.dataAsOf) },
    })

    // Ensure a default admin user exists for first-run login
    // Default credentials after first seed: username "admin" / password "mpp2026"
    // On first successful login with the initial password it will be upgraded to a bcrypt hash.
    const adminEmail = "admin@pickpoint.local"
    const existingAdmin = await tx.user.findUnique({ where: { email: adminEmail } })
    if (!existingAdmin) {
      await tx.user.create({
        data: {
          email: adminEmail,
          name: "Administrator",
          isAdmin: true,
        },
      })
    }
  })

  revalidatePath('/')
  return true
}

/**
 * Ensures at least one admin user exists (call on app start or manually).
 * Used by the auto-seed path.
 */
export async function ensureAdminUser() {
  const adminEmail = "admin@pickpoint.local"
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Administrator",
        isAdmin: true,
      },
    })
    return true
  }
  return false
}