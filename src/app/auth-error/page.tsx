import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  let { message } = await searchParams;
  message = message ?? "An authentication error occurred.";

  return (
    <main className="relative min-h-dvh flex items-center justify-center bg-black text-white p-4">
      <Card className="w-full max-w-md bg-black/50 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Authentication Error</CardTitle>
          <CardDescription className="text-white/60">
            There was an issue with your authentication request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-sm text-red-400">{message}</p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10">
              <Link href="/login">Go to Login</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10">
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

