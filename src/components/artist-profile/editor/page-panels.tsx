"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { artistFontVariables } from "~/lib/artist-fonts";
import {
  ACCENT_SWATCHES,
  FACES,
  GROUND_SWATCHES,
  LAYOUTS,
  parseTheme,
  resolveTheme,
  type ArtistTheme,
  type FaceKey,
  type LayoutKey,
} from "~/lib/artist-theme";
import { SOCIAL_PLATFORMS, matchSocialPlatform } from "~/lib/social-pills";
import { normalizeSocialUrl } from "~/lib/artist-socials";
import { SiteSelect, SiteSwitch } from "~/components/site/inputs";
import { ImageUploadField } from "~/components/uploads/image-upload-field";
import { ThemeSchematic } from "~/components/artist-themes/theme-swatch";
import type { PublicSocial } from "../types";
import {
  Field,
  IconAction,
  PanelButton,
  PanelSection,
  Segmented,
  TextArea,
  TextInput,
} from "./fields";
import { useEditor, type EditorStore } from "./store";

// ---------------------------------------------------------------------------
// Theme

/**
 * The page's look. Starters and shared themes apply as they are; any change
 * below them goes into this page's own theme, made the first time (see
 * `customizeTheme`), so the page repaints as you click and nobody else's
 * page changes.
 */
