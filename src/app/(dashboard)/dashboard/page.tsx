"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="min-h-dvh bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Creator Dashboard</h1>
              <Badge variant="secondary">Beta</Badge>
            </div>
            <p className="text-muted-foreground">
              Manage your gigs, content, merch, and community — all in one place.
            </p>
          </div>
          <Button variant="outline" disabled className="shrink-0">
            Open Studio
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary),transparent_55%)]/15" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Coming soon
            </CardTitle>
            <CardDescription>
              We’re building a creator-first dashboard experience. Check back soon.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card/40 p-4">
                <p className="text-sm font-medium">Planned</p>
                <p className="text-sm text-muted-foreground mt-1">Gig management, drafts, analytics</p>
              </div>
              <div className="rounded-lg border border-border bg-card/40 p-4">
                <p className="text-sm font-medium">In progress</p>
                <p className="text-sm text-muted-foreground mt-1">Creator profile + publishing tools</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Want early access? We’ll enable features as they ship.
              </p>
              <Button disabled className="sm:w-auto">
                Request access
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

