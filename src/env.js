import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    DATABASE_URL: z.string().url(),
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
      .enum([
        "private",
        "public-read",
        "public-read-write",
        "authenticated-read",
      ])
      .optional(),
    AWS_S3_PUBLIC_URL_BASE: z.string().url().optional(), // Optional CDN/public base URL

    // SMTP
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),

    // Shopify
    SHOPIFY_STORE_DOMAIN: z.string(),
    SHOPIFY_PRIVATE_ACCESS_TOKEN: z.string(),
    SHOPIFY_COLLECTION_HANDLE: z.string().optional(),

    // Ticketing — Stripe
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_TERMINAL_LOCATION_ID: z.string().optional(),

    TICKET_QR_SECRET: z.string().optional(),

    PATRON_ID_SECRET: z.string().optional(),

    // Ticketing — email delivery
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM: z.string().optional(),

    // Ticketing — Apple Wallet
    APPLE_PASS_TYPE_ID: z.string().optional(),
    APPLE_TEAM_ID: z.string().optional(),
    /// PEM, base64-encoded so the newlines survive an env var.
    APPLE_PASS_CERT_PEM_BASE64: z.string().optional(),
    APPLE_PASS_KEY_PEM_BASE64: z.string().optional(),
    APPLE_PASS_KEY_PASSWORD: z.string().optional(),
    APPLE_WWDR_PEM_BASE64: z.string().optional(),

    // Ticketing — Google Wallet
    GOOGLE_WALLET_ISSUER_ID: z.string().optional(),
    GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: z.string().optional(),

    /// Shared secret for the Vercel cron endpoints.
    CRON_SECRET: z.string().optional(),

    /// Shared secret for the ntfy-compatible publish endpoint at
    /// `/api/notify`. Unset means the endpoint refuses everything — a
    /// notification channel that anyone can post to is a notification channel
    /// nobody reads.
    NOTIFY_TOKEN: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),

    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),

    NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN: z.string(),

    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,

    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,

    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_S3_ENDPOINT: process.env.AWS_S3_ENDPOINT,
    AWS_S3_ACL: process.env.AWS_S3_ACL,
    AWS_S3_PUBLIC_URL_BASE: process.env.AWS_S3_PUBLIC_URL_BASE,

    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,

    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,

    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN: process.env.NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN,
    SHOPIFY_PRIVATE_ACCESS_TOKEN: process.env.SHOPIFY_PRIVATE_ACCESS_TOKEN,
    SHOPIFY_COLLECTION_HANDLE: process.env.SHOPIFY_COLLECTION_HANDLE,

    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_TERMINAL_LOCATION_ID: process.env.STRIPE_TERMINAL_LOCATION_ID,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,

    TICKET_QR_SECRET: process.env.TICKET_QR_SECRET,
    PATRON_ID_SECRET: process.env.PATRON_ID_SECRET,

    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,

    APPLE_PASS_TYPE_ID: process.env.APPLE_PASS_TYPE_ID,
    APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
    APPLE_PASS_CERT_PEM_BASE64: process.env.APPLE_PASS_CERT_PEM_BASE64,
    APPLE_PASS_KEY_PEM_BASE64: process.env.APPLE_PASS_KEY_PEM_BASE64,
    APPLE_PASS_KEY_PASSWORD: process.env.APPLE_PASS_KEY_PASSWORD,
    APPLE_WWDR_PEM_BASE64: process.env.APPLE_WWDR_PEM_BASE64,

    GOOGLE_WALLET_ISSUER_ID: process.env.GOOGLE_WALLET_ISSUER_ID,
    GOOGLE_WALLET_SERVICE_ACCOUNT_JSON:
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON,

    CRON_SECRET: process.env.CRON_SECRET,
    NOTIFY_TOKEN: process.env.NOTIFY_TOKEN,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
