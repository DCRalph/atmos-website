import Link from "next/link";
import { use } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";

/**
 * Where the confirm link lands.
 *
 * better-auth does the verifying at `/api/auth/verify-email` and redirects
 * here, so this page only reports the outcome — it never holds the token and
 * has nothing to check. An expired or reused link comes back with `?error`.
 */
export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = use(searchParams);

  if (error) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center bg-black p-4 text-white">
        <Card className="w-full max-w-md border-white/20 bg-black/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              That link has expired
            </CardTitle>
            <CardDescription className="text-white/60">
              Confirmation links work once and last an hour.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/70">
              Sign in and ask for a new one from your account, and it will
              arrive in a few seconds.
            </p>
            <Button
              asChild
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-black p-4 text-white">
      <Card className="w-full max-w-md border-white/20 bg-black/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Email confirmed</CardTitle>
          <CardDescription className="text-white/60">
            You&apos;re signed in and your address is verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-sm text-emerald-300">
              Any tickets bought with this address are now linked to your
              account, and will show up in the Atmos app.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              asChild
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              <Link href="/">Go home</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link href="/gigs">See what&apos;s on</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
