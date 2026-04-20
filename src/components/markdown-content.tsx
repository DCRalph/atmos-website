"use client";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import clsx from "clsx";

type MarkdownContentProps = {
  content: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const INSTAGRAM_PILL_TITLE = "instagram-pill";

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

function normalizeInstagramHref(target: string) {
  const trimmedTarget = target.trim();

  if (/^https?:\/\//i.test(trimmedTarget)) {
    try {
      const url = new URL(trimmedTarget);
      if (
        url.hostname === "instagram.com" ||
        url.hostname === "www.instagram.com"
      ) {
        return url.toString();
      }
    } catch {
      return null;
    }

    return null;
  }

  const handle = trimmedTarget.replace(/^@/, "").replace(/\/+$/, "");

  if (!/^[a-zA-Z0-9._]+$/.test(handle)) {
    return null;
  }

  return `https://instagram.com/${handle}`;
}

function transformInstagramPills(content: string) {
  return content.replace(
    /@\[(.+?)\]\((.+?)\)/g,
    (match, label: string, target: string) => {
      const href = normalizeInstagramHref(target);

      if (!href) {
        return match;
      }

      return `[${label}](${href} "${INSTAGRAM_PILL_TITLE}")`;
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
  const transformedContent = transformInstagramPills(content);

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
          a: ({ href, title, children }) => (
            title === INSTAGRAM_PILL_TITLE ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  "inline-flex items-center rounded-full border border-pink-400/40 bg-pink-500/10 font-semibold text-pink-100 no-underline transition-colors hover:border-pink-300/70 hover:bg-pink-500/20 hover:text-white",
                  pill.wrapper
                )}
              >
                <Image
                  src="/socials/instagram.png"
                  alt=""
                  aria-hidden="true"
                  width={16}
                  height={16}
                  className={clsx("shrink-0 object-contain", pill.icon)}
                />
                <span>{children}</span>
              </a>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx("text-white underline hover:text-white/80", s.p)}
              >
                {children}
              </a>
            )
          ),
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