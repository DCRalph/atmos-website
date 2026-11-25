"use client";

import Link from "next/link";
import { WandSparkles } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { WIZARDS, wizardHref, type WizardKey } from "./catalog";

const GIG_WIZARDS: WizardKey[] = [
  "lineup",
  "poster",
  "gig-basics",
  "announce",
  "sell-tickets",
  "after-night",
];

const EVENT_WIZARDS: WizardKey[] = [
  "ticket-types",
  "event-basics",
  "guest-list",
  "door-staff",
];

/**
 * The wizards for the gig or event on screen, from the full editor's header.
 * For anyone who lands in the big form and only wanted to do one thing.
 */
export function QuickActionsMenu(
  target: { gigId: string } | { eventId: string },
) {
  const keys = "gigId" in target ? GIG_WIZARDS : EVENT_WIZARDS;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <WandSparkles className="size-4" aria-hidden />
          Quick actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {keys.map((key) => {
          const wizard = WIZARDS[key];
          const Icon = wizard.icon;
          return (
            <DropdownMenuItem key={key} asChild>
              <Link href={wizardHref(key, target)}>
                <Icon className="size-4" aria-hidden />
                {wizard.title}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
