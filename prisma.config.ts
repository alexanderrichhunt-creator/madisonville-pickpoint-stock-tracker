// Prisma config for CLI usage (migrations, studio, db push, etc.)
// We keep it minimal so it doesn't interfere with runtime PrismaClient initialization on platforms like Render.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
