"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Mail,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { WalletPassPreview } from "~/components/admin/ticketing/wallet-pass-preview";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import {
  PASS_FIELD_SLOT_LABELS,
  cloneJsonObject,
  isJsonObject,
  parseJsonObject,
  prettyJson,
  walletPassDebugDefaultsResponseSchema,
  walletPassDebugDraftSchema,
  type JsonObject,
  type JsonValue,
  type PassFieldSlot,
  type WalletPassAsset,
  type WalletPassDebugDefaultsResponse,
  type WalletPassDebugDraft,
  type WalletPassLocalization,
} from "~/lib/ticketing/wallet-pass-debug";
import {
  DEFAULT_PASS_THEME,
  PASS_STRIP_STYLES,
  PASS_STRIP_STYLE_LABELS,
  isHexColour,
  stripSvg,
  toPassRgb,
} from "~/lib/ticketing/pass-theme";

const API_URL = "/api/admin/wallet-pass-debug";

const EDITOR_TABS = [
  ["identity", "Identity"],
  ["appearance", "Appearance"],
  ["front", "Front"],
  ["back", "Back"],
  ["barcode", "Barcode"],
  ["relevance", "Relevance"],
  ["updates", "Updates"],
  ["locales", "Locales"],
  ["json", "JSON"],
] as const;

type EditorTab = (typeof EDITOR_TABS)[number][0];
type PendingAction = "download" | "send" | null;

const EVENT_GUIDE_URLS = [
  ["bagPolicyURL", "Bag policy"],
  ["orderFoodURL", "Order food"],
  ["parkingInformationURL", "Parking information"],
  ["directionsInformationURL", "Directions"],
  ["purchaseParkingURL", "Purchase parking"],
  ["merchandiseURL", "Merchandise"],
  ["transitInformationURL", "Transit information"],
  ["accessibilityURL", "Accessibility"],
  ["addOnURL", "Add-ons"],
  ["contactVenueWebsite", "Venue website"],
  ["transferURL", "Transfer"],
  ["sellURL", "Sell"],
] as const;

function stringValue(value: JsonValue | undefined): string {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : "";
}

function booleanValue(value: JsonValue | undefined): boolean {
  return value === true;
}

function setProperty(
  object: JsonObject,
  key: string,
  value: JsonValue | undefined,
): JsonObject {
  const next = { ...object };
  if (value === undefined || value === "") delete next[key];
  else next[key] = value;
  return next;
}

function passObject(manifest: JsonObject): JsonObject {
  return isJsonObject(manifest.eventTicket)
    ? manifest.eventTicket
    : {
        headerFields: [],
        primaryFields: [],
        secondaryFields: [],
        auxiliaryFields: [],
        additionalInfoFields: [],
        backFields: [],
      };
}

function fieldList(manifest: JsonObject, slot: PassFieldSlot): JsonObject[] {
  const value = passObject(manifest)[slot];
  return Array.isArray(value) ? value.filter(isJsonObject) : [];
}

function withFields(
  manifest: JsonObject,
  slot: PassFieldSlot,
  fields: JsonObject[],
): JsonObject {
  return {
    ...manifest,
    eventTicket: { ...passObject(manifest), [slot]: fields },
  };
}

function barcodeList(manifest: JsonObject): JsonObject[] {
  return Array.isArray(manifest.barcodes)
    ? manifest.barcodes.filter(isJsonObject)
    : [];
}

function fileAsAsset(file: File): Promise<WalletPassAsset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== "string") {
        reject(new Error(`Could not read ${file.name}.`));
        return;
      }
      resolve({
        fileName: file.name,
        dataBase64: value.slice(value.indexOf(",") + 1),
      });
    };
    reader.readAsDataURL(file);
  });
}

function FieldLabel({
  children,
  hint,
  htmlFor,
}: {
  children: ReactNode;
  hint?: string;
  htmlFor?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      {htmlFor ? (
        <Label htmlFor={htmlFor}>{children}</Label>
      ) : (
        <p className="text-sm leading-none font-medium">{children}</p>
      )}
      {hint ? (
        <span className="text-muted-foreground text-xs">{hint}</span>
      ) : null}
    </div>
  );
}

