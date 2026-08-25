import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";

/**
 * Where the "delete my account" link lands once it has done its work.
 *
 * better-auth deletes at `/api/auth/delete-user/callback` and redirects here,
 * so this page only reports the outcome — it holds no token and has nothing to
 * check.
 *
 * It says what was kept as well as what went, because "deleted" on its own is
 * the kind of half-answer that gets a support email: somebody who still holds a
 * ticket to next Saturday needs to know it still works.
 */
export default function AccountDeletedPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-black p-4 text-white">
      <Card className="w-full max-w-md border-white/20 bg-black/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Account deleted</CardTitle>
          <CardDescription className="text-white/60">
            Your name, email and contact details are gone, along with any
            newsletter subscription and every signed-in device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-white/70">
            Tickets you have already bought still work at the door — scan the QR
            code in your confirmation email or your wallet pass as usual. The
            orders behind them stay on our books without your details attached,
            because we are required to keep sales records.
          </p>
          <p className="text-sm text-white/70">
            You can sign out of the Atmos app now. Buying again will make a new
            account.
          </p>
          <Button
            asChild
            variant="outline"
            className="w-full border-white/20 text-white hover:bg-white/10"
          >
            <Link href="/">Go home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
