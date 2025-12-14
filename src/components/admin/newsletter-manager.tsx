"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Download } from "lucide-react";

export function NewsletterManager() {
  const [search, setSearch] = useState("");
  const { data: subscriptions, isLoading, refetch } = api.newsletter.getAll.useQuery(
    { search: search || undefined, includeRemoved: true },
  );
  const toggleRemoved = api.newsletter.toggleRemoved.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const exportToCSV = () => {
    if (!subscriptions || subscriptions.length === 0) {
      alert("No subscriptions to export");
      return;
    }

    // Create CSV header
    const headers = ["Email", "Subscribed Date", "Status"];
    const rows = subscriptions.map((sub) => [
      sub.email,
      sub.createdAt.toISOString(),
      sub.removed ? "Removed" : "Active",
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `newsletter-subscriptions-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Newsletter Subscriptions</CardTitle>
            <CardDescription>View and manage newsletter email subscriptions</CardDescription>
          </div>
          <Button onClick={exportToCSV} variant="outline" disabled={isLoading || !subscriptions || subscriptions.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Subscribed Date</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`loading-${i}`}>
                  <TableCell colSpan={3}>
                    <div className="h-8 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))
            ) : subscriptions?.map((subscription) => (
              <TableRow key={subscription.id}>
                <TableCell className="font-medium">{subscription.email}</TableCell>
                <TableCell>{subscription.createdAt.toLocaleDateString()}</TableCell>
                <TableCell>
                  <Switch
                    checked={!subscription.removed}
                    onCheckedChange={(checked) => {
                      toggleRemoved.mutate({
                        id: subscription.id,
                        removed: !checked,
                      });
                    }}
                    disabled={toggleRemoved.isPending}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && subscriptions?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {search ? "No subscriptions found" : "No subscriptions yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
