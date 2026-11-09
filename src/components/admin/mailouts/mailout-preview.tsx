"use client";

import { useMemo, useState } from "react";

import { cn } from "~/lib/utils";
import { buildMediaUrl } from "~/lib/media-url";
import {
  personalise,
  renderMailout,
  type MailoutContent,
} from "~/lib/mailouts/render";
import { SITE_URL } from "~/lib/seo-constants";
import { CONTACT } from "~/lib/site-constants";
import { Button } from "~/components/ui/button";

/**
 * The email as it will arrive, at phone or desktop width. A draft is drawn
 * here from what is on screen, with the same renderer the send uses; a sent
 * one shows the HTML that went.
 */
export function MailoutPreview({
  html,
  draft,
}: {
  html?: string | null;
  draft?: MailoutContent & {
    slug: string;
    imageFileId: string | null;
    listNames: string[];
  };
}) {
  const [width, setWidth] = useState<"phone" | "desktop">("phone");
  const doc = useMemo(() => {
    if (html) return personalise({ html, text: "" }, "#").html;
    if (!draft) return "";
    const email = renderMailout(
      {
        ...draft,
        imageUrl: draft.imageFileId ? buildMediaUrl(draft.imageFileId) : null,
      },
      {
        siteUrl: SITE_URL,
        slug: draft.slug,
        listNames: draft.listNames,
        contactEmail: CONTACT.email,
      },
    );
    return personalise(email, "#").html;
  }, [html, draft]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Preview
        </p>
        <div className="flex gap-1">
          {(["phone", "desktop"] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={width === option ? "secondary" : "ghost"}
              onClick={() => setWidth(option)}
            >
              {option === "phone" ? "Phone" : "Desktop"}
            </Button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-black">
        <iframe
          title="Email preview"
          srcDoc={doc}
          sandbox=""
          className={cn(
            "mx-auto block h-[720px] border-0",
            width === "phone" ? "w-[375px] max-w-full" : "w-full min-w-[640px]",
          )}
        />
      </div>
    </div>
  );
}
