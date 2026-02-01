"use client";

import { Home } from "lucide-react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="bg-background min-h-dvh px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Creator Dashboard
              </h1>
              <Badge variant="secondary">Beta</Badge>
            </div>
            <p className="text-muted-foreground">Comming soon</p>
            <Button variant="outline">
              <Link href="/" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
