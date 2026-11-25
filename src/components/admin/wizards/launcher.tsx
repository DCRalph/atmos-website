"use client";

import Link from "next/link";

import { AdminSection } from "~/components/admin/admin-section";
import { WIZARD_GROUPS, WIZARDS, wizardHref } from "./catalog";

/**
 * "What do you need to do?": every wizard as a plain tile. For the people who
 * would rather not find the right field among thirty in the full editors.
 */
export function WizardLauncher() {
  return (
    <AdminSection
      title="Quick actions"
      subtitle="One job at a time, a few steps each. Everything is still in the full editors."
      maxWidth="max-w-4xl"
    >
      <div className="space-y-8">
        {WIZARD_GROUPS.map((group) => (
          <section key={group.title} className="space-y-3">
            <h2 className="text-muted-foreground text-sm font-medium">
              {group.title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.keys.map((key) => {
                const wizard = WIZARDS[key];
                const Icon = wizard.icon;
                return (
                  <Link
                    key={key}
                    href={wizardHref(key)}
                    className="bg-card border-border hover:bg-secondary/60 flex items-start gap-3 rounded-lg border p-4 transition-colors"
                  >
                    <Icon
                      className="text-muted-foreground mt-0.5 size-5 shrink-0"
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{wizard.title}</span>
                      <span className="text-muted-foreground block text-sm">
                        {wizard.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AdminSection>
  );
}
