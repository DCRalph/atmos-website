"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $isLinkNode,
  TOGGLE_LINK_COMMAND,
  LinkNode,
  type LinkNode as LinkNodeType,
} from "@lexical/link";
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingNode,
  QuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
  ListItemNode,
} from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code-core";
import {
  SocialPillLinkNode,
  SOCIAL_PILL_LINK_REPLACEMENT,
} from "~/components/admin/social-pill-node";
import {
  $setBlocksType,
  $patchStyleText,
  $getSelectionStyleValueForProperty,
} from "@lexical/selection";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type BaseSelection,
  type ElementFormatType,
  type EditorState,
  type LexicalEditor,
  type SerializedEditorState,
  type TextFormatType,
} from "lexical";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Code,
  Eraser,
  ExternalLink,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Italic,
  Link2,
  List as ListIcon,
  ListOrdered,
  Palette,
  Pencil,
  Quote,
  Redo2,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
} from "lucide-react";
import Image from "next/image";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import {
  SOCIAL_PLATFORMS,
  detectPlatformFromUrl,
  getPlatform,
  getPlatformFromPillTitle,
  resolvePillPlatform,
  type SocialPlatform,
  type SocialPlatformId,
} from "~/lib/social-pills";

/** Shared Lexical node set used by the editor and `LexicalContent`. */
export const LEXICAL_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  SocialPillLinkNode,
  SOCIAL_PILL_LINK_REPLACEMENT,
  CodeNode,
  CodeHighlightNode,
];

type FontFamilyOption = {
  id: string;
  label: string;
  stack: string;
};