function ManifestInput({
  draft,
  property,
  label,
  placeholder,
  mono = false,
  type = "text",
  onChange,
}: {
  draft: WalletPassDebugDraft;
  property: string;
  label: string;
  placeholder?: string;
  mono?: boolean;
  type?: "number" | "text" | "url";
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  const inputId = `wallet-pass-${property}`;

  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        id={inputId}
        type={type}
        value={stringValue(draft.manifest[property])}
        placeholder={placeholder}
        spellCheck={!mono}
        className={mono ? "font-mono text-xs" : ""}
        onChange={(event) =>
          onChange({
            ...draft,
            manifest: setProperty(
              draft.manifest,
              property,
              type === "number" && event.target.value
                ? Number(event.target.value)
                : event.target.value,
            ),
          })
        }
      />
    </div>
  );
}

function ManifestSwitch({
  draft,
  property,
  label,
  hint,
  onChange,
}: {
  draft: WalletPassDebugDraft;
  property: string;
  label: string;
  hint: string;
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  const inputId = useId();

  return (
    <div className="border-border flex items-center justify-between gap-5 border-b py-3 last:border-0">
      <div>
        <Label htmlFor={inputId}>{label}</Label>
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      </div>
      <Switch
        id={inputId}
        checked={booleanValue(draft.manifest[property])}
        onCheckedChange={(checked) =>
          onChange({
            ...draft,
            manifest: { ...draft.manifest, [property]: checked },
          })
        }
      />
    </div>
  );
}

function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border border-t py-6 first:border-t-0 first:pt-0">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function JsonPropertyEditor({
  label,
  hint,
  value,
  emptyValue,
  onChange,
}: {
  label: string;
  hint?: string;
  value: JsonValue | undefined;
  emptyValue: "[]" | "{}";
  onChange: (value: JsonValue | undefined) => void;
}) {
  const source = value === undefined ? emptyValue : prettyJson(value);
  const apply = (text: string, textarea: HTMLTextAreaElement) => {
    try {
      const parsed: unknown = JSON.parse(text);
      const wrapper = parseJsonObject(`{"value":${JSON.stringify(parsed)}}`);
      const next = wrapper.value;
      onChange(
        (Array.isArray(next) && next.length === 0) ||
          (isJsonObject(next) && Object.keys(next).length === 0)
          ? undefined
          : next,
      );
    } catch {
      toast.error(`${label} must be valid JSON.`);
      textarea.value = source;
    }
  };

  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <Textarea
        aria-label={label}
        key={source}
        defaultValue={source}
        onBlur={(event) =>
          apply(event.currentTarget.value, event.currentTarget)
        }
        spellCheck={false}
        className="min-h-28 resize-y font-mono text-xs leading-relaxed"
      />
    </div>
  );
}

