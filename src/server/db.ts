
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '~Prisma/client'
import { env } from "~/env";

const connectionString = `${env.DATABASE_URL}`

const createPrismaClient = () => {

  const adapter = new PrismaPg({ connectionString })

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