const FONT_FAMILIES: FontFamilyOption[] = [
  {
    id: "sans",
    label: "Sans serif",
    stack:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "serif",
    label: "Serif",
    stack: 'Georgia, Cambria, "Times New Roman", Times, serif',
  },
  {
    id: "script",
    label: "Script",
    stack:
      '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive',
  },
  {
    id: "display",
    label: "Display",
    stack:
      'Impact, "Arial Black", "Helvetica Neue", Haettenschweiler, "Franklin Gothic Bold", sans-serif',
  },
  {
    id: "mono",
    label: "Mono",
    stack:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
];

type ColorPreset = {
  label: string;
  value: string;
};

const COLOR_PRESETS: ColorPreset[] = [
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Yellow", value: "#eab308" },
  { label: "Lime", value: "#84cc16" },
  { label: "Green", value: "#22c55e" },
  { label: "Emerald", value: "#10b981" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Fuchsia", value: "#d946ef" },
  { label: "Pink", value: "#ec4899" },
  { label: "Rose", value: "#f43f5e" },
  { label: "White", value: "#ffffff" },
  { label: "Gray", value: "#9ca3af" },
  { label: "Black", value: "#000000" },
];

function findFontFamilyMatch(raw: string): FontFamilyOption | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/\s+/g, "");
  for (const f of FONT_FAMILIES) {
    const stackNormalized = f.stack.toLowerCase().replace(/\s+/g, "");
    if (normalized === stackNormalized) return f;
    const firstFamily = f.stack
      .split(",")[0]
      ?.trim()
      .replace(/^["']|["']$/g, "")
      .toLowerCase();
    if (firstFamily && raw.toLowerCase().includes(firstFamily)) return f;
  }
  return null;
}

const theme = {
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

function PlatformIcon({
  platform,
  size = 16,
  className,
}: {
  platform: SocialPlatform;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={platform.iconSrc}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "h-8 w-8",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </Button>
  );
}

function ToolbarSeparator() {
  return <span className="bg-border mx-1 h-6 w-px" aria-hidden />;
}

type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "quote"
  | "ul"
  | "ol";

type LinkDialogMode = "standard" | SocialPlatformId;

type OpenLinkDialogState = {
  open: true;
  selection: BaseSelection | null;
  initialMode: LinkDialogMode;
  initialUrl: string;
  /** Platform-specific input values keyed by platform id. */
  initialSocialInputs: Partial<Record<SocialPlatformId, string>>;
  initialText: string;
  initialHasLink: boolean;
};

type LinkDialogState = { open: false } | OpenLinkDialogState;

function buildLinkDialogStateFromLinkNode(
  linkNode: LinkNodeType,
  selection: BaseSelection | null,
): OpenLinkDialogState {
  const existingUrl = linkNode.getURL() ?? "";
  const existingTitle = linkNode.getTitle() ?? "";
  const platform = resolvePillPlatform(existingUrl, existingTitle);
  const socialInputs: Partial<Record<SocialPlatformId, string>> = {};
  if (platform) {
    const handle = platform.extractHandle(existingUrl);
    socialInputs[platform.id] = handle || existingUrl;
  }
  return {
    open: true,
    selection,
    initialMode: platform ? platform.id : "standard",
    initialUrl: platform ? "" : existingUrl,
    initialSocialInputs: socialInputs,
    initialText: linkNode.getTextContent(),
    initialHasLink: true,
  };
}

type Toolbarprops = {
  onRequestLinkDialog: (state: Extract<LinkDialogState, { open: true }>) => void;
};

function Toolbar({ onRequestLinkDialog }: Toolbarprops) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [blockType, setBlockType] = useState<BlockType>("paragraph");
  const [align, setAlign] = useState<ElementFormatType>("");
  const [fontFamilyRaw, setFontFamilyRaw] = useState<string>("");
  const [fontColor, setFontColor] = useState<string>("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    setIsBold(selection.hasFormat("bold"));
    setIsItalic(selection.hasFormat("italic"));
    setIsUnderline(selection.hasFormat("underline"));
    setIsStrikethrough(selection.hasFormat("strikethrough"));
    setIsCode(selection.hasFormat("code"));

    const anchorNode = selection.anchor.getNode();
    const element =
      anchorNode.getKey() === "root"
        ? anchorNode
        : $findMatchingParent(anchorNode, (e) => {
            const parent = e.getParent();
            return parent !== null && $isRootOrShadowRoot(parent);
          }) ?? anchorNode.getTopLevelElementOrThrow();

    const linkParent = $findMatchingParent(anchorNode, $isLinkNode);
    setIsLink(Boolean(linkParent));

    if ($isElementNode(element)) {
      setAlign(element.getFormatType() ?? "");
    } else {
      setAlign("");
    }

    setFontFamilyRaw(
      $getSelectionStyleValueForProperty(selection, "font-family", ""),
    );
    setFontColor(
      $getSelectionStyleValueForProperty(selection, "color", ""),
    );

    if ($isListNode(element)) {
      const type = element.getListType();
      setBlockType(type === "number" ? "ol" : "ul");
      return;
    }

    const type = element.getType();
    if (type === "heading") {
      const tag = (element as unknown as { getTag: () => HeadingTagType }).getTag();
      setBlockType(tag as BlockType);
      return;
    }
    if (type === "quote") {
      setBlockType("quote");
      return;
    }
    setBlockType("paragraph");
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(updateToolbar);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }, [editor, updateToolbar]);

  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode());
      }
    });
  };

  const formatHeading = (tag: HeadingTagType) => {
    if (blockType === tag) {
      formatParagraph();
      return;
    }
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(tag));
      }
    });
  };

  const formatQuote = () => {
    if (blockType === "quote") {
      formatParagraph();
      return;
    }
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  };

  const toggleUnorderedList = () => {
    if (blockType === "ul") {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    }
  };

  const toggleOrderedList = () => {
    if (blockType === "ol") {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  const setAlignment = (value: ElementFormatType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, value);
  };

  const applyStyle = (styles: Record<string, string | null>) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      $patchStyleText(selection, styles);
    });
  };

  const setFontFamily = (stack: string) => {
    applyStyle({ "font-family": stack });
  };

  const clearFontFamily = () => {
    applyStyle({ "font-family": null });
  };

  const setTextColor = (color: string) => {
    applyStyle({ color });
  };

  const clearTextColor = () => {
    applyStyle({ color: null });
  };

  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const formats: TextFormatType[] = [
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "code",
        "subscript",
        "superscript",
        "highlight",
      ];
      for (const format of formats) {
        if (selection.hasFormat(format)) {
          selection.formatText(format);
        }
      }
      $patchStyleText(selection, {
        "font-family": null,
        color: null,
        "background-color": null,
      });
      if (blockType !== "paragraph") {
        $setBlocksType(selection, () => $createParagraphNode());
      }
    });
  };

  const activeFontFamily = findFontFamilyMatch(fontFamilyRaw);

  const openLinkDialog = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        onRequestLinkDialog({
          open: true,
          selection: null,
          initialMode: "standard",
          initialUrl: "",
          initialSocialInputs: {},
          initialText: "",
          initialHasLink: false,
        });
        return;
      }
      const anchorNode = selection.anchor.getNode();
      const linkNode = $findMatchingParent(
        anchorNode,
        $isLinkNode,
      ) as LinkNodeType | null;
      const clonedSelection = selection.clone();
      if (linkNode) {
        onRequestLinkDialog(
          buildLinkDialogStateFromLinkNode(linkNode, clonedSelection),
        );
        return;
      }
      onRequestLinkDialog({
        open: true,
        selection: clonedSelection,
        initialMode: "standard",
        initialUrl: "",
        initialSocialInputs: {},
        initialText: selection.getTextContent(),
        initialHasLink: false,
      });
    });
  };

  return (
    <div className="bg-muted/40 border-input flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 p-1">
      <ToolbarButton
        title="Undo"
        disabled={!canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        disabled={!canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        title="Bold"
        active={isBold}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={isItalic}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={isUnderline}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
      >
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        active={isStrikethrough}
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")
        }
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Inline code"
        active={isCode}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        title="Heading 1"
        active={blockType === "h1"}
        onClick={() => formatHeading("h1")}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 2"
        active={blockType === "h2"}
        onClick={() => formatHeading("h2")}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        active={blockType === "h3"}
        onClick={() => formatHeading("h3")}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 4"
        active={blockType === "h4"}
        onClick={() => formatHeading("h4")}
      >
        <Heading4 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        title="Bulleted list"
        active={blockType === "ul"}
        onClick={toggleUnorderedList}
      >
        <ListIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        active={blockType === "ol"}
        onClick={toggleOrderedList}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Quote"
        active={blockType === "quote"}
        onClick={formatQuote}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        title="Align left"
        active={align === "left" || align === "" || align === "start"}
        onClick={() => setAlignment("left")}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Align center"
        active={align === "center"}
        onClick={() => setAlignment("center")}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Align right"
        active={align === "right" || align === "end"}
        onClick={() => setAlignment("right")}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Justify"
        active={align === "justify"}
        onClick={() => setAlignment("justify")}
      >
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <FontFamilyPopover
        active={activeFontFamily}
        onSelect={setFontFamily}
        onClear={clearFontFamily}
      />
      <TextColorPopover
        activeColor={fontColor}
        onSelect={setTextColor}
        onClear={clearTextColor}
      />
      <ToolbarSeparator />
      <ToolbarButton
        title={isLink ? "Edit link" : "Insert link"}
        active={isLink}
        onClick={openLinkDialog}
      >
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Clear formatting" onClick={clearFormatting}>
        <Eraser className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

type FontFamilyPopoverProps = {
  active: FontFamilyOption | null;
  onSelect: (stack: string) => void;
  onClear: () => void;
};

function FontFamilyPopover({
  active,
  onSelect,
  onClear,
}: FontFamilyPopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Font family"
          aria-label="Font family"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "h-8 gap-1.5 px-2 text-xs",
            active && "bg-accent text-accent-foreground",
          )}
        >
          <Type className="h-4 w-4" />
          <span className="hidden max-w-22 truncate sm:inline">
            {active?.label ?? "Font"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-1"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className={cn(
              "hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs",
              !active && "bg-accent text-accent-foreground",
            )}
          >
            <span className="text-muted-foreground">Default</span>
            {!active ? <Check className="h-3.5 w-3.5" /> : null}
          </button>
          <div className="bg-border my-1 h-px" aria-hidden />
          {FONT_FAMILIES.map((f) => {
            const isActive = active?.id === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onSelect(f.stack);
                  setOpen(false);
                }}
                className={cn(
                  "hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  isActive && "bg-accent text-accent-foreground",
                )}
                style={{ fontFamily: f.stack }}
              >
                <span>{f.label}</span>
                {isActive ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function normalizeColor(value: string): string {
  return value.trim().toLowerCase();
}

type TextColorPopoverProps = {
  activeColor: string;
  onSelect: (color: string) => void;
  onClear: () => void;
};

function TextColorPopover({
  activeColor,
  onSelect,
  onClear,
}: TextColorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [customColor, setCustomColor] = useState<string>(
    activeColor || "#ffffff",
  );

  useEffect(() => {
    if (activeColor) setCustomColor(activeColor);
  }, [activeColor]);

  const active = normalizeColor(activeColor);
  const matchedPreset = COLOR_PRESETS.find(
    (p) => normalizeColor(p.value) === active,
  );
  const swatchStyle = activeColor
    ? { backgroundColor: activeColor }
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Text color"
          aria-label="Text color"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "relative h-8 w-8",
            activeColor && "bg-accent text-accent-foreground",
          )}
        >
          <Palette className="h-4 w-4" />
          <span
            aria-hidden
            className="border-background absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full border"
            style={
              swatchStyle ?? {
                backgroundImage:
                  "linear-gradient(45deg, #ef4444 0 25%, #f59e0b 25% 50%, #22c55e 50% 75%, #3b82f6 75%)",
              }
            }
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-60 p-3"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Text color
            </span>
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Reset
            </button>
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {COLOR_PRESETS.map((preset) => {
              const isActive =
                matchedPreset?.value === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  onClick={() => {
                    onSelect(preset.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "ring-border hover:ring-foreground/40 relative h-5 w-5 rounded-full ring-1 transition-all",
                    isActive && "ring-foreground ring-2",
                  )}
                  style={{ backgroundColor: preset.value }}
                >
                  {isActive ? (
                    <Check
                      className={cn(
                        "absolute inset-0 m-auto h-3 w-3",
                        preset.value === "#ffffff" ||
                          preset.value === "#eab308" ||
                          preset.value === "#f59e0b"
                          ? "text-black"
                          : "text-white",
                      )}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Custom</span>
            <input
              type="color"
              value={customColor || "#ffffff"}
              onChange={(e) => {
                setCustomColor(e.target.value);
                onSelect(e.target.value);
              }}
              className="border-input h-7 w-10 cursor-pointer rounded border bg-transparent p-0"
            />
            <Input
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              onBlur={() => {
                if (/^#?[0-9a-fA-F]{3,8}$/.test(customColor)) {
                  const normalized = customColor.startsWith("#")
                    ? customColor
                    : `#${customColor}`;
                  onSelect(normalized);
                }
              }}
              placeholder="#ffffff"
              className="h-7 flex-1 font-mono text-xs"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type LinkDialogProps = {
  state: LinkDialogState;
  onClose: () => void;
};

function LinkDialog({ state, onClose }: LinkDialogProps) {
  const [editor] = useLexicalComposerContext();
  const [mode, setMode] = useState<LinkDialogMode>("standard");
  const [url, setUrl] = useState("");
  const [socialInputs, setSocialInputs] = useState<
    Partial<Record<SocialPlatformId, string>>
  >({});
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.open) return;
    setMode(state.initialMode);
    setUrl(state.initialUrl);
    setSocialInputs(state.initialSocialInputs);
    setText(state.initialText);
    setError(null);
  }, [state]);

  if (!state.open) return null;

  const hasLink = state.initialHasLink;
  const activePlatform: SocialPlatform | null =
    mode === "standard" ? null : getPlatform(mode);

  const setSocialInput = (id: SocialPlatformId, value: string) => {
    setSocialInputs((prev) => ({ ...prev, [id]: value }));
  };

  const fallbackDisplayText = (): string => {
    if (activePlatform) {
      const input = (socialInputs[activePlatform.id] ?? "").trim();
      if (!input) return activePlatform.name;
      if (/^https?:\/\//i.test(input)) {
        const normalized = activePlatform.normalizeInput(input);
        if (normalized) {
          const handle = activePlatform.extractHandle(normalized);
          if (handle) {
            return activePlatform.supportsHandleInput ? `@${handle}` : handle;
          }
        }
        return activePlatform.name;
      }
      const handle = input.replace(/^@/, "");
      return activePlatform.supportsHandleInput ? `@${handle}` : handle;
    }
    return url.trim();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let finalUrl: string;
    let title: string | null;

    if (activePlatform) {
      const rawInput = (socialInputs[activePlatform.id] ?? "").trim();
      if (!rawInput) {
        setError(`Enter a ${activePlatform.name} URL${
          activePlatform.supportsHandleInput ? " or handle" : ""
        }.`);
        return;
      }
      const normalized = activePlatform.normalizeInput(rawInput);
      if (!normalized) {
        setError(
          activePlatform.supportsHandleInput
            ? `Enter a ${activePlatform.name} handle or a valid ${activePlatform.hosts[0]} URL.`
            : `Enter a valid ${activePlatform.name} URL.`,
        );
        return;
      }
      finalUrl = normalized;
      title = activePlatform.pillTitle;
    } else {
      const trimmed = url.trim();
      if (!trimmed) {
        setError("URL is required.");
        return;
      }
      try {
        const parsed = new URL(trimmed);
        if (!/^https?:$/.test(parsed.protocol)) {
          setError("Only http and https URLs are supported.");
          return;
        }
        finalUrl = parsed.toString();
      } catch {
        setError("Enter a valid URL (e.g. https://example.com).");
        return;
      }
      title = null;
    }

    const typedText = text.trim();
    const displayText = typedText || fallbackDisplayText() || finalUrl;

    editor.update(() => {
      if (state.selection) {
        $setSelection(state.selection.clone());
      }
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const existingLink = $findMatchingParent(
        selection.anchor.getNode(),
        $isLinkNode,
      ) as LinkNodeType | null;

      if (existingLink) {
        existingLink.setURL(finalUrl);
        existingLink.setTitle(title);
        const currentText = existingLink.getTextContent();
        if (displayText && displayText !== currentText) {
          for (const child of existingLink.getChildren()) {
            child.remove();
          }
          existingLink.append($createTextNode(displayText));
        }
      } else {
        if (selection.isCollapsed()) {
          const node = $createTextNode(displayText);
          selection.insertNodes([node]);
          node.select(0, displayText.length);
        } else {
          const currentText = selection.getTextContent();
          if (typedText && typedText !== currentText) {
            selection.insertText(displayText);
            selection.anchor.offset -= displayText.length;
          }
        }
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
          url: finalUrl,
          title,
          target: null,
          rel: null,
        });
      }
    });

    onClose();
    requestAnimationFrame(() => editor.focus());
  };

  const handleRemove = () => {
    editor.update(() => {
      if (state.selection) {
        $setSelection(state.selection.clone());
      }
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    });
    onClose();
    requestAnimationFrame(() => editor.focus());
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{hasLink ? "Edit link" : "Insert link"}</DialogTitle>
          <DialogDescription>
            Pick a standard link or a social platform to render a branded
            pill on the public site.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setMode("standard")}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 rounded-md border p-3 text-xs font-medium transition-colors",
                mode === "standard"
                  ? "border-primary bg-primary/5 text-primary"
                  : "hover:bg-accent text-muted-foreground",
              )}
            >
              <Link2 className="h-5 w-5" />
              Standard
            </button>
            {SOCIAL_PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => setMode(platform.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-md border p-3 text-xs font-medium transition-colors",
                  mode === platform.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "hover:bg-accent text-muted-foreground",
                )}
              >
                <PlatformIcon platform={platform} size={20} className="h-5 w-5" />
                {platform.name}
              </button>
            ))}
          </div>

          {activePlatform ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`link-${activePlatform.id}`}>
                {activePlatform.supportsHandleInput
                  ? `${activePlatform.name} handle or URL`
                  : `${activePlatform.name} URL`}
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
                  <PlatformIcon
                    platform={activePlatform}
                    size={16}
                    className="h-4 w-4"
                  />
                </span>
                <Input
                  id={`link-${activePlatform.id}`}
                  value={socialInputs[activePlatform.id] ?? ""}
                  onChange={(e) =>
                    setSocialInput(activePlatform.id, e.target.value)
                  }
                  placeholder={activePlatform.inputPlaceholder}
                  className="pl-9"
                  autoFocus
                />
              </div>
              {activePlatform.inputHelp ? (
                <p className="text-muted-foreground text-xs">
                  {activePlatform.inputHelp}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                autoFocus
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="link-text">Display text</Label>
            <Input
              id="link-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                activePlatform
                  ? activePlatform.supportsHandleInput
                    ? "@atmos"
                    : activePlatform.name
                  : "Link text shown to readers"
              }
            />
            <p className="text-muted-foreground text-xs">
              Leave blank to auto-generate from the{" "}
              {activePlatform ? "handle" : "URL"}.
            </p>
          </div>

          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            {hasLink ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Remove link
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {hasLink ? "Update link" : "Insert link"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type FloatingLinkToolbarProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onRequestLinkDialog: (state: OpenLinkDialogState) => void;
};

type FloatingLinkInfo = {
  linkKey: string;
  url: string;
  platform: SocialPlatform | null;
  top: number;
  left: number;
};

function FloatingLinkToolbar({
  containerRef,
  onRequestLinkDialog,
}: FloatingLinkToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [info, setInfo] = useState<FloatingLinkInfo | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const computeInfo = useCallback((): FloatingLinkInfo | null => {
    const container = containerRef.current;
    if (!container) return null;
    const activeElement =
      typeof document !== "undefined" ? document.activeElement : null;
    const isInsidePopover =
      popoverRef.current && activeElement
        ? popoverRef.current.contains(activeElement)
        : false;
    const isInsideEditor =
      activeElement && container.contains(activeElement);
    if (!isInsideEditor && !isInsidePopover) return null;

    let result: FloatingLinkInfo | null = null;
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const linkNode = $findMatchingParent(
        selection.anchor.getNode(),
        $isLinkNode,
      ) as LinkNodeType | null;
      if (!linkNode) return;
      const linkKey = linkNode.getKey();
      const domEl = editor.getElementByKey(linkKey);
      if (!domEl) return;
      const linkRect = domEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const nodeUrl = linkNode.getURL();
      result = {
        linkKey,
        url: nodeUrl,
        platform: resolvePillPlatform(nodeUrl, linkNode.getTitle()),
        top: linkRect.bottom - containerRect.top + 6,
        left: Math.max(4, linkRect.left - containerRect.left),
      };
    });
    return result;
  }, [containerRef, editor]);

  const refresh = useCallback(() => {
    setInfo(computeInfo());
  }, [computeInfo]);

  useEffect(() => {
    const off = mergeRegister(
      editor.registerUpdateListener(() => refresh()),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          refresh();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      const container = containerRef.current;
      if (container?.contains(target)) {
        requestAnimationFrame(refresh);
        return;
      }
      setInfo(null);
    };
    const onResize = () => refresh();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      off();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, [editor, refresh, containerRef]);

  if (!info) return null;

  const handleEdit = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const linkNode = $findMatchingParent(
        selection.anchor.getNode(),
        $isLinkNode,
      ) as LinkNodeType | null;
      if (!linkNode) return;
      onRequestLinkDialog(
        buildLinkDialogStateFromLinkNode(linkNode, selection.clone()),
      );
    });
  };

  const handleRemove = () => {
    editor.update(() => {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    });
    setInfo(null);
    requestAnimationFrame(() => editor.focus());
  };

  const displayUrl = info.url.replace(/^https?:\/\//, "");

  return (
    <div
      ref={popoverRef}
      contentEditable={false}
      onMouseDown={(e) => e.preventDefault()}
      style={{ top: info.top, left: info.left }}
      className="bg-popover text-popover-foreground absolute z-10 flex max-w-[min(26rem,calc(100%-1rem))] items-center gap-1 rounded-md border p-1 shadow-md"
    >
      <a
        href={info.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-1.5 rounded px-2 py-1 text-xs hover:underline"
        title={info.url}
      >
        {info.platform ? (
          <PlatformIcon
            platform={info.platform}
            size={14}
            className="h-3.5 w-3.5"
          />
        ) : (
          <Link2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{displayUrl}</span>
        <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0" />
      </a>
      <span className="bg-border mx-0.5 h-5 w-px" aria-hidden />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Edit link"
        aria-label="Edit link"
        onClick={handleEdit}
        className="h-7 w-7"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Remove link"
        aria-label="Remove link"
        onClick={handleRemove}
        className="text-destructive hover:text-destructive h-7 w-7"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/**
 * Accepts anything we might reasonably receive as stored Lexical content —
 * a `SerializedEditorState` object (preferred), a stringified JSON
 * representation, `null`, `undefined`, or a Prisma `JsonValue`. Invalid
 * shapes are normalized to `null` and the editor seeds an empty paragraph.
 */
export type LexicalEditorValue = unknown;

function isLexicalStateObject(v: unknown): v is SerializedEditorState {
  return (
    typeof v === "object" &&
    v !== null &&
    "root" in (v as Record<string, unknown>)
  );
}

function normalizeLexicalValue(
  value: LexicalEditorValue,
): SerializedEditorState | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return isLexicalStateObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isLexicalStateObject(value) ? value : null;
}

export const LEXICAL_EDITOR_NODES = LEXICAL_NODES;

export const LEXICAL_EDITOR_THEME = theme;

type ValueRef = { current: string };

type ExternalValuePluginProps = {
  value: LexicalEditorValue;
  lastEmittedRef: ValueRef;
};

function ExternalValuePlugin({
  value,
  lastEmittedRef,
}: ExternalValuePluginProps) {
  const [editor] = useLexicalComposerContext();

  const normalized = normalizeLexicalValue(value);
  const fingerprint = normalized ? JSON.stringify(normalized) : "";

  useEffect(() => {
    if (fingerprint === lastEmittedRef.current) return;
    lastEmittedRef.current = fingerprint;
    if (normalized) {
      try {
        const parsed = editor.parseEditorState(normalized);
        editor.setEditorState(parsed, { tag: "history-merge" });
        return;
      } catch (err) {
        console.error("Failed to parse Lexical editor state:", err);
      }
    }
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        root.append($createParagraphNode());
      },
      { tag: "history-merge" },
    );
    // `normalized` is derived from `value` + `fingerprint`; depending on both
    // avoids recomputing the object identity on every render.
  }, [editor, fingerprint, normalized, lastEmittedRef]);

  return null;
}

type LexicalRichTextEditorProps = {
  /**
   * Serialized Lexical editor state. Accepts either a `SerializedEditorState`
   * object (preferred — e.g. straight from a Prisma `Json` column) or a JSON
   * string representation. `null` / `undefined` / empty seeds an empty
   * paragraph.
   */
  value: LexicalEditorValue;
  /**
   * Called whenever the content changes, with the full `SerializedEditorState`
   * object (ready to be stored in a Prisma `Json` column).
   */
  onChange: (state: SerializedEditorState) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  minHeight?: string;
  showToolbar?: boolean;
  namespace?: string;
  autoFocus?: boolean;
  contentClassName?: string;
  onFocus?: () => void;
  /**
   * When true, the editor body fills its flex parent vertically and its
   * contents scroll within. Use this inside fixed-height containers.
   */
  fillParent?: boolean;
};

export function LexicalRichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  ariaLabel = "Rich text editor",
  className,
  minHeight = "12rem",
  showToolbar = true,
  namespace = "lexical-editor",
  autoFocus = false,
  contentClassName,
  onFocus,
  fillParent = false,
}: LexicalRichTextEditorProps) {
  const initialNormalized = normalizeLexicalValue(value);
  const lastEmittedRef = useRef<string>(
    initialNormalized ? JSON.stringify(initialNormalized) : "",
  );
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState>({
    open: false,
  });

  const initialConfig = {
    namespace,
    onError: (error: Error) => {
      console.error("Lexical error:", error);
    },
    theme: LEXICAL_EDITOR_THEME,
    nodes: LEXICAL_EDITOR_NODES,
    // Lexical's `editorState` accepts a JSON string or an updater function;
    // serialize our `SerializedEditorState` for it.
    editorState: initialNormalized
      ? JSON.stringify(initialNormalized)
      : () => {
          const root = $getRoot();
          if (root.getChildrenSize() === 0) {
            root.append($createParagraphNode());
          }
        },
  };

  const handleChange = useCallback(
    (editorState: EditorState, _editor: LexicalEditor, tags: Set<string>) => {
      if (tags.has("history-merge")) return;
      const state = editorState.toJSON();
      const fingerprint = JSON.stringify(state);
      if (fingerprint === lastEmittedRef.current) return;
      lastEmittedRef.current = fingerprint;
      onChange(state);
    },
    [onChange],
  );

  return (
    <div className={cn("flex flex-col", className)} onFocus={onFocus}>
      <LexicalComposer initialConfig={initialConfig}>
        {showToolbar ? (
          <Toolbar onRequestLinkDialog={(next) => setLinkDialog(next)} />
        ) : null}
        <div
          ref={editorWrapperRef}
          className={cn(
            "border-input bg-background focus-within:border-ring focus-within:ring-ring/50 relative border shadow-xs transition-colors focus-within:ring-[3px]",
            showToolbar ? "rounded-b-md" : "rounded-md",
            fillParent && "flex-1 min-h-0 overflow-hidden",
          )}
        >
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                aria-label={ariaLabel}
                aria-placeholder={placeholder}
                placeholder={
                  <div className="text-muted-foreground pointer-events-none absolute top-3 left-3 text-sm">
                    {placeholder}
                  </div>
                }
                className={cn(
                  "min-w-0 px-3 py-3 text-sm outline-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                  contentClassName,
                )}
                style={{ minHeight }}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <OnChangePlugin
            onChange={handleChange}
            ignoreHistoryMergeTagChange
            ignoreSelectionChange
          />
          <ExternalValuePlugin
            value={value}
            lastEmittedRef={lastEmittedRef}
          />
          {autoFocus ? <AutoFocusOnMount /> : null}
          <FloatingLinkToolbar
            containerRef={editorWrapperRef}
            onRequestLinkDialog={(next) => setLinkDialog(next)}
          />
        </div>
        <LinkDialog
          state={linkDialog}
          onClose={() => setLinkDialog({ open: false })}
        />
      </LexicalComposer>
    </div>
  );
}

function AutoFocusOnMount() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.focus();
  }, [editor]);
  return null;
}
