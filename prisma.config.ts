import "dotenv/config";
import { defineConfig, env } from "prisma/config";

import { config } from "dotenv";
config({
  path: ".env.local",
  override: true,
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "src/prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
