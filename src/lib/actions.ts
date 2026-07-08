'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { SEED_MEDICATIONS, SEED_METADATA } from '@/data/seed-data'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { mapActivity, mapMedication, mapSuggestion } from '@/lib/db-mappers'

function isSharedMode(): boolean {
  return process.env.NEXT_PUBLIC_LOCAL_MODE !== 'true'
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set on the server. Add your Neon Postgres connection string on Render (same pattern as Branch Secretary Tool).'
    )
  }
  return url
}

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    throw new Error('Unauthorized: Admin access required')
  }
  return session.user
}

async function getSetting(key: string): Promise<string | undefined> {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value
}

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

async function loadAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.appSetting.findMany()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export type SharedBackendStatus = {
  mode: 'local' | 'shared'
  connected: boolean
  error?: string
  databaseConfigured: boolean
}

export async function getSharedBackendStatus(): Promise<SharedBackendStatus> {
  if (!isSharedMode()) {
    return { mode: 'local', connected: true, databaseConfigured: false }
  }

  const databaseConfigured = Boolean(process.env.DATABASE_URL)
  if (!databaseConfigured) {
    return {
      mode: 'shared',
      connected: false,
      databaseConfigured: false,
      error:
        'DATABASE_URL is not set on Render. Add your Neon Postgres connection string (same as Branch Secretary Tool).',
    }
  }

  try {
    requireDatabaseUrl()
    await prisma.$queryRaw`SELECT 1`
    return { mode: 'shared', connected: true, databaseConfigured: true }
  } catch (error) {
    return {
      mode: 'shared',
      connected: false,
      databaseConfigured: true,
      error:
        error instanceof Error
          ? error.message
          : 'Cannot connect to Neon Postgres. Check DATABASE_URL on Render.',
    }
  }
}

export async function refreshInventoryData() {
  if (!isSharedMode()) return null

  requireDatabaseUrl()
  await seedDatabaseIfEmpty()

  const [medications, activity, suggestions, settings] = await Promise.all([
    prisma.medication.findMany({ orderBy: { name: 'asc' } }),
    prisma.activityLog.findMany({ orderBy: { timestamp: 'desc' } }),
    prisma.suggestion.findMany({ orderBy: { requestedAt: 'desc' } }),
    loadAllSettings(),
  ])

  return {
    medications: medications.map(mapMedication),
    activity: activity.map(mapActivity),
    suggestions: suggestions.map(mapSuggestion),
    totalSlots: parseInt(settings.total_slots || '90', 10),
    dataAsOf: settings.data_as_of || SEED_METADATA.dataAsOf,
  }
}

export async function getMedications() {
  if (!isSharedMode()) return SEED_MEDICATIONS
  requireDatabaseUrl()
  const rows = await prisma.medication.findMany({ orderBy: { name: 'asc' } })
  return rows.map(mapMedication)
}

export async function getActivityLog() {
  if (!isSharedMode()) return []
  requireDatabaseUrl()
  const rows = await prisma.activityLog.findMany({ orderBy: { timestamp: 'desc' } })
  return rows.map(mapActivity)
}

export async function getSuggestions() {
  if (!isSharedMode()) return []
  requireDatabaseUrl()
  const rows = await prisma.suggestion.findMany({ orderBy: { requestedAt: 'desc' } })
  return rows.map(mapSuggestion)
}

export async function getAppSettings() {
  if (!isSharedMode()) {
    return { totalSlots: 90, dataAsOf: SEED_METADATA.dataAsOf }
  }
  requireDatabaseUrl()
  const settings = await loadAllSettings()
  return {
    totalSlots: parseInt(settings.total_slots || '90', 10),
    dataAsOf: settings.data_as_of || SEED_METADATA.dataAsOf,
  }
}

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
  requireDatabaseUrl()

  const id = `${data.ndc}-${data.machine}${data.drawer}${data.row}`
  const existing = await prisma.medication.findUnique({ where: { id } })
  if (existing) {
    throw new Error('A medication with this NDC and location already exists.')
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

  await setSetting('data_as_of', new Date().toISOString())
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
  requireDatabaseUrl()

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

  await setSetting('data_as_of', new Date().toISOString())
  revalidatePath('/')
  return true
}

export async function deleteMedication(id: string) {
  await requireAdmin()
  requireDatabaseUrl()

  await prisma.activityLog.deleteMany({ where: { medicationId: id } })
  await prisma.medication.delete({ where: { id } })
  await setSetting('data_as_of', new Date().toISOString())
  revalidatePath('/')
  return true
}

