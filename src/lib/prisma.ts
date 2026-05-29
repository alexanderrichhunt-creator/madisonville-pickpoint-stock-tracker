import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // During Next.js build (static page data collection) or when DATABASE_URL
  // is not available, return a safe proxy to avoid "client engine" constructor errors.
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

  const client =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
  return client;
}

export const prisma = createPrismaClient();