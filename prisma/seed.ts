import { PrismaClient } from '@prisma/client'
import { SEED_MEDICATIONS, SEED_METADATA } from '../src/data/seed-data'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables explicitly for the seed script
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clear existing data (for clean seed)
  await prisma.activityLog.deleteMany()
  await prisma.medication.deleteMany()
  await prisma.suggestion.deleteMany()
  await prisma.appSetting.deleteMany()

  // Seed medications
  for (const med of SEED_MEDICATIONS) {
    await prisma.medication.create({
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

  // Seed default settings
  await prisma.appSetting.createMany({
    data: [
      { key: 'total_slots', value: '90' },
      { key: 'data_as_of', value: JSON.stringify(SEED_METADATA.dataAsOf) },
    ],
  })

  // Ensure default admin user for Auth.js login (username "admin", initial password "mpp2026")
  const adminEmail = "admin@pickpoint.local"
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Administrator",
        isAdmin: true,
      },
    })
    console.log("Created default admin user (admin / mpp2026)")
  }

  console.log('Seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })