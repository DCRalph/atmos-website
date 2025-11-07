import { betterAuth } from "better-auth";
import { env } from "~/env";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "~/server/db";
import { createAuthMiddleware } from "better-auth/api";
import { z } from "zod";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false, // Enable signup but control via hooks
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      disableSignUp: false, // Enable signup but control via hooks
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Check for invites before allowing signup
      if (ctx.path === "/sign-up/email") {
        const signUpBodySchema = z.object({
          email: z.string(),
          name: z.string(),
        });
        const res = signUpBodySchema.safeParse(ctx.body);
        if (!res.success) {
          const errorMessage = encodeURIComponent("Invalid signup data. Please check your email and name.");
          throw ctx.redirect(`/auth-error?message=${errorMessage}`);
        }

        const { email } = res.data;


        // Check if there's an active invite for this email
        const invite = await db.invite.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!invite) {
          const errorMessage = encodeURIComponent("You must be invited to sign up. Please contact an administrator.");
          throw ctx.redirect(`/auth-error?message=${errorMessage}`);
        }

        if (invite.used) {
          const errorMessage = encodeURIComponent("This invite has already been used.");
          throw ctx.redirect(`/auth-error?message=${errorMessage}`);
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;

      // Check if this is a signup (new session created)
      // For email signup: path is "/sign-up/email"
      // For social signup: path is "/callback/:id" and newSession exists
      const isEmailSignup = ctx.path === "/sign-up/email";
      const isSocialSignup = ctx.path.startsWith("/callback/") && newSession?.user;

      if (!isEmailSignup && !isSocialSignup) {
        return;
      }

      if (!newSession?.user) {
        return;
      }

      // Get email from body (email signup) or from new session user (social signup)
      let email: string | undefined;

      if (isEmailSignup) {
        const signUpBodySchema = z.object({
          email: z.string().email(),
          name: z.string(),
        });
        const res = signUpBodySchema.safeParse(ctx.body);
        if (!res.success) {
          // If body parsing fails, try to get email from newSession
          email = newSession.user.email;
        } else {
          email = res.data.email;
        }
      } else if (isSocialSignup) {
        // For social signup, email comes from the OAuth provider response
        email = newSession.user.email;
      }

      if (!email) {
        // If we still don't have an email, something went wrong
        return;
      }

      const emailLower = email.toLowerCase();

      // Check if there's an active invite for this email
      const invite = await db.invite.findUnique({
        where: { email: emailLower },
      });

      // For social signup, if no invite exists, delete the user and redirect to error page
      if (isSocialSignup && !invite) {
        await db.user.delete({
          where: { id: newSession.user.id },
        }).catch(() => {
          // Ignore errors if user deletion fails
        });
        const errorMessage = encodeURIComponent("You must be invited to sign up. Please contact an administrator.");
        throw ctx.redirect(`/auth-error?message=${errorMessage}`);
      }

      if (invite && !invite.used) {
        // Mark invite as used
        await db.invite.update({
          where: { id: invite.id },
          data: {
            used: true,
            usedAt: new Date(),
          },
        });

        // Set user role from invite
        await db.user.update({
          where: { id: newSession.user.id },
          data: {
            role: invite.role as "USER" | "CREATOR" | "ADMIN",
          },
        });
      } else if (invite?.used) {
        // Invite was already used - this shouldn't happen for email signup (caught in before hook)
        // but could happen for social signup
        await db.user.delete({
          where: { id: newSession.user.id },
        }).catch(() => {
          // Ignore errors if user deletion fails
        });
        const errorMessage = encodeURIComponent("This invite has already been used.");
        throw ctx.redirect(`/auth-error?message=${errorMessage}`);
      }
    }),
  },
});