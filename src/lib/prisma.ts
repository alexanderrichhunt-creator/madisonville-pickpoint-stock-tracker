import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Robust Prisma singleton that tolerates build-time evaluation of API routes
// (Next.js collects page data and may execute top-level imports without .env vars populated).
function createPrismaClient(): PrismaClient {
  try {
    const client = new PrismaClient()
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = client
    }
    return client
  } catch (err) {
    // Build-time or misconfigured env: return a stub that throws a clear message on first use.
    // Real usage at runtime (with DATABASE_URL) will use a fresh client on next request.
    console.warn("[prisma] PrismaClient construction deferred (likely build-time without DATABASE_URL)")
    const stub: any = new Proxy(
      {},
      {
        get() {
          throw new Error(
            "Prisma client not initialized. Ensure DATABASE_URL is present in .env.local at runtime."
          )
        },
      }
    )
    return stub as PrismaClient
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()