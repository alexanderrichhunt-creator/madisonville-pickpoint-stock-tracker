import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // During Next.js build (page data collection) or when DATABASE_URL is missing,
  // return a proxy to prevent PrismaClient constructor errors (especially with "client" engine).
  if (!process.env.DATABASE_URL || process.env.NEXT_PHASE === 'phase-production-build') {
    return new Proxy({} as PrismaClient, {
      get(target, prop) {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          // Allow promise-like behavior if needed
          return undefined
        }
        throw new Error(
          'Prisma client not initialized. This is expected during build. DATABASE_URL must be set at runtime.'
        )
      },
    })
  }

  const client =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  return client
}

export const prisma = createPrismaClient()