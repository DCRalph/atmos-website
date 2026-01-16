import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { use } from "react";

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  let { message } = use(searchParams);
  message = message ?? "An authentication error occurred.";

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-black p-4 text-white">
      <Card className="w-full max-w-md border-white/20 bg-black/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-white">
            Authentication Error
          </CardTitle>
          <CardDescription className="text-white/60">
            There was an issue with your authentication request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">{message}</p>
          </div>
          <div className="flex gap-3">
            <Button
              asChild
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              <Link href="/login">Go to Login</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
