"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

/** Make an artist page: pick a handle, then edit the page in place. */
export function DashboardProfileView() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const create = api.artistProfiles.ensureMine.useMutation({
    onSuccess: (profile) => router.push(`/artist/${profile.handle}?edit`),
  });

  return (
    <div className="bg-background min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Make your artist page</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate({ handle: handle || undefined });
              }}
            >
              <p className="text-muted-foreground text-sm">
                Pick the address for your page. You can change it later.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">/@</span>
                <Input
                  value={handle}
                  onChange={(e) =>
                    setHandle(e.target.value.toLowerCase().replace(/\s/g, "-"))
                  }
                  placeholder="your-handle"
                  aria-label="Handle"
                />
              </div>
              {create.error ? (
                <p className="text-destructive text-sm">
                  {create.error.message}
                </p>
              ) : null}
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Make my page
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
