"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  isJsonObject,
  type JsonObject,
  type JsonValue,
  type WalletPassDebugDraft,
} from "~/lib/ticketing/wallet-pass-debug";
import {
  DEFAULT_PASS_THEME,
  isHexColour,
  stripSvg,
} from "~/lib/ticketing/pass-theme";

function text(value: JsonValue | undefined, fallback = ""): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return fallback;
}

function fields(
  manifest: JsonObject,
  slot:
    | "auxiliaryFields"
    | "backFields"
    | "headerFields"
    | "primaryFields"
    | "secondaryFields",
): JsonObject[] {
  const pass = manifest.eventTicket;
  if (!isJsonObject(pass) || !Array.isArray(pass[slot])) return [];
  return pass[slot].filter(isJsonObject);
}

function Field({ field }: { field: JsonObject }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 truncate text-[8px] font-semibold tracking-[0.14em] opacity-65">
        {text(field.label, text(field.key)).toUpperCase()}
      </p>
      <p className="truncate text-[11px] font-semibold">
        {text(field.value, "No value")}
      </p>
    </div>
  );
}

export function WalletPassPreview({ draft }: { draft: WalletPassDebugDraft }) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [qr, setQr] = useState<string | null>(null);
  const manifest = draft.manifest;
  const barcode = Array.isArray(manifest.barcodes)
    ? manifest.barcodes.find(isJsonObject)
    : undefined;
  const barcodeMessage = barcode ? text(barcode.message) : "";

  useEffect(() => {
    let current = true;
    if (!barcodeMessage) {
      return;
    }

    void QRCode.toDataURL(barcodeMessage, {
      margin: 1,
      width: 220,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((url) => {
      if (current) setQr(url);
    });
    return () => {
      current = false;
    };
  }, [barcodeMessage]);

  const header = fields(manifest, "headerFields")[0];
  const primary = fields(manifest, "primaryFields")[0];
  const secondary = fields(manifest, "secondaryFields").slice(0, 2);
  const auxiliary = fields(manifest, "auxiliaryFields").slice(0, 2);
  const back = fields(manifest, "backFields");
  const background = text(manifest.backgroundColor, `rgb(11, 11, 12)`);
  const foreground = text(manifest.foregroundColor, "rgb(255, 255, 255)");
  const label = text(manifest.labelColor, "rgb(160, 160, 170)");
  const customStrip = draft.assets.find(
    (asset) => asset.fileName === "strip.png",
  );
  const customLogo = draft.assets.find(
    (asset) => asset.fileName === "logo.png",
  );
  const previewTheme = {
    ...draft.theme,
    accentHex: isHexColour(draft.theme.accentHex)
      ? draft.theme.accentHex
      : DEFAULT_PASS_THEME.accentHex,
    backgroundHex: isHexColour(draft.theme.backgroundHex)
      ? draft.theme.backgroundHex
      : DEFAULT_PASS_THEME.backgroundHex,
  };

  return (
    <aside className="border-border xl:border-l xl:pl-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Preview</h2>
        <div className="border-border flex rounded-md border p-0.5">
          {(["front", "back"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={side === value ? "secondary" : "ghost"}
              onClick={() => setSide(value)}
              className="h-7 px-2.5 text-xs capitalize"
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-black py-2 sm:py-5">
        <div
          className="mx-auto w-full max-w-[286px] overflow-hidden rounded-2xl border border-white/15 shadow-[0_18px_42px_rgba(0,0,0,0.48)]"
          style={{ backgroundColor: background, color: foreground }}
        >
          <div className="flex min-h-14 items-end justify-between gap-3 px-4 pt-3 pb-2.5">
            {customLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${customLogo.dataBase64}`}
                alt=""
                className="h-4 max-w-28 object-contain object-left"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/logo/atmos-white.png"
                alt=""
                className="h-4 w-auto opacity-90"
              />
            )}
            {header ? (
              <div className="min-w-0 text-right" style={{ color: label }}>
                <Field field={header} />
              </div>
            ) : null}
          </div>

          {side === "front" ? (
            <>
              <div className="relative min-h-24">
                {customStrip ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/png;base64,${customStrip.dataBase64}`}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : draft.theme.stripStyle !== "NONE" ? (
                  <div
                    aria-hidden
                    className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{
                      __html: stripSvg(previewTheme, 750, 196),
                    }}
                  />
                ) : null}
                <div
                  className={cn(
                    "relative flex min-h-24 flex-col justify-center px-4 py-4",
                    draft.theme.stripStyle === "NONE" && !customStrip
                      ? "border-y border-white/10"
                      : "",
                  )}
                >
                  <p
                    className="mb-0.5 text-[8px] font-semibold tracking-[0.14em]"
                    style={{ color: label }}
                  >
                    {primary
                      ? text(primary.label, text(primary.key)).toUpperCase()
                      : "EVENT"}
                  </p>
                  <p className="text-xl font-bold tracking-[-0.025em]">
                    {primary
                      ? text(primary.value, "No primary field")
                      : "No primary field"}
                  </p>
                </div>
              </div>

              <div
                className="grid grid-cols-2 gap-x-3 gap-y-4 px-4 py-4"
                style={{ color: label }}
              >
                {[...secondary, ...auxiliary].map((field, index) => (
                  <Field key={`${text(field.key)}-${index}`} field={field} />
                ))}
              </div>

              {barcodeMessage && qr ? (
                <div className="px-4 pb-4 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr}
                    alt="Barcode preview"
                    className="mx-auto size-32 rounded-sm"
                  />
                  <p className="mt-1.5 truncate font-mono text-[9px] opacity-65">
                    {barcode ? text(barcode.altText, barcodeMessage) : ""}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="min-h-[400px] space-y-4 border-t border-white/10 px-4 py-5">
              {back.length ? (
                back.map((field, index) => (
                  <div
                    key={`${text(field.key)}-${index}`}
                    style={{ color: label }}
                  >
                    <Field field={field} />
                    <p
                      className="mt-1 text-[11px] leading-relaxed whitespace-pre-wrap"
                      style={{ color: foreground }}
                    >
                      {text(field.value, "No value")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs opacity-65">No back fields.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
        Approximate Wallet layout. Download to verify final type scaling,
        artwork crops, and newer iOS properties on a device.
      </p>
    </aside>
  );
}
