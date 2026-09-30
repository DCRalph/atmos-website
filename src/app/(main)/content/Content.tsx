"use client";

import { useState } from "react";
import { SiteSelect } from "~/components/site/inputs";
import { PageTitle, Skeleton } from "~/components/site/ui";
import {
  baseKinds,
  channels,
  ContentEmpty,
  ContentError,
  ContentNoResults,
  CoverCard,
  CoverDialog,
  KindFilter,
  kindLabel,
  toEntry,
} from "~/components/site/content/content-kit";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

/** Content: a record-shop cover grid with type and platform filters; a cover opens its player in a dialog. */
export default function ContentPage() {
  const { data, isLoading, isError, refetch } = api.content.getAll.useQuery();
  const [kind, setKind] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = data?.map(toEntry) ?? [];
  const kinds = [...new Set([...baseKinds, ...entries.map((e) => e.kind)])];
  const platformOptions = [
    ...new Map(
      entries.flatMap((e) =>
        e.platformKey && e.platformLabel
          ? [[e.platformKey, e.platformLabel] as const]
          : [],
      ),
    ),
  ].map(([value, label]) => ({ value, label }));
  const shown = entries.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (platform === "all" || e.platformKey === platform),
  );
  const platformName = platformOptions.find((p) => p.value === platform)?.label;
  const clear = () => {
    setKind("all");
    setPlatform("all");
  };

  return (
    <main className="pb-20">
      <PageTitle
        title="Content"
        intro="Releases, mixes and highlights from the Atmos community."
      >
        <div className="mt-8 flex flex-wrap gap-2">
          {channels.map(({ key, label, Icon, href }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="t-label inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-[10px] text-white/80 transition-colors hover:border-white hover:text-white"
            >
              <Icon className="size-4" /> {label}
            </a>
          ))}
        </div>
      </PageTitle>

      <div className="px-5 md:px-10" aria-busy={isLoading}>
        {entries.length ? (
          <div className="mb-8 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
            <KindFilter
              entries={entries}
              kinds={kinds}
              value={kind}
              onChange={setKind}
              className="min-w-0 flex-[2]"
            />
            {platformOptions.length > 1 ? (
              <div className="w-full sm:w-[220px]">
                <SiteSelect
                  label="Platform"
                  value={platform}
                  onValueChange={setPlatform}
                  options={[
                    { value: "all", label: "All platforms" },
                    ...platformOptions,
                  ]}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 border-t border-white/10 pt-6 sm:gap-x-4 lg:grid-cols-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden
                className={cn(
                  "space-y-3",
                  i === 0 && "col-span-2 lg:row-span-2",
                )}
              >
                <Skeleton className="aspect-square" />
                <Skeleton className="h-5 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-1/2 rounded-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <ContentError onRetry={() => void refetch()} />
        ) : entries.length === 0 ? (
          <ContentEmpty />
        ) : shown.length === 0 ? (
          <ContentNoResults
            body={`No ${kind === "all" ? "items" : kindLabel(kind, true).toLowerCase()}${platformName ? ` on ${platformName}` : ""} yet.`}
            onClear={clear}
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-4 lg:grid-cols-4">
            {shown.map((e, n) => (
              <CoverCard
                key={e.id}
                entry={e}
                featured={n === 0 && kind === "all" && platform === "all"}
                onOpen={() => setOpenId(e.id)}
              />
            ))}
          </div>
        )}
      </div>

      <CoverDialog
        entry={entries.find((e) => e.id === openId)}
        onClose={() => setOpenId(null)}
      />
    </main>
  );
}
