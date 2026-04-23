"use client";

import { Home, Palette, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

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
            <p className="text-muted-foreground">
              Manage your creator profile, content, and social links.
            </p>
            <Button variant="outline" asChild>
              <Link href="/" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" /> Your profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Build a fully customizable profile page with music embeds,
                galleries, links, and more.
              </p>
              <Button asChild>
                <Link href="/dashboard/profile">Open profile builder</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" /> Themes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Create and customize themes for your profile, or browse public
                themes made by others.
              </p>
              <Button variant="outline" asChild>
                <Link href="/dashboard/themes">Manage themes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
