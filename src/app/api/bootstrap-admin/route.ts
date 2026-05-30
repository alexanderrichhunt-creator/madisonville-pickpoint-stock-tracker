import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import {
  seedDatabaseIfEmpty,
  ensureAdminUser,
  refreshInventoryData,
} from '@/lib/actions'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          success: false,
          error: 'DATABASE_URL is not set on Render.',
          hint: 'Add your Neon Postgres connection string (same pattern as Branch Secretary Tool).',
        },
        { status: 500 }
      )
    }

    await prisma.$queryRaw`SELECT 1`
    const seeded = await seedDatabaseIfEmpty()
    await ensureAdminUser()

    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'mpp2026'
    const existingHash = await prisma.appSetting.findUnique({
      where: { key: 'admin_password_hash' },
    })
    if (!existingHash) {
      await prisma.appSetting.create({
        data: {
          key: 'admin_password_hash',
          value: await bcrypt.hash(initialPassword, 10),
        },
      })
    }

    const data = await refreshInventoryData()

    return NextResponse.json({
      success: true,
      message: 'Bootstrap complete.',
      seeded,
      medicationCount: data?.medications.length ?? 0,
      login: {
        username: 'admin',
        password: initialPassword,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to bootstrap'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