export async function dispense(medicationId: string, qty: number) {
  await requireAdmin()
  requireDatabaseUrl()

  const med = await prisma.medication.findUnique({ where: { id: medicationId } })
  if (!med || qty <= 0 || qty > med.qty) {
    throw new Error('Invalid dispense quantity or medication not found')
  }

  const remainingQty = med.qty - qty

  await prisma.$transaction([
    prisma.medication.update({
      where: { id: medicationId },
      data: { qty: remainingQty },
    }),
    prisma.activityLog.create({
      data: {
        medicationId,
        drugName: med.name,
        ndc: med.ndc,
        qtyDispensed: qty,
        remainingQty,
      },
    }),
  ])

  await setSetting('data_as_of', new Date().toISOString())
  revalidatePath('/')
  return true
}

export async function updateTotalSlots(newTotal: number) {
  await requireAdmin()
  requireDatabaseUrl()
  await setSetting('total_slots', newTotal.toString())
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
  requireDatabaseUrl()
  await prisma.suggestion.create({
    data: {
      name: data.name,
      strength: data.strength,
      ndc: data.ndc,
      suggestedCount: data.suggestedCount,
      notes: data.notes,
      requestedBy: data.requestedBy,
    },
  })
  revalidatePath('/')
  return true
}

export async function deleteSuggestion(id: string) {
  await requireAdmin()
  requireDatabaseUrl()
  await prisma.suggestion.delete({ where: { id } })
  revalidatePath('/')
  return true
}

export async function importInventory(data: unknown[], dataAsOf?: string) {
  await requireAdmin()
  requireDatabaseUrl()

  if (!Array.isArray(data)) {
    throw new Error('Invalid inventory file format.')
  }

  const records = data.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null
  )

  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.medication.deleteMany(),
    prisma.medication.createMany({
      data: records.map((item) => ({
        id: String(item.id),
        ndc: String(item.ndc),
        name: String(item.name),
        strength: String(item.strength),
        size: String(item.size),
        class: String(item.class || 'Uncontrolled'),
        categories: Array.isArray(item.categories) ? (item.categories as string[]) : [],
        qty: Number(item.qty ?? 0),
        lowQty: Number(item.lowQty ?? 10),
        highQty: Number(item.highQty ?? 10),
        machine: Number(item.machine ?? 1),
        drawer: String(item.drawer ?? 'A'),
        row: Number(item.row ?? 1),
        cost: Number(item.cost ?? 0),
      })),
    }),
  ])

  await setSetting('data_as_of', dataAsOf ?? new Date().toISOString())
  revalidatePath('/')
  return true
}

export async function resetToSeed() {
  await requireAdmin()
  requireDatabaseUrl()

  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.suggestion.deleteMany(),
    prisma.medication.deleteMany(),
    prisma.medication.createMany({
      data: SEED_MEDICATIONS.map((m) => ({
        id: m.id,
        ndc: m.ndc,
        name: m.name,
        strength: m.strength,
        size: m.size,
        class: m.class,
        categories: m.categories,
        qty: m.qty,
        lowQty: m.lowQty,
        highQty: m.highQty,
        machine: m.machine,
        drawer: m.drawer,
        row: m.row,
        cost: m.cost,
      })),
    }),
  ])

  await setSetting('total_slots', '90')
  await setSetting('data_as_of', SEED_METADATA.dataAsOf)
  revalidatePath('/')
  return true
}

export async function seedDatabaseIfEmpty() {
  requireDatabaseUrl()
  const count = await prisma.medication.count()
  if (count > 0) return false

  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.suggestion.deleteMany(),
    prisma.medication.createMany({
      data: SEED_MEDICATIONS.map((m) => ({
        id: m.id,
        ndc: m.ndc,
        name: m.name,
        strength: m.strength,
        size: m.size,
        class: m.class,
        categories: m.categories,
        qty: m.qty,
        lowQty: m.lowQty,
        highQty: m.highQty,
        machine: m.machine,
        drawer: m.drawer,
        row: m.row,
        cost: m.cost,
      })),
    }),
  ])

  await setSetting('total_slots', '90')
  await setSetting('data_as_of', SEED_METADATA.dataAsOf)
  return true
}

export async function ensureAdminUser() {
  if (!isSharedMode()) return true
  requireDatabaseUrl()

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'mpp2026'
  const hash = await getSetting('admin_password_hash')

  if (!hash) {
    await setSetting('admin_password_hash', await bcrypt.hash(initialPassword, 10))
  }

  const adminEmail = 'admin@pickpoint.local'
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Administrator',
        isAdmin: true,
      },
    })
  }

  return true
}
