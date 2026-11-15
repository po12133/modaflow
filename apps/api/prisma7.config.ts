import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma does not load .env files automatically. When running the CLI locally
// (outside Docker), load the monorepo root .env (or apps/api/.env if present).
// Inside Docker the variables come from the container environment.
for (const file of [".env", "../../.env"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
