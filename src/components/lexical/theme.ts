export const LEXICAL_THEME = {
  paragraph: "mb-2 leading-relaxed text-foreground",
  heading: {
    h1: "text-5xl font-bold mb-4 mt-5 text-foreground tracking-tight",
    h2: "text-3xl font-bold mb-3 mt-4 text-foreground tracking-tight",
    h3: "text-2xl font-bold mb-2 mt-3 text-foreground",
    h4: "text-lg font-bold mb-2 mt-3 text-foreground",
  },
  list: {
    ul: "list-disc ml-6 mb-2 space-y-1",
    ol: "list-decimal ml-6 mb-2 space-y-1",
    listitem: "text-foreground",
    nested: {
      listitem: "list-none",
    },
  },
  link: "text-primary underline underline-offset-2 hover:opacity-80",
  quote: "border-l-4 border-border pl-3 italic text-muted-foreground my-2",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "rounded bg-muted px-1 py-0.5 font-mono text-sm",
  },
  code: "block rounded bg-muted p-3 font-mono text-sm my-2 overflow-x-auto",
};
