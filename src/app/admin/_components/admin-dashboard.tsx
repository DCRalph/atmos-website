"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CrewManager } from "./crew-manager";
import { ContentManager } from "./content-manager";
import { GigsManager } from "./gigs-manager";
import { MerchManager } from "./merch-manager";
import { ContactManager } from "./contact-manager";


export function AdminDashboard() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex gap-4">
          <h1 className="text-4xl font-bold text-foreground">Atmos Admin</h1>
          <p className="text-muted-foreground self-end">Logged in as: <span className="font-bold">Admin</span></p>
        </div>

        <Tabs defaultValue="crew" className="space-y-4">
          <TabsList>
            <TabsTrigger value="crew">Crew</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="gigs">Gigs</TabsTrigger>
            <TabsTrigger value="merch">Merch</TabsTrigger>
            <TabsTrigger value="contact">Contact Submissions</TabsTrigger>
          </TabsList>

          <TabsContent value="crew">
            <CrewManager />
          </TabsContent>

          <TabsContent value="content">
            <ContentManager />
          </TabsContent>

          <TabsContent value="gigs">
            <GigsManager />
          </TabsContent>

          <TabsContent value="merch">
            <MerchManager />
          </TabsContent>

          <TabsContent value="contact">
            <ContactManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

