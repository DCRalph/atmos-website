import { db } from "~/server/db";

/**
 * Grandfather existing accounts before email verification is enforced.
 *
 *   bun prisma/backfill-email-verified.ts            # report only, writes nothing
 *   bun prisma/backfill-email-verified.ts --apply    # actually mark them
 *
 * ---------------------------------------------------------------------------
 * Why this only touches social accounts
 * ---------------------------------------------------------------------------
 * The point of requiring verification is that `tickets.mine` matches orders on
 * a *verified* email address. An unverified address is just a string somebody
 * typed, so matching on it would hand a stranger's tickets to anybody willing
 * to type their email.
 *
 * That means the tempting shortcut — "mark everyone who has logged in as
 * verified" — reopens the exact hole the flag was turned on to close. Someone
 * could have signed up months ago with an address they do not own, and nothing
 * in the login history proves otherwise.
 *
 * So only one group is safe to grandfather: users whose address was verified
 * by an identity provider. Google will not issue an ID token for an address the
 * account does not own, which is a real proof of control and the same one the
 * flag is asking for.
 *
 * Password users are deliberately left alone. They are not locked out — see
 * the runbook below — they simply have to confirm the address once, which is
 * the whole point.
 *
 * ---------------------------------------------------------------------------
 * Runbook
 * ---------------------------------------------------------------------------
 *  1. Run this without `--apply` and read the counts.
 *  2. Run it with `--apply`.
 *  3. Set `emailAndPassword.sendOnSignIn: true` in `src/server/auth.ts`, so an
 *     unverified user signing in is emailed a fresh link automatically. Deploy.
 *     Leave it a while — every returning password user quietly self-migrates.
 *  4. Set `emailAndPassword.requireEmailVerification: true`. Deploy.
 *
 * Doing 4 before 3 turns "check your email" into "you are locked out".
 */

/** Providers whose ID tokens constitute proof the user owns the address. */
const VERIFIED_BY_PROVIDER = ["google"];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const total = await db.user.count();
  const alreadyVerified = await db.user.count({
    where: { emailVerified: true },
  });

  // Users with a social account, still marked unverified.
  const candidates = await db.user.findMany({
    where: {
      emailVerified: false,
      accounts: { some: { providerId: { in: VERIFIED_BY_PROVIDER } } },
    },
    select: { id: true, email: true },
  });

  // Everyone else who is unverified — password-only. Reported, never touched.
  const passwordOnly = await db.user.count({
    where: {
      emailVerified: false,
      accounts: { none: { providerId: { in: VERIFIED_BY_PROVIDER } } },
    },
  });

  console.log("");
  console.log("  Users total ................. %d", total);
  console.log("  Already verified ............ %d", alreadyVerified);
  console.log("  Social, to grandfather ...... %d", candidates.length);
  console.log("  Password-only, left alone ... %d", passwordOnly);
  console.log("");

  if (passwordOnly > 0) {
    console.log(
      "  %d password user(s) will need to confirm their address once.",
      passwordOnly,
    );
    console.log(
      "  Turn on `sendOnSignIn` before `requireEmailVerification` so they",
    );
    console.log("  get a link automatically instead of a wall.");
    console.log("");
  }

  if (!apply) {
    console.log("  Dry run — nothing written. Re-run with --apply.");
    console.log("");
    return;
  }

  if (candidates.length === 0) {
    console.log("  Nothing to do.");
    console.log("");
    return;
  }

  const result = await db.user.updateMany({
    where: { id: { in: candidates.map((user) => user.id) } },
    data: { emailVerified: true },
  });

  console.log("  Marked %d user(s) verified.", result.count);
  console.log("");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
