"use client";

import { useState } from "react";

import { api } from "~/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { PassDesignField } from "~/components/admin/ticketing/pass-design-field";
import {
  parsePassDesign,
  resolveTicketPassDesign,
  type PassDesign,
} from "~/lib/ticketing/pass-design";
import type { EventDraftState } from "./use-event-draft";

const EVENT_TAB = "event";

/**
 * How the event's wallet passes look. Part of the draft.
 *
 * One tab for the event's own design, then one per access level for anything
 * tickets at that level should do differently here. A level tab inherits from
 * the level's own design (set on the access levels page), then from this event.
 */
export function WalletSection({ state }: { state: EventDraftState }) {
  const { draft, update, isSaving } = state;
  const [tab, setTab] = useState(EVENT_TAB);
  const { data: allLevels = [] } = api.accessLevels.list.useQuery({
    includeArchived: true,
  });

  const { levels: overrides = {}, ...eventLayer } = draft.passDesign;
  const hasOverride = (code: string) =>
    Object.keys(overrides[code] ?? {}).length > 0;
  // Archived levels only while something here still styles them, so an
  // override can always be seen and cleared.
  const levels = allLevels.filter(
    (level) => !level.archived || hasOverride(level.code),
  );
  const maxRank = Math.max(1, ...allLevels.map((level) => level.rank));
  const level = levels.find((row) => row.code === tab);
  const levelLayer = parsePassDesign(level?.passDesign);

  const setEventLayer = (next: PassDesign) =>
    update("passDesign", { ...next, levels: overrides });
  const setLevelLayer = (code: string, next: PassDesign) =>
    update("passDesign", {
      ...eventLayer,
      levels: { ...overrides, [code]: next },
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet pass</CardTitle>
        <CardDescription>
          Apple Wallet styling, for every ticket or per access level. Saving
          pushes the new look to passes already on phones.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={level ? tab : EVENT_TAB} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value={EVENT_TAB}>
                All tickets
                {Object.keys(eventLayer).length > 0 && <SetDot />}
              </TabsTrigger>
              {levels.map((row) => (
                <TabsTrigger key={row.code} value={row.code}>
                  {row.label}
                  {hasOverride(row.code) && <SetDot />}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <button
            type="button"
            disabled={isSaving}
            onClick={() =>
              level ? setLevelLayer(level.code, {}) : setEventLayer({})
            }
            className="inline-flex min-h-9 items-center text-xs text-white/50 underline underline-offset-4 hover:text-white lg:min-h-0"
          >
            {level
              ? `Clear ${level.label} changes`
              : "Reset to Atmos house style"}
          </button>
        </div>

        {level ? (
          <PassDesignField
            key={level.code}
            value={overrides[level.code] ?? {}}
            onChange={(next) => setLevelLayer(level.code, next)}
            inherits={[
              { source: `from ${level.label} level`, design: levelLayer },
              { source: "from all tickets", design: eventLayer },
            ]}
            eventName={draft.name}
            chip={
              resolveTicketPassDesign(draft.passDesign, {
                ...level,
                passDesign: levelLayer,
              }).chip
            }
            intensity={level.rank / maxRank}
            showChipControl
            disabled={isSaving}
          />
        ) : (
          <PassDesignField
            key={EVENT_TAB}
            value={eventLayer}
            onChange={setEventLayer}
            inherits={[]}
            eventName={draft.name}
            chip={null}
            disabled={isSaving}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Marks a tab that sets something of its own. */
function SetDot() {
  return (
    <span
      className="size-1.5 rounded-full bg-current"
      aria-label="Customised"
      role="img"
    />
  );
}
