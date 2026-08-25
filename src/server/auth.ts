import { betterAuth } from "better-auth";
import { env } from "~/env";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "~/server/db";
// import { createAuthMiddleware } from "better-auth/api";
// import { z } from "zod";
import { lastLoginMethod } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import {
  sendAccountDeletionEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "~/server/auth-emails";
import { anonymiseAndDeleteUser } from "~/server/account-deletion";

/**
 * The iOS bundle identifier, which is also the `aud` of every Sign in with
 * Apple identity token the app produces.
 *
 * Not an env var: it is a constant of the app, it is not a secret, and it has
 * to match `ios.bundleIdentifier` in `mobile/app.config.ts` exactly or every
 * Apple sign-in fails audience verification.
 */
const IOS_BUNDLE_ID = "nz.co.atmosmedia.app";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailVerification: {
    sendOnSignUp: true,
    // Straight into a signed-in session once confirmed — making somebody type
    // their password again immediately after proving they own the address is
    // friction with nothing behind it.
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        name: user.name || null,
        url,
      });
    },
  },
  emailAndPassword: {
    enabled: true,
    // Off until existing accounts are grandfathered — `emailVerified` defaults
    // to false and this site has never asked, so flipping it first would lock
    // out every current password user. Run
    // `bun prisma/backfill-email-verified.ts` (see the file's header), confirm
    // the count, then set this to `true`.
    requireEmailVerification: false,
    // Unverified users can still ask for a fresh link from the account screen.
    sendOnSignIn: false,
    /**
     * Forgotten passwords.
     *
     * The link lands on `/reset-password` on the website, for the app as well
     * as the browser: a reset has to work from the mail app on a handset that
     * may not have Atmos installed, and a web page is the only surface that is
     * always there.
     */
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name || null,
        url,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    /**
     * Sign in with Apple — native only.
     *
     * App Store Guideline 4.8 requires an equivalent privacy-preserving login
     * anywhere a third-party social login is offered, and the app offers
     * Google. So this exists for the app; the website keeps Google and email.
     *
     * Native-only is why there is no client secret here. The iOS app gets an
     * identity token straight from `expo-apple-authentication` and posts it to
     * `signIn.social({ provider: "apple", idToken })`, which better-auth
     * verifies against Apple's public keys with `appBundleIdentifier` as the
     * expected audience. No Services ID, no `.p8`, and no six-monthly client
     * secret JWT to forget to rotate.
     *
     * What it does need, once, outside this codebase: the "Sign In with Apple"
     * capability enabled on the App ID in the Apple Developer portal, and the
     * provisioning profiles regenerated afterwards.
     */
    apple: {
      clientId: IOS_BUNDLE_ID,
      appBundleIdentifier: IOS_BUNDLE_ID,
    },
  },
  /**
   * Delete my account — App Store Guideline 5.1.1(v).
   *
   * `deleteUser` rather than a tRPC mutation of our own so that better-auth
   * tears its own session and account rows down with it. The hook is where the
   * part it cannot know about happens: orders are financial records and have to
   * outlive the account, so they are detached and scrubbed rather than dropped.
   * See `anonymiseAndDeleteUser`.
   */
  user: {
    deleteUser: {
      enabled: true,
      /**
       * Confirmed by email rather than in the app.
       *
       * Not ceremony. Without it better-auth needs either the account password
       * — which an Apple or Google account does not have — or a session
       * created in the last day, and an app session restored out of SecureStore
       * is usually weeks old. Between them that would leave a good share of
       * accounts unable to delete themselves, which is exactly the failure
       * Guideline 5.1.1(v) exists to stop.
       *
       * It also means an unlocked handset in the wrong hands cannot destroy an
       * account without also holding the mailbox.
       */
      sendDeleteAccountVerification: async ({ user, url }) => {
        await sendAccountDeletionEmail({
          to: user.email,
          name: user.name || null,
          url,
        });
      },
      beforeDelete: async (user) => {
        await anonymiseAndDeleteUser(user.id);
      },
    },
  },
  // The mobile app has no cookie jar and comes back from OAuth through a deep
  // link, so its scheme has to be trusted explicitly.
  trustedOrigins: ["atmos://", "atmos://*"],
  plugins: [lastLoginMethod(), expo()],
  // hooks: {
  //   before: createAuthMiddleware(async (ctx) => {
  //     // Check for invites before allowing signup
  //     if (ctx.path === "/sign-up/email") {
  //       const signUpBodySchema = z.object({
  //         email: z.email(),
  //         name: z.string(),
  //       });
  //       const res = signUpBodySchema.safeParse(ctx.body);
  //       if (!res.success) {
  //         const errorMessage = encodeURIComponent("Invalid signup data. Please check your email and name.");
  //         throw ctx.redirect(`/auth-error?message=${errorMessage}`);
  //       }

  //       const { email } = res.data;
  //       const emailLower = email.toLowerCase();

  //       // Check if user already exists - if so, allow them to login (they've already accepted invite)
  //       const existingUser = await db.user.findUnique({
  //         where: { email: emailLower },
  //       });

  //       if (existingUser) {
  //         // User already exists, allow login without invite check
  //         return;
  //       }

  //       // Check if there's an active invite for this email
  //       const invite = await db.invite.findUnique({
  //         where: { email: emailLower },
  //       });

  //       if (!invite) {
  //         const errorMessage = encodeURIComponent("You must be invited to sign up. Please contact an administrator.");
  //         throw ctx.redirect(`/auth-error?message=${errorMessage}`);
  //       }

  //       if (invite.used) {
  //         const errorMessage = encodeURIComponent("This invite has already been used.");
  //         throw ctx.redirect(`/auth-error?message=${errorMessage}`);
  //       }
  //     }
  //   }),
  //   after: createAuthMiddleware(async (ctx) => {
  //     const newSession = ctx.context.newSession;

  //     // Check if this is a signup (new session created)
  //     // For email signup: path is "/sign-up/email"
  //     // For social signup: path is "/callback/:id" and newSession exists
  //     const isEmailSignup = ctx.path === "/sign-up/email";
  //     const isSocialSignup = ctx.path.startsWith("/callback/") && newSession?.user;

  //     if (!isEmailSignup && !isSocialSignup) {
  //       return;
  //     }

  //     if (!newSession?.user) {
  //       return;
  //     }

  //     // Get email from body (email signup) or from new session user (social signup)
  //     let email: string | undefined;

  //     if (isEmailSignup) {
  //       const signUpBodySchema = z.object({
  //         email: z.email(),
  //         name: z.string(),
  //       });
  //       const res = signUpBodySchema.safeParse(ctx.body);
  //       if (!res.success) {
  //         // If body parsing fails, try to get email from newSession
  //         email = newSession.user.email;
  //       } else {
  //         email = res.data.email;
  //       }
  //     } else if (isSocialSignup) {
  //       // For social signup, email comes from the OAuth provider response
  //       email = newSession.user.email;
  //     }

  //     if (!email) {
  //       // If we still don't have an email, something went wrong
  //       return;
  //     }

  //     const emailLower = email.toLowerCase();

  //     // Check if user already exists - if so, allow them to login (they've already accepted invite)
  //     // Note: For social signups, Better Auth may have just created the user, so we check by email
  //     // If a user with this email already exists and it's the same user, allow login
  //     const existingUser = await db.user.findUnique({
  //       where: { email: emailLower },
  //     });

  //     console.log("existingUser", existingUser);
  //     console.log("newSession.user", newSession.user);
  //     // If user already exists (same ID), check if it's an existing user or newly created
  //     if (existingUser && existingUser.id == newSession.user.id) {
  //       console.log("existingUser and newSession.user are the same");
  //       // For social signups, check if user was created more than 3 seconds ago
  //       // If so, it's an existing user logging in (allow without invite check)
  //       // If created recently, it's a new signup (need to check invite below)
  //       return;
  //     }

  //     // Check if there's an active invite for this email
  //     const invite = await db.invite.findUnique({
  //       where: { email: emailLower },
  //     });

  //     // For social signup, if no invite exists and this is a truly new user, delete the user and redirect to error page
  //     // Note: existingUser check here would be for a different user with same email (shouldn't happen normally)
  //     if (isSocialSignup && !invite) {
  //       await db.user.delete({
  //         where: { id: newSession.user.id },
  //       }).catch(() => {
  //         // Ignore errors if user deletion fails
  //       });
  //       const errorMessage = encodeURIComponent("You must be invited to sign up. Please contact an administrator.");
  //       throw ctx.redirect(`/auth-error?message=${errorMessage}`);
  //     }

  //     if (invite && !invite.used) {
  //       // Mark invite as used
  //       await db.invite.update({
  //         where: { id: invite.id },
  //         data: {
  //           used: true,
  //           usedAt: new Date(),
  //         },
  //       });

  //     } else if (invite?.used) {
  //       // Invite was already used - this shouldn't happen for email signup (caught in before hook)
  //       // but could happen for social signup
  //       await db.user.delete({
  //         where: { id: newSession.user.id },
  //       })

  //       const errorMessage = encodeURIComponent("This invite has already been used.");
  //       throw ctx.redirect(`/auth-error?message=${errorMessage}`);
  //     }
  //   }),
  // },
});
