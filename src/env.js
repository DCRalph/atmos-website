import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    BETTER_AUTH_SECRET: z.string(),

    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),

    // AWS / S3
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_REGION: z.string(),
    AWS_S3_BUCKET: z.string(),
    AWS_S3_ENDPOINT: z.string().optional(), // Optional custom endpoint (e.g., R2, MinIO)
    AWS_S3_ACL: z
      .enum(['private', 'public-read', 'public-read-write', 'authenticated-read'])
      .optional(),
    AWS_S3_PUBLIC_URL_BASE: z.string().url().optional(), // Optional CDN/public base URL
  },


  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },


  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,

    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_S3_ENDPOINT: process.env.AWS_S3_ENDPOINT,
    AWS_S3_ACL: process.env.AWS_S3_ACL,
    AWS_S3_PUBLIC_URL_BASE: process.env.AWS_S3_PUBLIC_URL_BASE,


  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
