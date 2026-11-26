"use client";

import { useState } from "react";

import { operationKey } from "~/lib/developer/snippets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ApiKeysPanel } from "./api-keys-panel";
import { ApiPlayground } from "./api-playground";
import { ApiReference } from "./api-reference";

type Tab = "keys" | "reference" | "playground";

/**
 * The Developer page: keys, the reference for using them, and a playground
 * to try them in. "Try it" on a reference page opens the playground on that
 * endpoint.
 */
export function DeveloperManager() {
  const [tab, setTab] = useState<Tab>("keys");
  const [tryOperation, setTryOperation] = useState<string | null>(null);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as Tab)}
      className="gap-4"
    >
      <TabsList>
        <TabsTrigger value="keys">Keys</TabsTrigger>
        <TabsTrigger value="reference">Reference</TabsTrigger>
        <TabsTrigger value="playground">Playground</TabsTrigger>
      </TabsList>
      <TabsContent value="keys">
        <ApiKeysPanel />
      </TabsContent>
      <TabsContent value="reference">
        <ApiReference
          onTry={(operation) => {
            setTryOperation(operationKey(operation));
            setTab("playground");
          }}
        />
      </TabsContent>
      {/* Kept mounted, so its key and history survive a look at the reference. */}
      <TabsContent
        value="playground"
        forceMount
        className="data-[state=inactive]:hidden"
      >
        <ApiPlayground operationKey={tryOperation} />
      </TabsContent>
    </Tabs>
  );
}