export function ThemePanel({ store }: { store: EditorStore }) {
  const theme = useEditor(store, (s) => s.theme);
  const info = useEditor(store, (s) => s.themeInfo);
  const accentColor = useEditor(store, (s) => s.accentColor);
  const profileId = useEditor(store, (s) => s.profileId);
  const admin = useEditor(store, (s) => s.editor === "admin");
  const shared = api.artistThemes.listPublic.useQuery({ includeSystem: true });
  const mine = api.artistThemes.listMine.useQuery(undefined, {
    enabled: !admin,
  });
  const setTheme = api.artistProfiles.setTheme.useMutation();
  const clearAccent = api.artistProfiles.updateProfile.useMutation();
  const patch = (p: Partial<ArtistTheme>) => store.getState().patchTheme(p);
  const resolved = resolveTheme(theme);

  const rows = [
    ...(mine.data ?? []),
    ...(shared.data ?? []).filter(
      (t) => !(mine.data ?? []).some((m) => m.id === t.id),
    ),
  ];

  const pick = async (row: (typeof rows)[number]) => {
    const prev = store.getState();
    const tokens = parseTheme(row.tokens);
    store
      .getState()
      .setTheme(
        { id: row.id, name: row.name, own: false },
        tokens,
        prev.accentColor,
      );
    try {
      // A tweak still saving would otherwise land after this and win.
      await store.getState().flush();
      const res = await setTheme.mutateAsync({ profileId, themeId: row.id });
      store.setState({ themeInfo: res.theme });
    } catch (e) {
      store.getState().setTheme(prev.themeInfo, prev.theme, prev.accentColor);
      toast.error(e instanceof Error ? e.message : "Couldn't change the theme");
    }
  };

  return (
    <div className="space-y-6">
      {accentColor ? (
        <div className="flex items-center gap-3 rounded-[16px] border border-white/15 p-3.5 text-[13px] text-white/70">
          <span
            className="size-6 shrink-0 rounded-full border border-white/20"
            style={{ background: accentColor }}
          />
          <span className="flex-1">
            This page uses its own accent over the theme&apos;s.
          </span>
          <PanelButton
            disabled={clearAccent.isPending}
            onClick={async () => {
              await clearAccent.mutateAsync({
                profileId,
                data: { accentColor: null },
              });
              const s = store.getState();
              s.setTheme(s.themeInfo, s.theme, null);
            }}
          >
            Use theme&apos;s
          </PanelButton>
        </div>
      ) : null}

      <PanelSection
        title="Start from"
        aside={
          setTheme.isPending ? (
            <Loader2 className="size-4 animate-spin text-white/60" />
          ) : null
        }
      >
        {shared.isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-[10px] bg-white/[0.06]"
              />
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {rows.map((row) => {
              const t = resolveTheme(parseTheme(row.tokens));
              const active = row.id === info?.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => void pick(row)}
                    disabled={active}
                    className="group/theme block w-full text-left"
                  >
                    <span
                      className={cn(
                        "relative block aspect-[4/3] overflow-hidden rounded-[10px] border transition-[border-color,box-shadow]",
                        active
                          ? "border-[var(--ed)] shadow-[0_0_0_1px_var(--ed)]"
                          : "border-white/15 group-hover/theme:border-white/45",
                      )}
                      style={{ background: t.ground }}
                    >
                      <ThemeSchematic layout={t.layout} theme={t} />
                      {active ? (
                        <span className="absolute top-1.5 right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-[var(--ed)] text-black">
                          <Check className="size-3" />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1.5 block truncate text-[12px] text-white/75">
                      {row.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PanelSection>

      <PanelSection title="Layout">
        <div role="radiogroup" aria-label="Layout" className="grid gap-2">
          {(Object.keys(LAYOUTS) as LayoutKey[]).map((key) => {
            const active = theme.layout === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => patch({ layout: key })}
                className={cn(
                  "grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3 rounded-[14px] border p-2 text-left transition-colors",
                  active
                    ? "border-white bg-white/[0.06]"
                    : "border-white/10 hover:border-white/35",
                )}
              >
                <span
                  aria-hidden
                  className="block h-14 overflow-hidden rounded-[8px]"
                  style={{ background: resolved.ground }}
                >
                  <ThemeSchematic layout={key} theme={resolved} />
                </span>
                <span className="min-w-0">
                  <span className="t-label flex items-center gap-1.5 text-[10px] text-white">
                    {LAYOUTS[key].label}
                    {active ? (
                      <Check className="size-3.5 text-[var(--ed)]" />
                    ) : null}
                  </span>
                  <span className="mt-1.5 block text-[12px] leading-snug text-white/55">
                    {LAYOUTS[key].description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection title="Colours">
        <ColourField
          label="Background"
          value={theme.ground}
          swatches={GROUND_SWATCHES}
          onChange={(ground) => patch({ ground })}
        />
        <ColourField
          label="Accent"
          value={theme.accent}
          swatches={ACCENT_SWATCHES}
          onChange={(accent) => patch({ accent })}
        />
        <p className="text-[13px] leading-snug text-white/50">
          Text colours follow from these, so everything stays readable.
          {resolved.accentText !== resolved.accent
            ? " This accent is too faint on this background to use for text, so links and headline roles use the text colour."
            : ""}
        </p>
      </PanelSection>

      <PanelSection title="Type and shape">
        <Field label="Display font">
          {() => (
            <div className={cn("flex flex-wrap gap-1.5", artistFontVariables)}>
              {(Object.keys(FACES) as FaceKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={theme.display === key}
                  onClick={() => patch({ display: key })}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full border px-4 text-[13px] transition-colors",
                    theme.display === key
                      ? "border-white bg-white text-black"
                      : "border-white/15 text-white/80 hover:border-white/40",
                  )}
                  style={{
                    fontFamily: FACES[key].family,
                    fontStretch: FACES[key].stretch,
                    fontWeight: FACES[key].weight,
                    textTransform: FACES[key].upper ? "uppercase" : "none",
                  }}
                >
                  {FACES[key].label}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Corners">
          {() => (
            <Segmented
              label="Corners"
              value={theme.corners}
              options={[
                { value: "hard", label: "Hard" },
                { value: "soft", label: "Soft" },
              ]}
              onChange={(corners) => patch({ corners })}
            />
          )}
        </Field>
        <Field label="Your photos" hint="Gig posters always show as made.">
          {() => (
            <Segmented
              label="Photo treatment"
              value={theme.photo}
              options={[
                { value: "color", label: "Colour" },
                { value: "mono", label: "Black and white" },
                { value: "duotone", label: "Duotone" },
              ]}
              onChange={(photo) => patch({ photo })}
            />
          )}
        </Field>
      </PanelSection>

      <p className="border-t border-white/10 pt-5 text-[13px] leading-snug text-white/50">
        {info?.own ? (
          <>
            Changes save to {info.name}.{" "}
            <Link
              href={
                admin
                  ? `/admin/artist-themes/${info.id}`
                  : `/dashboard/themes/${info.id}`
              }
              className="text-white underline underline-offset-4 hover:text-[var(--ed)]"
            >
              Rename or share it
            </Link>
          </>
        ) : info ? (
          `Your first change copies ${info.name} into a theme of your own, so other pages using it stay as they are.`
        ) : (
          "Your first change makes a theme of your own from the Atmos look."
        )}
      </p>
    </div>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Swatches, a picker and a hex field for one colour. */
function ColourField({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string;
  value: string;
  swatches: readonly string[];
  onChange: (hex: string) => void;
}) {
  // The hex field holds what's typed until it's a valid colour.
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  return (
    <Field label={label}>
      {(id) => (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`${label} ${c}`}
                aria-pressed={value.toLowerCase() === c}
                onClick={() => onChange(c)}
                className={cn(
                  "size-8 rounded-full border border-white/20 transition-shadow",
                  value.toLowerCase() === c
                    ? "shadow-[0_0_0_2px_#000,0_0_0_4px_var(--ed)]"
                    : "hover:shadow-[0_0_0_2px_#000,0_0_0_4px_rgb(255_255_255/0.4)]",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-full border border-white/20">
              <span className="sr-only">{label} picker</span>
              <span
                className="absolute inset-0"
                style={{ background: value }}
              />
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
            <TextInput
              id={id}
              value={draft}
              spellCheck={false}
              aria-invalid={!HEX.test(draft)}
              onChange={(e) => {
                setDraft(e.target.value);
                if (HEX.test(e.target.value))
                  onChange(e.target.value.toLowerCase());
              }}
              className="w-36 font-mono uppercase"
            />
          </div>
        </div>
      )}
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Profile

/** Name, photos, words, address and whether the page is live. */
export function ProfilePanel({ store }: { store: EditorStore }) {
  const router = useRouter();
  const identity = useEditor(store, (s) => s.identity);
  const profileId = useEditor(store, (s) => s.profileId);
  const isPublished = useEditor(store, (s) => s.isPublished);
  const [handle, setHandle] = useState(identity.handle);
  const setAvatar = api.artistProfiles.setAvatar.useMutation();
  const clearAvatar = api.artistProfiles.clearAvatar.useMutation();
  const setBanner = api.artistProfiles.setBanner.useMutation();
  const clearBanner = api.artistProfiles.clearBanner.useMutation();
  const rename = api.artistProfiles.updateProfile.useMutation();
  const publish = api.artistProfiles.publish.useMutation();
  const unpublish = api.artistProfiles.unpublish.useMutation();
  const patch = store.getState().patchIdentity;

  const savePhoto = async (
    kind: "avatar" | "banner",
    fileId: string | null,
  ) => {
    try {
      if (kind === "avatar") {
        await (fileId
          ? setAvatar.mutateAsync({ profileId, fileId })
          : clearAvatar.mutateAsync({ profileId }));
        patch({ avatarFileId: fileId }, { saved: true });
      } else {
        await (fileId
          ? setBanner.mutateAsync({ profileId, fileId })
          : clearBanner.mutateAsync({ profileId }));
        patch({ bannerFileId: fileId }, { saved: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the photo");
    }
  };

  const handleValid = /^[a-z0-9_-]{3,30}$/.test(handle);

  return (
    <div className="space-y-6">
      <PanelSection title="Photos">
        <div className="space-y-2">
          <p className="t-label text-[10px] text-white/60">Portrait</p>
          <ImageUploadField
            aspect="portrait"
            value={identity.avatarFileId}
            onChange={(fileId) => void savePhoto("avatar", fileId)}
            preset="artistAvatar"
            context={{ profileId }}
            helperText="Your photo. Layouts without a banner use it up top."
          />
        </div>
        <div className="space-y-2">
          <p className="t-label text-[10px] text-white/60">Banner</p>
          <ImageUploadField
            aspect="wide"
            value={identity.bannerFileId}
            onChange={(fileId) => void savePhoto("banner", fileId)}
            preset="artistBanner"
            context={{ profileId }}
            helperText="The big photo behind your name. Wide ones work best."
          />
        </div>
      </PanelSection>

      <PanelSection title="About you">
        <Field
          label="Name"
          error={identity.displayName.trim() ? null : "Your page needs a name."}
        >
          {(id) => (
            <TextInput
              id={id}
              value={identity.displayName}
              maxLength={120}
              onChange={(e) => patch({ displayName: e.target.value })}
            />
          )}
        </Field>
        <Field label="Tagline" hint="One line under your name.">
          {(id) => (
            <TextInput
              id={id}
              value={identity.tagline ?? ""}
              maxLength={240}
              placeholder="House, garage and breaks from Pōneke"
              onChange={(e) => patch({ tagline: e.target.value })}
            />
          )}
        </Field>
        <Field label="Bio" hint="A blank line starts a new paragraph.">
          {(id) => (
            <TextArea
              id={id}
              rows={6}
              value={identity.bio ?? ""}
              maxLength={20_000}
              onChange={(e) => patch({ bio: e.target.value })}
            />
          )}
        </Field>
      </PanelSection>

      <PanelSection title="Address">
        <Field
          label="Handle"
          error={
            handle && !handleValid
              ? "3 to 30 lowercase letters, numbers, - or _."
              : rename.error?.message
          }
          hint={`atmosmedia.co.nz/@${handleValid ? handle : identity.handle}`}
        >
          {(id) => (
            <div className="flex gap-2">
              <TextInput
                id={id}
                value={handle}
                spellCheck={false}
                autoCapitalize="none"
                onChange={(e) =>
                  setHandle(e.target.value.toLowerCase().replace(/\s/g, "-"))
                }
              />
              <PanelButton
                className="h-11 shrink-0"
                disabled={
                  !handleValid || handle === identity.handle || rename.isPending
                }
                onClick={async () => {
                  // The page reloads at the new address from what's saved.
                  await store.getState().flush();
                  await rename.mutateAsync({ profileId, data: { handle } });
                  patch({ handle }, { saved: true });
                  router.replace(`/artist/${handle}?edit`);
                }}
              >
                {rename.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Change
              </PanelButton>
            </div>
          )}
        </Field>
      </PanelSection>

      <PanelSection title="Visibility">
        <SiteSwitch
          label="Published"
          description={
            isPublished
              ? "Anyone can see your page."
              : "Only you and Atmos admins can see your page."
          }
          checked={isPublished}
          disabled={publish.isPending || unpublish.isPending}
          onCheckedChange={async (on) => {
            await (on ? publish : unpublish).mutateAsync({ profileId });
            store.getState().setPublished(on);
          }}
        />
      </PanelSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Socials

const OTHER = "__other__";

/** The round icon links in the header, and the Social links block. */
export function SocialsPanel({ store }: { store: EditorStore }) {
  const socials = useEditor(store, (s) => s.socials);
  const set = store.getState().setSocials;
  const edit = (i: number, patch: Partial<PublicSocial>) =>
    set(socials.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, to: number) => {
    const next = [...socials];
    const [row] = next.splice(i, 1);
    next.splice(to, 0, row!);
    set(next);
  };

  return (
    <div className="space-y-4">
      {socials.length === 0 ? (
        <p className="text-[14px] leading-relaxed text-white/60">
          Add your Instagram, SoundCloud and the rest. They show as round
          buttons under your name.
        </p>
      ) : null}
      {socials.map((social, i) => {
        const known = matchSocialPlatform(social.platform);
        const url = normalizeSocialUrl(social.platform, social.url);
        const bad =
          social.url.trim() !== "" &&
          (known
            ? !known.normalizeInput(social.url.trim())
            : !/^https?:\/\/\S+\.\S+/.test(url));
        return (
          <div
            key={i}
            className="space-y-2.5 rounded-[18px] border border-white/10 p-3"
          >
            <div className="flex items-center gap-1.5">
              <SiteSelect
                label={`Social ${i + 1} platform`}
                value={known?.id ?? OTHER}
                options={[
                  ...SOCIAL_PLATFORMS.map((p) => ({
                    value: p.id,
                    label: p.name,
                  })),
                  { value: OTHER, label: "Other" },
                ]}
                onValueChange={(v) => {
                  if (v === OTHER) return edit(i, { platform: "" });
                  const platform = SOCIAL_PLATFORMS.find((p) => p.id === v);
                  if (!platform) return;
                  edit(i, {
                    platform: platform.id,
                    url:
                      platform.normalizeInput(social.url.trim()) ?? social.url,
                  });
                }}
                className="h-11"
              />
              <IconAction
                label="Move up"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp className="size-4" />
              </IconAction>
              <IconAction
                label="Move down"
                disabled={i === socials.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown className="size-4" />
              </IconAction>
              <IconAction
                label={`Remove social ${i + 1}`}
                onClick={() => set(socials.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </IconAction>
            </div>
            {!known ? (
              <TextInput
                aria-label={`Social ${i + 1} name`}
                placeholder="Bluesky"
                value={social.platform}
                onChange={(e) => edit(i, { platform: e.target.value })}
              />
            ) : null}
            <TextInput
              aria-label={`Social ${i + 1} link`}
              placeholder={known?.inputPlaceholder ?? "https://..."}
              value={social.url}
              aria-invalid={bad}
              onChange={(e) => edit(i, { url: e.target.value })}
              onBlur={() => {
                if (!bad && url !== social.url) edit(i, { url });
              }}
            />
            {bad ? (
              <p className="text-site-danger-text px-2 text-[13px]">
                {known?.supportsHandleInput
                  ? `Enter your ${known.name} handle or link.`
                  : known
                    ? `Paste the link to your ${known.name} page.`
                    : "Enter a full link starting with https://"}
              </p>
            ) : null}
          </div>
        );
      })}
      <PanelButton
        className="w-full"
        onClick={() =>
          set([...socials, { platform: "instagram", url: "", label: null }])
        }
      >
        <Plus className="size-3.5" /> Add a social
      </PanelButton>
    </div>
  );
}
