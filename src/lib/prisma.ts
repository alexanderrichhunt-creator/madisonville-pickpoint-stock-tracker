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

  try {
    const client =
      globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });

    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
    return client;
  } catch (err: any) {
    if (err.message?.includes('engine type "client"')) {
      console.error("FATAL RUNTIME ERROR: Prisma generated the wrong 'client' engine. The app will not work until you redeploy with PRISMA_CLIENT_ENGINE_TYPE=library + rm -rf node_modules in the build command and clear Render's build cache.");
      // Return a stub so the app doesn't completely 500 on every Prisma access
      return new Proxy({} as PrismaClient, {
        get() {
          throw new Error("Prisma is misconfigured (wrong engine type generated). Check build logs and redeploy with the correct command.");
        },
      });
    }
    throw err;
  }
}

export const prisma = createPrismaClient();