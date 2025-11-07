"use client";

import ReactMarkdown from "react-markdown";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={`prose prose-invert max-w-none ${className ?? ""}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-3xl font-bold mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-bold mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-bold mb-2">{children}</h3>,
          p: ({ children }) => <p className="mb-4 text-white/90 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-2 text-white/90">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-2 text-white/90">{children}</ol>,
          li: ({ children }) => <li className="ml-4">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline hover:text-white/80"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-white/30 pl-4 italic text-white/80 my-4">
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

