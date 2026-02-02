"use client";

import ReactMarkdown from "react-markdown";
import clsx from "clsx";

type MarkdownContentProps = {
  content: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

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

export function MarkdownContent({
  content,
  className,
  size = "md",
}: MarkdownContentProps) {
  const s = sizeScale[size];

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
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx("text-white underline hover:text-white/80", s.p)}
            >
              {children}
            </a>
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
        {content}
      </ReactMarkdown>
    </div>
  );
}