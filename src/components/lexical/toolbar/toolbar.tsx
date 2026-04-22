"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Italic,
  Link2,
  List as ListIcon,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createHeadingNode,
  $createQuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
} from "@lexical/list";
import {
  $setBlocksType,
  $patchStyleText,
  $getSelectionStyleValueForProperty,
} from "@lexical/selection";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type ElementFormatType,
  type TextFormatType,
} from "lexical";
import {
  buildLinkDialogStateFromLinkNode,
  findLinkAncestor,
  type OpenLinkDialogState,
} from "../link/types";
import { FontFamilyPopover, findFontFamilyMatch } from "./font-popover";
import { TextColorPopover } from "./color-popover";
import { ToolbarButton, ToolbarSeparator } from "./toolbar-button";

type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "quote"
  | "ul"
  | "ol";

const TEXT_FORMATS = [
  { id: "bold", title: "Bold", Icon: Bold },
  { id: "italic", title: "Italic", Icon: Italic },
  { id: "underline", title: "Underline", Icon: Underline },
  { id: "strikethrough", title: "Strikethrough", Icon: Strikethrough },
  { id: "code", title: "Inline code", Icon: Code },
] as const satisfies ReadonlyArray<{
  id: TextFormatType;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
}>;

const HEADINGS = [
  { tag: "h1", title: "Heading 1", Icon: Heading1 },
  { tag: "h2", title: "Heading 2", Icon: Heading2 },
  { tag: "h3", title: "Heading 3", Icon: Heading3 },
  { tag: "h4", title: "Heading 4", Icon: Heading4 },
] as const satisfies ReadonlyArray<{
  tag: HeadingTagType;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
}>;

type AlignmentDef = {
  value: ElementFormatType;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  matches: (current: ElementFormatType) => boolean;
};

const ALIGNMENTS: readonly AlignmentDef[] = [
  {
    value: "left",
    title: "Align left",
    Icon: AlignLeft,
    matches: (a) => a === "left" || a === "" || a === "start",
  },
  {
    value: "center",
    title: "Align center",
    Icon: AlignCenter,
    matches: (a) => a === "center",
  },
  {
    value: "right",
    title: "Align right",
    Icon: AlignRight,
    matches: (a) => a === "right" || a === "end",
  },
  {
    value: "justify",
    title: "Justify",
    Icon: AlignJustify,
    matches: (a) => a === "justify",
  },
];

const CLEARABLE_FORMATS: TextFormatType[] = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "code",
  "subscript",
  "superscript",
  "highlight",
];

type ToolbarProps = {
  onRequestLinkDialog: (state: OpenLinkDialogState) => void;
};

export function Toolbar({ onRequestLinkDialog }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<Set<TextFormatType>>(
    () => new Set(),
  );
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

    const next = new Set<TextFormatType>();
    for (const { id } of TEXT_FORMATS) {
      if (selection.hasFormat(id)) next.add(id);
    }
    setActiveFormats(next);

    const anchorNode = selection.anchor.getNode();
    const element =
      anchorNode.getKey() === "root"
        ? anchorNode
        : $findMatchingParent(anchorNode, (e) => {
            const parent = e.getParent();
            return parent !== null && $isRootOrShadowRoot(parent);
          }) ?? anchorNode.getTopLevelElementOrThrow();

    setIsLink(Boolean(findLinkAncestor(anchorNode)));
    setAlign($isElementNode(element) ? element.getFormatType() ?? "" : "");
    setFontFamilyRaw(
      $getSelectionStyleValueForProperty(selection, "font-family", ""),
    );
    setFontColor(
      $getSelectionStyleValueForProperty(selection, "color", ""),
    );

    if ($isListNode(element)) {
      setBlockType(element.getListType() === "number" ? "ol" : "ul");
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

  const toggleList = (target: "ul" | "ol") => {
    if (blockType === target) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(
        target === "ul" ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
        undefined,
      );
    }
  };

  const applyStyle = (styles: Record<string, string | null>) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      $patchStyleText(selection, styles);
    });
  };

  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      for (const format of CLEARABLE_FORMATS) {
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
      const linkNode = findLinkAncestor(selection.anchor.getNode());
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

  const activeFontFamily = findFontFamilyMatch(fontFamilyRaw);

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
      {TEXT_FORMATS.map(({ id, title, Icon }) => (
        <ToolbarButton
          key={id}
          title={title}
          active={activeFormats.has(id)}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, id)}
        >
          <Icon className="h-4 w-4" />
        </ToolbarButton>
      ))}
      <ToolbarSeparator />
      {HEADINGS.map(({ tag, title, Icon }) => (
        <ToolbarButton
          key={tag}
          title={title}
          active={blockType === tag}
          onClick={() => formatHeading(tag)}
        >
          <Icon className="h-4 w-4" />
        </ToolbarButton>
      ))}
      <ToolbarSeparator />
      <ToolbarButton
        title="Bulleted list"
        active={blockType === "ul"}
        onClick={() => toggleList("ul")}
      >
        <ListIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        active={blockType === "ol"}
        onClick={() => toggleList("ol")}
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
      {ALIGNMENTS.map(({ value, title, Icon, matches }) => (
        <ToolbarButton
          key={value}
          title={title}
          active={matches(align)}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, value)}
        >
          <Icon className="h-4 w-4" />
        </ToolbarButton>
      ))}
      <ToolbarSeparator />
      <FontFamilyPopover
        active={activeFontFamily}
        onSelect={(stack) => applyStyle({ "font-family": stack })}
        onClear={() => applyStyle({ "font-family": null })}
      />
      <TextColorPopover
        activeColor={fontColor}
        onSelect={(color) => applyStyle({ color })}
        onClear={() => applyStyle({ color: null })}
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
