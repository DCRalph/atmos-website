"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { ListsPanel } from "~/components/admin/mailouts/lists-panel";
import { MailoutsTable } from "~/components/admin/mailouts/mailouts-table";
import { SubscribersPanel } from "~/components/admin/mailouts/subscribers-panel";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useTabParam } from "~/hooks/use-tab-param";

/**
 * Marketing email: mailouts, the lists they go to, and the people on them.
 */
export default function MailoutsPage() {
  const router = useRouter();
  const tab = useTabParam(["mailouts", "lists", "subscribers"]);
  const create = api.mailouts.create.useMutation({
    onSuccess: ({ id }) => router.push(`/admin/mailouts/${id}`),
    onError: (error) => toast.error(error.message),
  });

  return (
    <AdminSection
      title="Mailouts"
      description="Email to your mailing lists. Everyone who gets one can unsubscribe from the link at the bottom."
      actions={
        tab.value === "mailouts" && (
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="size-4" aria-hidden /> New mailout
          </Button>
        )
      }
    >
      <Tabs {...tab}>
        <TabsList>
          <TabsTrigger value="mailouts">Mailouts</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
        </TabsList>
        <TabsContent value="mailouts" className="mt-6">
          <MailoutsTable />
        </TabsContent>
        <TabsContent value="lists" className="mt-6">
          <ListsPanel />
        </TabsContent>
        <TabsContent value="subscribers" className="mt-6">
          <SubscribersPanel />
        </TabsContent>
      </Tabs>
    </AdminSection>
  );
}
