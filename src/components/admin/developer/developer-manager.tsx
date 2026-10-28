"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ApiKeysPanel } from "./api-keys-panel";
import { ApiReference } from "./api-reference";

/** The Developer page: keys, and the reference for using them. */
export function DeveloperManager() {
  return (
    <Tabs defaultValue="keys" className="gap-4">
      <TabsList>
        <TabsTrigger value="keys">Keys</TabsTrigger>
        <TabsTrigger value="reference">Reference</TabsTrigger>
      </TabsList>
      <TabsContent value="keys">
        <ApiKeysPanel />
      </TabsContent>
      <TabsContent value="reference">
        <ApiReference />
      </TabsContent>
    </Tabs>
  );
}
