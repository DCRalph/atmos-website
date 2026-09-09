"use client";

import { ExternalLink } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { GigExtraction } from "~/lib/gig-import/extraction";
import { segmentCaption } from "~/lib/gig-import/highlight";
import { cn } from "~/lib/utils";
import {
  captionMarks,
  MARKED_FIELDS,
  markerNumber,
  type MarkedField,
} from "./field-marks";

export type SourcePost = {
  permalink: string;
  username: string | null;
  caption: string;
  postedAt: string;
  images: { url: string; index: number }[];
};

/**
 * The post, as read.
 *
 * It sits beside the form for the whole of the review step and does not move,
 * because checking an extracted value means reading the line it came from. The
 * numbered highlights are the link between the two: the same number appears
 * against the field it filled.
 */
export function SourcePanel({
  post,
  extraction,
  /**
   * The draft's poster. The post's own image URL is not used: Instagram's CDN
   * is not a configured image host, and the poster is a copy of it anyway.
   */
  posterUrl,
  className,
}: {
  post: SourcePost;
  extraction: GigExtraction;
  posterUrl?: string | null;
  className?: string;
}) {
  const segments = segmentCaption(post.caption, captionMarks(extraction));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>The post</CardTitle>
        <CardDescription>
          Highlights show which line each field was read from.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <FaInstagram className="size-3.5" aria-hidden />
          <span className="text-foreground font-medium">
            {post.username ? `@${post.username}` : "Pasted caption"}
          </span>
          <span aria-hidden>&middot;</span>
          <time dateTime={post.postedAt}>
            {new Date(post.postedAt).toLocaleDateString("en-NZ", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </time>
          {post.permalink ? (
            <>
              <span aria-hidden>&middot;</span>
              <a
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground inline-flex items-center gap-1 underline"
              >
                Open on Instagram
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </>
          ) : null}
        </div>

        {posterUrl ? (
          <div className="border-border relative aspect-[4/5] w-full overflow-hidden rounded-lg border">
            <Image
              src={posterUrl}
              alt=""
              fill
              sizes="380px"
              className="object-cover"
            />
          </div>
        ) : null}

        <pre className="bg-background border-border max-h-96 overflow-auto rounded-lg border p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
          {segments.length === 0 ? (
            <span className="text-muted-foreground">
              The post has no caption. Everything was read from the image.
            </span>
          ) : (
            segments.map((segment, index) =>
              segment.field ? (
                <mark
                  key={index}
                  className={cn(
                    "rounded-sm bg-transparent underline decoration-2 underline-offset-4",
                    MARKED_FIELDS[segment.field].text,
                  )}
                >
                  {segment.text}
                  <FieldMarker field={segment.field} />
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )
          )}
        </pre>

        {extraction.unused.length > 0 ? (
          <div className="border-border border-t pt-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Read, but not used
            </p>
            <ul className="space-y-1.5">
              {extraction.unused.map((entry, index) => (
                <li key={index} className="text-xs">
                  <span className="font-mono">&ldquo;{entry.quote}&rdquo;</span>
                  <span className="text-muted-foreground"> {entry.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** The number badge that ties a caption run to the field it filled. */
export function FieldMarker({
  field,
  className,
}: {
  field: MarkedField;
  className?: string;
}) {
  return (
    <span
      aria-label={`${MARKED_FIELDS[field].label} came from here`}
      className={cn(
        "ml-1 inline-grid size-3.5 translate-y-px place-items-center rounded-[3px] align-middle font-sans text-[9px] font-bold",
        MARKED_FIELDS[field].chip,
        className,
      )}
    >
      {markerNumber(field)}
    </span>
  );
}
