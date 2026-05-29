import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Global flag so the UI can show a clear "Degraded Mode" banner
export let isDegradedMode = false;

function createPrismaClient() {
  // During build or when DATABASE_URL is missing, return a safe proxy
  const isBuild =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    !process.env.DATABASE_URL;

  if (isBuild) {
    return new Proxy({} as PrismaClient, {
      get() {
        throw new Error(
          'Prisma client not initialized during build. This is expected.'
        );
      },
    });
  }

  try {
    // Use the Postgres adapter so the "client" engine works with standard Postgres/Neon
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);

    const client =
      globalForPrisma.prisma ??
      new PrismaClient({ adapter });

    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
    isDegradedMode = false;
    return client;
  } catch (err: any) {
    console.error("Prisma client initialization error:", err);

    if (err.message?.includes('engine type "client"') || err.message?.includes('Prisma is misconfigured')) {
      isDegradedMode = true;
      console.error("Prisma is in DEGRADED MODE due to wrong engine type. Real database writes will not work.");
      // Return a stub that allows the app to function in memory
      return new Proxy({} as PrismaClient, {
        get() {
          throw new Error("Prisma is misconfigured (wrong engine type generated). Changes will not be saved until this is fixed.");
        },
      });
    }

    throw err;
  }
}

export const prisma = createPrismaClient();