function IdentityEditor({
  draft,
  onChange,
}: {
  draft: WalletPassDebugDraft;
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  return (
    <>
      <EditorSection
        title="Pass identity"
        description="Required keys default to the current Atmos signing configuration."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ManifestInput
            draft={draft}
            property="organizationName"
            label="Organization name"
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="description"
            label="Description"
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="passTypeIdentifier"
            label="Pass type identifier"
            mono
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="teamIdentifier"
            label="Team identifier"
            mono
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="serialNumber"
            label="Serial number"
            mono
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="formatVersion"
            label="Format version"
            type="number"
            mono
            onChange={onChange}
          />
        </div>
      </EditorSection>
      <EditorSection title="Optional identity">
        <div className="grid gap-4 md:grid-cols-2">
          <ManifestInput
            draft={draft}
            property="logoText"
            label="Logo text"
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="eventLogoText"
            label="Event logo text"
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="groupingIdentifier"
            label="Grouping identifier"
            mono
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="appLaunchURL"
            label="App launch URL"
            type="url"
            onChange={onChange}
          />
        </div>
      </EditorSection>
      <EditorSection title="Pass behavior">
        <ManifestSwitch
          draft={draft}
          property="voided"
          label="Voided"
          hint="Marks the pass as invalid without linking it to a ticket."
          onChange={onChange}
        />
        <ManifestSwitch
          draft={draft}
          property="sharingProhibited"
          label="Sharing prohibited"
          hint="Asks Wallet not to expose pass sharing."
          onChange={onChange}
        />
      </EditorSection>
    </>
  );
}

function AppearanceEditor({
  draft,
  onChange,
}: {
  draft: WalletPassDebugDraft;
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  const previewTheme = {
    ...draft.theme,
    accentHex: isHexColour(draft.theme.accentHex)
      ? draft.theme.accentHex
      : DEFAULT_PASS_THEME.accentHex,
    backgroundHex: isHexColour(draft.theme.backgroundHex)
      ? draft.theme.backgroundHex
      : DEFAULT_PASS_THEME.backgroundHex,
    foregroundHex: isHexColour(draft.theme.foregroundHex)
      ? draft.theme.foregroundHex
      : DEFAULT_PASS_THEME.foregroundHex,
    labelHex: isHexColour(draft.theme.labelHex)
      ? draft.theme.labelHex
      : DEFAULT_PASS_THEME.labelHex,
  };
  const updateColour = (
    themeKey: "accentHex" | "backgroundHex" | "foregroundHex" | "labelHex",
    manifestKey: "backgroundColor" | "foregroundColor" | "labelColor" | null,
    value: string,
  ) => {
    onChange({
      ...draft,
      theme: { ...draft.theme, [themeKey]: value },
      manifest:
        manifestKey && isHexColour(value)
          ? { ...draft.manifest, [manifestKey]: toPassRgb(value) }
          : draft.manifest,
    });
  };

  const addAssets = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    try {
      const assets = await Promise.all(files.map(fileAsAsset));
      const byName = new Map(
        [...draft.assets, ...assets].map((asset) => [asset.fileName, asset]),
      );
      const next = { ...draft, assets: [...byName.values()] };
      const result = walletPassDebugDraftSchema.safeParse(next);
      if (!result.success) throw new Error(result.error.issues[0]?.message);
      onChange(result.data);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not add asset.",
      );
    }
  };

  const swatches = [
    ["accentHex", "Accent", "Band artwork", null],
    ["backgroundHex", "Background", "Pass ground", "backgroundColor"],
    ["foregroundHex", "Foreground", "Field values", "foregroundColor"],
    ["labelHex", "Labels", "Small field labels", "labelColor"],
  ] as const;

  return (
    <>
      <EditorSection
        title="Band style"
        description="The same artwork generator used by live Atmos passes."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {PASS_STRIP_STYLES.map((style) => {
            const active = draft.theme.stripStyle === style;
            return (
              <button
                key={style}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({
                    ...draft,
                    theme: { ...draft.theme, stripStyle: style },
                  })
                }
                className={`border-border hover:border-foreground/40 rounded-md border p-2 text-left transition-colors ${active ? "border-foreground bg-foreground/5" : ""}`}
              >
                <span
                  aria-hidden
                  className="block h-9 overflow-hidden [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{
                    __html: stripSvg(
                      { ...previewTheme, stripStyle: style },
                      240,
                      40,
                    ),
                  }}
                />
                <span className="mt-2 block text-xs font-semibold">
                  {PASS_STRIP_STYLE_LABELS[style].label}
                </span>
              </button>
            );
          })}
        </div>
      </EditorSection>

      <EditorSection title="Colors">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {swatches.map(([key, label, hint, manifestKey]) => {
            const value = draft.theme[key];
            const valid = isHexColour(value);
            return (
              <div key={key}>
                <FieldLabel hint={hint}>{label}</FieldLabel>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label={`${label} color`}
                    value={valid ? value : "#000000"}
                    onChange={(event) =>
                      updateColour(key, manifestKey, event.target.value)
                    }
                    className="border-input h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
                  />
                  <Input
                    aria-label={`${label} hex value`}
                    value={value}
                    onChange={(event) =>
                      updateColour(key, manifestKey, event.target.value)
                    }
                    aria-invalid={!valid}
                    spellCheck={false}
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ManifestInput
            draft={draft}
            property="stripColor"
            label="Strip text color"
            placeholder="rgb(255, 255, 255)"
            mono
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="footerBackgroundColor"
            label="Footer background color"
            placeholder="rgb(11, 11, 12)"
            mono
            onChange={onChange}
          />
        </div>
      </EditorSection>

      <EditorSection
        title="Artwork"
        description="PNG files replace generated assets by exact filename. Maximum 2 MB each."
      >
        <div className="border-border divide-border divide-y rounded-md border">
          {[
            ["icon.png", "Required Wallet icon, with @2x and @3x variants"],
            ["logo.png", "Header logo, with @2x and @3x variants"],
            ["strip.png", "Event ticket band, with @2x and @3x variants"],
            ["background.png", "Optional background artwork"],
            ["thumbnail.png", "Optional thumbnail artwork"],
            ["footer.png", "Optional footer artwork"],
          ].map(([name, hint]) => {
            const custom = draft.assets.some(
              (asset) => asset.fileName === name,
            );
            return (
              <div
                key={name}
                className="flex items-center justify-between gap-4 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {custom ? "Custom file selected" : hint}
                  </p>
                </div>
                <span
                  className={`text-xs ${custom ? "text-emerald-400" : "text-muted-foreground"}`}
                >
                  {custom ? "Custom" : "Default"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" />
              Add PNG assets
              <input
                type="file"
                accept="image/png"
                multiple
                className="sr-only"
                onChange={addAssets}
              />
            </label>
          </Button>
          <span className="text-muted-foreground text-xs">
            Keep Apple filenames such as logo@2x.png or en.lproj/thumbnail.png.
          </span>
        </div>
        {draft.assets.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.assets.map((asset) => (
              <Button
                key={asset.fileName}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  onChange({
                    ...draft,
                    assets: draft.assets.filter(
                      (item) => item.fileName !== asset.fileName,
                    ),
                  })
                }
              >
                {asset.fileName}
                <Trash2 className="size-3.5" />
              </Button>
            ))}
          </div>
        ) : null}
      </EditorSection>

      <EditorSection title="Rendering options">
        <ManifestSwitch
          draft={draft}
          property="suppressStripShine"
          label="Suppress strip shine"
          hint="Disables the legacy gloss treatment."
          onChange={onChange}
        />
        <ManifestSwitch
          draft={draft}
          property="suppressHeaderDarkening"
          label="Suppress header darkening"
          hint="Keeps iOS from adding its automatic header shadow."
          onChange={onChange}
        />
        <ManifestSwitch
          draft={draft}
          property="useAutomaticColors"
          label="Automatic colors"
          hint="Lets newer event-ticket layouts derive colors from artwork."
          onChange={onChange}
        />
      </EditorSection>
    </>
  );
}

function AdvancedFieldProperties({
  field,
  onChange,
}: {
  field: JsonObject;
  onChange: (field: JsonObject) => void;
}) {
  const basic = new Set(["key", "label", "value"]);
  const advanced = Object.fromEntries(
    Object.entries(field).filter(([key]) => !basic.has(key)),
  );

  return (
    <JsonPropertyEditor
      label="Advanced field properties"
      hint="changeMessage, dateStyle, semantics, alignment, detectors, row, and number formatting"
      value={advanced}
      emptyValue="{}"
      onChange={(value) => {
        const next = isJsonObject(value) ? value : {};
        onChange({
          ...next,
          key: field.key ?? "field",
          label: field.label ?? "",
          value: field.value ?? "",
        });
      }}
    />
  );
}

function FieldSlotEditor({
  draft,
  slot,
  onChange,
}: {
  draft: WalletPassDebugDraft;
  slot: PassFieldSlot;
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  const fields = fieldList(draft.manifest, slot);
  const replace = (nextFields: JsonObject[]) =>
    onChange({
      ...draft,
      manifest: withFields(draft.manifest, slot, nextFields),
    });

  return (
    <EditorSection
      title={`${PASS_FIELD_SLOT_LABELS[slot]} fields`}
      description={`${fields.length} field${fields.length === 1 ? "" : "s"}. Wallet controls final wrapping and capacity.`}
    >
      <div className="space-y-3">
        {fields.map((field, index) => {
          const update = (nextField: JsonObject) =>
            replace(
              fields.map((item, itemIndex) =>
                itemIndex === index ? nextField : item,
              ),
            );
          return (
            <div
              key={`${stringValue(field.key)}-${index}`}
              className="border-border rounded-lg border p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-muted-foreground font-mono text-xs">
                  {stringValue(field.key) || `field-${index + 1}`}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move field up"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...fields];
                      [next[index - 1], next[index]] = [
                        next[index]!,
                        next[index - 1]!,
                      ];
                      replace(next);
                    }}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move field down"
                    disabled={index === fields.length - 1}
                    onClick={() => {
                      const next = [...fields];
                      [next[index], next[index + 1]] = [
                        next[index + 1]!,
                        next[index]!,
                      ];
                      replace(next);
                    }}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete field"
                    onClick={() =>
                      replace(
                        fields.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Key</FieldLabel>
                  <Input
                    value={stringValue(field.key)}
                    onChange={(event) =>
                      update({ ...field, key: event.target.value })
                    }
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <FieldLabel>Label</FieldLabel>
                  <Input
                    value={stringValue(field.label)}
                    onChange={(event) =>
                      update(setProperty(field, "label", event.target.value))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Value</FieldLabel>
                  <Textarea
                    value={stringValue(field.value)}
                    onChange={(event) =>
                      update({ ...field, value: event.target.value })
                    }
                    className="min-h-20"
                  />
                </div>
                <div className="md:col-span-2">
                  <AdvancedFieldProperties field={field} onChange={update} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() =>
          replace([
            ...fields,
            {
              key: `field-${crypto.randomUUID().slice(0, 8)}`,
              label: "LABEL",
              value: "Value",
            },
          ])
        }
      >
        <Plus />
        Add {PASS_FIELD_SLOT_LABELS[slot].toLowerCase()} field
      </Button>
    </EditorSection>
  );
}

function FieldsEditor({
  draft,
  slots,
  onChange,
}: {
  draft: WalletPassDebugDraft;
  slots: PassFieldSlot[];
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  return (
    <>
      {slots.map((slot) => (
        <FieldSlotEditor
          key={slot}
          draft={draft}
          slot={slot}
          onChange={onChange}
        />
      ))}
    </>
  );
}

function BarcodeEditor({
  draft,
  onChange,
}: {
  draft: WalletPassDebugDraft;
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  const barcodes = barcodeList(draft.manifest);
  const replace = (next: JsonObject[]) =>
    onChange({
      ...draft,
      manifest: setProperty(draft.manifest, "barcodes", next),
    });

  return (
    <EditorSection
      title="Barcodes"
      description="Add formats in the order Wallet should prefer them."
    >
      <div className="space-y-3">
        {barcodes.map((barcode, index) => {
          const update = (property: string, value: string) =>
            replace(
              barcodes.map((item, itemIndex) =>
                itemIndex === index ? setProperty(item, property, value) : item,
              ),
            );
          return (
            <div key={index} className="border-border rounded-lg border p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Barcode {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete barcode"
                  onClick={() =>
                    replace(
                      barcodes.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Format</FieldLabel>
                  <Select
                    value={stringValue(barcode.format)}
                    onValueChange={(value) => update("format", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "PKBarcodeFormatQR",
                        "PKBarcodeFormatPDF417",
                        "PKBarcodeFormatAztec",
                        "PKBarcodeFormatCode128",
                      ].map((format) => (
                        <SelectItem key={format} value={format}>
                          {format.replace("PKBarcodeFormat", "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Message encoding</FieldLabel>
                  <Input
                    value={stringValue(barcode.messageEncoding)}
                    onChange={(event) =>
                      update("messageEncoding", event.target.value)
                    }
                    className="font-mono text-xs"
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Message</FieldLabel>
                  <Textarea
                    value={stringValue(barcode.message)}
                    onChange={(event) => update("message", event.target.value)}
                    className="min-h-24 font-mono text-xs"
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Alternative text</FieldLabel>
                  <Input
                    value={stringValue(barcode.altText)}
                    onChange={(event) => update("altText", event.target.value)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() =>
          replace([
            ...barcodes,
            {
              format: "PKBarcodeFormatQR",
              message: "",
              messageEncoding: "iso-8859-1",
              altText: "",
            },
          ])
        }
      >
        <Plus />
        Add barcode
      </Button>
    </EditorSection>
  );
}

function RelevanceEditor({
  draft,
  onChange,
}: {
  draft: WalletPassDebugDraft;
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  const json = (property: string, value: JsonValue | undefined) =>
    onChange({
      ...draft,
      manifest: setProperty(draft.manifest, property, value),
    });
  return (
    <>
      <EditorSection title="Dates and distance">
        <div className="grid gap-4 md:grid-cols-2">
          <ManifestInput
            draft={draft}
            property="relevantDate"
            label="Relevant date"
            placeholder="ISO 8601"
            mono
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="expirationDate"
            label="Expiration date"
            placeholder="ISO 8601"
            mono
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="maxDistance"
            label="Maximum distance"
            type="number"
            mono
            onChange={onChange}
          />
        </div>
      </EditorSection>
      <EditorSection
        title="Relevance data"
        description="These properties can surface the pass by time, place, beacon, or NFC reader."
      >
        <div className="grid gap-5">
          <JsonPropertyEditor
            label="Relevant dates"
            hint="iOS 18 intervals or individual dates"
            value={draft.manifest.relevantDates}
            emptyValue="[]"
            onChange={(value) => json("relevantDates", value)}
          />
          <JsonPropertyEditor
            label="Locations"
            hint="latitude, longitude, altitude, relevantText"
            value={draft.manifest.locations}
            emptyValue="[]"
            onChange={(value) => json("locations", value)}
          />
          <JsonPropertyEditor
            label="Beacons"
            hint="proximityUUID, major, minor, relevantText"
            value={draft.manifest.beacons}
            emptyValue="[]"
            onChange={(value) => json("beacons", value)}
          />
          <JsonPropertyEditor
            label="NFC"
            hint="message, encryptionPublicKey, requiresAuthentication"
            value={draft.manifest.nfc}
            emptyValue="{}"
            onChange={(value) => json("nfc", value)}
          />
        </div>
      </EditorSection>
    </>
  );
}

function UpdatesEditor({
  draft,
  onChange,
}: {
  draft: WalletPassDebugDraft;
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  const json = (property: string, value: JsonValue | undefined) =>
    onChange({
      ...draft,
      manifest: setProperty(draft.manifest, property, value),
    });
  return (
    <>
      <EditorSection
        title="Wallet web service"
        description="Blank by default because standalone passes are not registered for Atmos updates."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ManifestInput
            draft={draft}
            property="webServiceURL"
            label="Web service URL"
            type="url"
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="authenticationToken"
            label="Authentication token"
            mono
            onChange={onChange}
          />
        </div>
      </EditorSection>
      <EditorSection title="Store and app associations">
        <div className="grid gap-5 md:grid-cols-2">
          <JsonPropertyEditor
            label="Associated Store identifiers"
            value={draft.manifest.associatedStoreIdentifiers}
            emptyValue="[]"
            onChange={(value) => json("associatedStoreIdentifiers", value)}
          />
          <JsonPropertyEditor
            label="Auxiliary Store identifiers"
            value={draft.manifest.auxiliaryStoreIdentifiers}
            emptyValue="[]"
            onChange={(value) => json("auxiliaryStoreIdentifiers", value)}
          />
          <JsonPropertyEditor
            label="User info"
            value={draft.manifest.userInfo}
            emptyValue="{}"
            onChange={(value) => json("userInfo", value)}
          />
          <JsonPropertyEditor
            label="Semantics"
            value={draft.manifest.semantics}
            emptyValue="{}"
            onChange={(value) => json("semantics", value)}
          />
          <JsonPropertyEditor
            label="Preferred style schemes"
            hint="eventTicket or posterEventTicket"
            value={draft.manifest.preferredStyleSchemes}
            emptyValue="[]"
            onChange={(value) => json("preferredStyleSchemes", value)}
          />
          <JsonPropertyEditor
            label="Upcoming pass information"
            hint="iOS 26"
            value={draft.manifest.upcomingPassInformation}
            emptyValue="[]"
            onChange={(value) => json("upcomingPassInformation", value)}
          />
          <JsonPropertyEditor
            label="Personalization"
            hint="Requires NFC and personalizationLogo assets"
            value={draft.personalization ?? undefined}
            emptyValue="{}"
            onChange={(value) =>
              onChange({
                ...draft,
                personalization: isJsonObject(value) ? value : null,
              })
            }
          />
        </div>
      </EditorSection>
      <EditorSection
        title="Event guide links"
        description="Newer Wallet layouts surface these when enough related actions are present."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {EVENT_GUIDE_URLS.map(([property, label]) => (
            <ManifestInput
              key={property}
              draft={draft}
              property={property}
              label={`${label} URL`}
              type="url"
              onChange={onChange}
            />
          ))}
          <ManifestInput
            draft={draft}
            property="contactVenueEmail"
            label="Venue email"
            onChange={onChange}
          />
          <ManifestInput
            draft={draft}
            property="contactVenuePhoneNumber"
            label="Venue phone"
            onChange={onChange}
          />
        </div>
      </EditorSection>
    </>
  );
}

function LocalesEditor({
  draft,
  onChange,
}: {
  draft: WalletPassDebugDraft;
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  const replace = (localizations: WalletPassLocalization[]) =>
    onChange({ ...draft, localizations });
  return (
    <EditorSection
      title="Localized pass strings"
      description="Each locale becomes a .lproj/pass.strings file in the signed bundle."
    >
      <div className="space-y-3">
        {draft.localizations.map((locale, index) => (
          <div
            key={`${locale.language}-${index}`}
            className="border-border rounded-lg border p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="w-40">
                <FieldLabel>Language</FieldLabel>
                <Input
                  value={locale.language}
                  onChange={(event) =>
                    replace(
                      draft.localizations.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, language: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="font-mono text-xs"
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete locale"
                onClick={() =>
                  replace(
                    draft.localizations.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
            <JsonPropertyEditor
              label="Translations"
              hint="Keys must match strings used in pass.json"
              value={locale.translations}
              emptyValue="{}"
              onChange={(value) =>
                replace(
                  draft.localizations.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          translations: isJsonObject(value)
                            ? Object.fromEntries(
                                Object.entries(value).filter(
                                  (entry): entry is [string, string] =>
                                    typeof entry[1] === "string",
                                ),
                              )
                            : {},
                        }
                      : item,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() =>
          replace([
            ...draft.localizations,
            { language: "en", translations: {} },
          ])
        }
      >
        <Plus />
        Add locale
      </Button>
    </EditorSection>
  );
}

function RawManifestEditor({
  draft,
  onChange,
}: {
  draft: WalletPassDebugDraft;
  onChange: (next: WalletPassDebugDraft) => void;
}) {
  const source = prettyJson(draft.manifest);
  const rawRef = useRef<HTMLTextAreaElement>(null);
  const apply = () => {
    try {
      onChange({
        ...draft,
        manifest: parseJsonObject(rawRef.current?.value ?? source),
      });
      toast.success("Manifest applied");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Manifest must be valid JSON.",
      );
    }
  };
  return (
    <EditorSection
      title="Complete pass.json"
      description="This is the source that is validated, bundled, and signed. Friendly controls update it too."
    >
      <Textarea
        aria-label="Complete pass.json"
        key={source}
        ref={rawRef}
        defaultValue={source}
        spellCheck={false}
        className="min-h-[520px] resize-y font-mono text-xs leading-relaxed"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Unknown or unsupported keys are rejected by passkit-generator.
        </p>
        <Button type="button" onClick={apply}>
          Apply JSON
        </Button>
      </div>
    </EditorSection>
  );
}

export function WalletPassDebugger({
  initialData,
}: {
  initialData?: WalletPassDebugDefaultsResponse;
}) {
  const [draft, setDraft] = useState<WalletPassDebugDraft | null>(
    initialData?.draft ?? null,
  );
  const [original, setOriginal] = useState<WalletPassDebugDraft | null>(
    initialData ? structuredClone(initialData.draft) : null,
  );
  const [configured, setConfigured] = useState(
    initialData?.configured ?? false,
  );
  const [certificateDays, setCertificateDays] = useState<number | null>(
    initialData?.certificateDaysRemaining ?? null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [tab, setTab] = useState<EditorTab>("appearance");
  const [pending, setPending] = useState<PendingAction>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (initialData) return;
    const controller = new AbortController();
    fetch(API_URL, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) throw new Error("Could not load Wallet defaults.");
        return walletPassDebugDefaultsResponseSchema.parse(body);
      })
      .then((result) => {
        setDraft(result.draft);
        setOriginal(structuredClone(result.draft));
        setConfigured(result.configured);
        setCertificateDays(result.certificateDaysRemaining);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setLoadError(
            cause instanceof Error
              ? cause.message
              : "Could not load Wallet defaults.",
          );
      });
    return () => controller.abort();
  }, [initialData, reloadKey]);

  const changed = useMemo(
    () =>
      draft && original
        ? JSON.stringify(draft) !== JSON.stringify(original)
        : false,
    [draft, original],
  );
  const signingReady =
    configured && (certificateDays === null || certificateDays >= 0);
  const certificateStatus = !configured
    ? "Not configured"
    : certificateDays === null
      ? "Certificate ready"
      : certificateDays < 0
        ? `Certificate expired ${Math.abs(certificateDays)} days ago`
        : certificateDays === 0
          ? "Certificate expires today"
          : `Certificate ready · ${certificateDays} days left`;
  const certificateDot = !signingReady
    ? "bg-destructive"
    : certificateDays !== null && certificateDays <= 30
      ? "bg-amber-400"
      : "bg-emerald-400";

  const submit = async (action: Exclude<PendingAction, null>) => {
    if (!draft) return;
    const validated = walletPassDebugDraftSchema.safeParse(draft);
    if (!validated.success) {
      toast.error(
        validated.error.issues[0]?.message ??
          "The pass contains invalid values.",
      );
      return;
    }
    setPending(action);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          recipient: action === "send" ? recipient : undefined,
          draft: validated.data,
        }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          isJsonObject(body) && typeof body.error === "string"
            ? body.error
            : "Could not build the pass.";
        throw new Error(message);
      }
      if (action === "download") {
        const blob = await response.blob();
        const disposition = response.headers.get("content-disposition") ?? "";
        const filename =
          /filename="([^"]+)"/.exec(disposition)?.[1] ?? "standalone.pkpass";
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(href);
        toast.success("Pass downloaded");
      } else {
        toast.success(`Pass sent to ${recipient}`);
      }
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not build the pass.",
      );
    } finally {
      setPending(null);
    }
  };

  if (loadError) {
    return (
      <div className="border-destructive/50 bg-destructive/5 rounded-lg border p-5">
        <p className="font-medium">Wallet defaults could not be loaded</p>
        <p className="text-muted-foreground mt-1 text-sm">{loadError}</p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            setLoadError(null);
            setReloadKey((value) => value + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="border-border min-h-96 rounded-lg border p-6 text-sm">
        Loading Wallet defaults…
      </div>
    );
  }

  return (
    <div className="dark text-foreground min-w-0 bg-black">
      <div className="border-border grid gap-4 border-y py-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div>
          <FieldLabel>Template</FieldLabel>
          <div className="border-input bg-input/20 flex h-9 items-center rounded-md border px-3 text-sm">
            Standalone Atmos ticket
          </div>
        </div>
        <div>
          <FieldLabel>Signing</FieldLabel>
          <div className="border-input bg-input/20 flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <span className={`size-2 rounded-full ${certificateDot}`} />
            {certificateStatus}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (original)
              setDraft({
                ...structuredClone(original),
                manifest: cloneJsonObject(original.manifest),
              });
            toast.success("Overrides reset");
          }}
          disabled={!changed}
        >
          <RotateCcw />
          Reset overrides
        </Button>
      </div>

      {!signingReady ? (
        <div className="mt-4 rounded-md border border-amber-500/35 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {configured
            ? "The Apple Wallet certificate has expired. You can design the pass, but download and email stay disabled until it is replaced."
            : "Apple Wallet signing variables are missing. You can design the pass, but download and email stay disabled until the certificate is configured."}
        </div>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as EditorTab)}
        className="mt-5 gap-0"
      >
        <TabsList className="bg-transparent p-0">
          {EDITOR_TABS.map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 data-[state=active]:border-white data-[state=active]:bg-transparent"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="grid min-w-0 gap-6 pt-6 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0">
            <TabsContent value="identity">
              <IdentityEditor draft={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="appearance">
              <AppearanceEditor draft={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="front">
              <FieldsEditor
                draft={draft}
                slots={[
                  "headerFields",
                  "primaryFields",
                  "secondaryFields",
                  "auxiliaryFields",
                  "additionalInfoFields",
                ]}
                onChange={setDraft}
              />
            </TabsContent>
            <TabsContent value="back">
              <FieldsEditor
                draft={draft}
                slots={["backFields"]}
                onChange={setDraft}
              />
            </TabsContent>
            <TabsContent value="barcode">
              <BarcodeEditor draft={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="relevance">
              <RelevanceEditor draft={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="updates">
              <UpdatesEditor draft={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="locales">
              <LocalesEditor draft={draft} onChange={setDraft} />
            </TabsContent>
            <TabsContent value="json">
              <RawManifestEditor draft={draft} onChange={setDraft} />
            </TabsContent>
          </div>
          <WalletPassPreview draft={draft} />
        </div>
      </Tabs>

      <div className="border-border sticky bottom-0 z-20 -mx-4 mt-6 border-t bg-black px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <FieldLabel
              htmlFor="wallet-pass-recipient"
              hint="Fixed Atmos email template"
            >
              Email recipient
            </FieldLabel>
            <Input
              id="wallet-pass-recipient"
              type="email"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!signingReady || pending !== null}
              onClick={() => void submit("download")}
            >
              <Download />
              {pending === "download" ? "Building…" : "Download .pkpass"}
            </Button>
            <Button
              type="button"
              disabled={!signingReady || pending !== null || !recipient.trim()}
              onClick={() => void submit("send")}
            >
              <Mail />
              {pending === "send" ? "Sending…" : "Sign and send"}
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mx-auto mt-2 max-w-7xl text-xs">
          Nothing on this page is saved. The pass is signed only when you
          download or send it.
        </p>
      </div>
    </div>
  );
}
