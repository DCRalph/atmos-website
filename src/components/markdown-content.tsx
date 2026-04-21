"use client";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import clsx from "clsx";
import {
  SOCIAL_PLATFORMS,
  detectPlatformFromUrl,
  getPlatformFromPillTitle,
  type SocialPlatform,
} from "~/lib/social-pills";

type MarkdownContentProps = {
  content: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const SOCIAL_PILL_TITLES = new Set(SOCIAL_PLATFORMS.map((p) => p.pillTitle));

const sizeScale = {
  sm: {
    h1: "text-2xl",
    h2: "text-xl",
    h3: "text-lg",
    p: "text-sm",
    li: "text-sm",
    code: "text-xs",
    blockquote: "text-sm",
  },
  md: {
    h1: "text-3xl",
    h2: "text-2xl",
    h3: "text-xl",
    p: "text-base",
    li: "text-base",
    code: "text-sm",
    blockquote: "text-base",
  },
  lg: {
    h1: "text-4xl",
    h2: "text-3xl",
    h3: "text-2xl",
    p: "text-lg",
    li: "text-lg",
    code: "text-base",
    blockquote: "text-lg",
  },
} as const;

const pillScale = {
  sm: {
    wrapper: "gap-1 px-2.5 py-0.5 text-xs",
    icon: "h-3.5 w-3.5",
  },
  md: {
    wrapper: "gap-1.5 px-3 py-0.5 text-sm",
    icon: "h-4 w-4",
  },
  lg: {
    wrapper: "gap-2 px-3.5 py-1 text-base",
    icon: "h-4.5 w-4.5",
  },
} as const;

function resolvePillForTarget(target: string): {
  href: string;
  platform: SocialPlatform;
} | null {
  const trimmed = target.trim();
  if (!trimmed) return null;

  const platformFromUrl = detectPlatformFromUrl(trimmed);
  if (platformFromUrl) {
    return { href: trimmed, platform: platformFromUrl };
  }

  // Handles are ambiguous across platforms; assume Instagram for bare handles
  // to preserve historical behavior of @[name](handle) syntax.
  const instagram = SOCIAL_PLATFORMS.find((p) => p.id === "instagram");
  if (!instagram) return null;
  const normalized = instagram.normalizeInput(trimmed);
  if (!normalized) return null;
  return { href: normalized, platform: instagram };
}

function transformSocialPills(content: string) {
  return content.replace(
    /@\[(.+?)\]\((.+?)\)/g,
    (match, label: string, target: string) => {
      const resolved = resolvePillForTarget(target);
      if (!resolved) return match;
      return `[${label}](${resolved.href} "${resolved.platform.pillTitle}")`;
    }
  );
}

export function MarkdownContent({
  content,
  className,
  size = "md",
}: MarkdownContentProps) {
  const s = sizeScale[size];
  const pill = pillScale[size];
  const transformedContent = transformSocialPills(content);

  return (
    <div className={clsx("prose prose-invert max-w-none", className)}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className={clsx("mb-4 font-bold", s.h1)}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className={clsx("mb-3 font-bold", s.h2)}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className={clsx("mb-2 font-bold", s.h3)}>{children}</h3>
          ),
          p: ({ children }) => (
            <p className={clsx("mb-4 leading-relaxed text-white/90", s.p)}>
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul
              className={clsx(
                "mb-4 list-inside list-disc space-y-2 text-white/90",
                s.p
              )}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              className={clsx(
                "mb-4 list-inside list-decimal space-y-2 text-white/90",
                s.p
              )}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => <li className={clsx("ml-4", s.li)}>{children}</li>,
          a: ({ href, title, children }) => {
            const pillPlatform =
              title && SOCIAL_PILL_TITLES.has(title)
                ? getPlatformFromPillTitle(title) ??
                  (href ? detectPlatformFromUrl(href) : null)
                : null;
            if (pillPlatform) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clsx(
                    "inline-flex items-center rounded-full border font-semibold no-underline transition-colors",
                    pillPlatform.pillClassName,
                    pill.wrapper
                  )}
                >
                  <Image
                    src={pillPlatform.iconSrc}
                    alt=""
                    aria-hidden="true"
                    width={16}
                    height={16}
                    className={clsx("shrink-0 object-contain", pill.icon)}
                  />
                  <span>{children}</span>
                </a>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx("text-white underline hover:text-white/80", s.p)}
              >
                {children}
              </a>
            );
          },
          strong: ({ children }) => (
            <strong className={clsx("font-bold text-white", s.p)}>
              {children}
            </strong>
          ),
          em: ({ children }) => <em className={clsx("italic", s.p)}>{children}</em>,
          code: ({ children }) => (
            <code
              className={clsx(
                "rounded bg-white/10 px-1.5 py-0.5 font-mono",
                s.code
              )}
            >
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={clsx(
                "my-4 border-l-4 border-white/30 pl-4 text-white/80 italic",
                s.blockquote
              )}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {transformedContent}
      </ReactMarkdown>
    </div>
  );
}