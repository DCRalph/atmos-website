import { betterAuth } from "better-auth";
import { env } from "~/env";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "~/server/db";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      disableSignUp: true,
    },
  },

});