"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { PickerSelect } from "~/components/ui/picker-select";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { cn } from "~/lib/utils";
import { Caution, Choice, DiffList, Field, shown, type DiffRow } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "start", label: "New or existing" },
  { key: "artist", label: "The artist" },
  { key: "owner", label: "Who owns it" },
  { key: "review", label: "Review" },
] as const;

type Mode = "new" | "existing";
type Profile = RouterOutputs["artistProfiles"]["listAll"][number];
type PickedUser = { id: string; name: string; email: string };

const CLAIM: Record<Profile["claimStatus"], string> = {
  ACTIVE: "Has an owner",
  UNCLAIMED: "Unclaimed",
  PENDING_CLAIM: "Claim waiting",
};

const profileHref = (id: string) => `/admin/artist-profiles/${id}`;

/**
 * Add an artist, or hand one to its artist: make a new profile and
 * optionally link it to their account, or link an existing profile to the
 * account of the artist it belongs to. Nothing is emailed; the artist finds
 * it on their dashboard once linked.
 */
export function ArtistWizard() {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const [mode, setMode] = useState<Mode>("new");

  // A new profile.
  const [displayName, setDisplayName] = useState("");
  const [typedHandle, setTypedHandle] = useState<string | null>(null);
  const [tagline, setTagline] = useState("");
  const [linkNow, setLinkNow] = useState(false);

  // An existing one.
  const [profile, setProfile] = useState<Profile | null>(null);

  const [user, setUser] = useState<PickedUser | null>(null);
  const [needsMerge, setNeedsMerge] = useState(false);
  const [done, setDone] = useState<{
    id: string;
    handle: string;
    linked: boolean;
  } | null>(null);

  // The handle follows the name until someone types one of their own.
  const settledName = useDebouncedValue(displayName.trim());
  const suggestion = api.artistProfiles.suggestHandle.useQuery(
    { name: settledName },
    { enabled: mode === "new" && typedHandle === null && settledName !== "" },
  );
  const handle = (typedHandle ?? suggestion.data?.handle ?? "")
    .trim()
    .toLowerCase();
  const settledHandle = useDebouncedValue(handle);
  const availability = api.artistProfiles.handleAvailable.useQuery(
    { handle: settledHandle },
    { enabled: mode === "new" && typedHandle !== null && settledHandle !== "" },
  );
  const handleError =
    typedHandle === null
      ? null
      : availability.data && !availability.data.available
        ? availability.data.reason
        : null;
  const handleChecking =
    typedHandle !== null &&
    (settledHandle !== handle || availability.isFetching);

  const finish = async (result: {
    id: string;
    handle: string;
    linked: boolean;
  }) => {
    setDone(result);
    toast.success(result.linked ? "Profile linked" : "Profile made");
    await utils.artistProfiles.listAll.invalidate();
  };

  const create = api.artistProfiles.createProfile.useMutation({
    onSuccess: (created) =>
      finish({
        id: created.id,
        handle: created.handle,
        linked: Boolean(created.userId),
      }),
    onError: (error) => toast.error(error.message),
  });

  const link = api.artistProfiles.linkUserToProfile.useMutation({
    onSuccess: () =>
      profile
        ? finish({ id: profile.id, handle: profile.handle, linked: true })
        : undefined,
    // A conflict is the merge question below, not a failure.
    onError: (error) => {
      if (error.data?.code === "CONFLICT") {
        setNeedsMerge(true);
        return;
      }
      toast.error(error.message);
    },
  });

  const save = (merge = false) => {
    if (mode === "new") {
      create.mutate({
        handle,
        displayName: displayName.trim(),
        tagline: tagline.trim() || null,
        userId: linkNow && user ? user.id : null,
      });
    } else if (profile && user) {
      link.mutate({ profileId: profile.id, userId: user.id, merge });
    }
  };

  const ownerLabel = (picked: PickedUser | null) =>
    picked ? `${picked.name} (${picked.email})` : "Nobody yet";

  const rows: DiffRow[] =
    mode === "new"
      ? [
          { label: "Name", before: "Not set", after: shown(displayName) },
          { label: "Handle", before: "Not set", after: `@${handle}` },
          ...(tagline.trim()
            ? [{ label: "Tagline", before: "Not set", after: tagline.trim() }]
            : []),
          {
            label: "Owner",
            before: "Nobody",
            after: linkNow ? ownerLabel(user) : "Unclaimed",
          },
        ]
      : profile
        ? [
            {
              label: `@${profile.handle} owner`,
              before: profile.user
                ? `${profile.user.name} (${profile.user.email})`
                : "Nobody",
              after: ownerLabel(user),
            },
          ]
        : [];

  const artistReady =
    mode === "new"
      ? displayName.trim() !== "" &&
        handle !== "" &&
        !handleError &&
        !handleChecking &&
        (typedHandle !== null || !suggestion.isFetching)
      : profile !== null;
  const ownerReady = mode === "new" ? !linkNow || user !== null : user !== null;
  const isDirty =
    !done && (displayName.trim() !== "" || profile !== null || user !== null);

  return (
    <WizardShell
      wizard="artist"
      steps={steps}
      isDirty={isDirty}
      done={
        done ? (
          <DonePanel
            title={
              done.linked ? `@${done.handle} is theirs` : `@${done.handle} made`
            }
            description={
              done.linked
                ? "They can edit it from their artist dashboard. Nothing was emailed."
                : "It isn't published yet, so only admins can see it. Publish it, then send them its page: they sign in and press Claim."
            }
            next={[{ key: "lineup" }]}
            links={[
              {
                href: profileHref(done.id),
                label: done.linked ? "Open the profile" : "Finish and publish",
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "start" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>New or existing?</CardTitle>
              <CardDescription>
                Make a profile for an artist who isn&apos;t on the site yet, or
                give one that already exists to the artist it belongs to.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                <Choice
                  selected={mode === "new"}
                  onSelect={() => setMode("new")}
                  title="Make a new profile"
                  detail="Name and handle now, the rest later."
                />
                <Choice
                  selected={mode === "existing"}
                  onSelect={() => setMode("existing")}
                  title="Hand an existing profile to its artist"
                  detail="Link it to their account so they can edit it."
                />
              </div>
            </CardContent>
          </Card>
          <WizardFooter
            onNext={() => {
              setUser(null);
              setNeedsMerge(false);
              steps.next();
            }}
          />
        </>
      ) : null}

      {steps.step === "artist" && mode === "new" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>The artist</CardTitle>
              <CardDescription>
                The handle is their address on the site, like /artist/handle.
                Bio, photos and links are filled in on the profile itself.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="artist-name" label="Name" required>
                <Input
                  id="artist-name"
                  value={displayName}
                  maxLength={120}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="As it goes on the poster"
                  autoFocus
                />
              </Field>
              <Field
                id="artist-handle"
                label="Handle"
                required
                error={handleError ?? undefined}
                hint={
                  typedHandle === null
                    ? "Made from the name. Type to change it."
                    : handleChecking
                      ? "Checking..."
                      : availability.data?.available
                        ? "Free."
                        : undefined
                }
              >
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    @
                  </span>
                  <Input
                    id="artist-handle"
                    value={handle}
                    maxLength={30}
                    onChange={(e) =>
                      setTypedHandle(e.target.value.toLowerCase())
                    }
                    className="pl-7"
                  />
                </div>
              </Field>
              <div className="sm:col-span-2">
                <Field id="artist-tagline" label="Tagline">
                  <Input
                    id="artist-tagline"
                    value={tagline}
                    maxLength={240}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Optional. One line under their name."
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={!artistReady}
          />
        </>
      ) : null}

      {steps.step === "artist" && mode === "existing" ? (
        <>
          <FindProfile
            picked={profile}
            onPick={(next) => {
              setProfile(next);
              setNeedsMerge(false);
            }}
          />
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={!artistReady}
            hint={profile ? undefined : "Pick a profile."}
          />
        </>
      ) : null}

      {steps.step === "owner" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Who owns it</CardTitle>
              <CardDescription>
                {mode === "new"
                  ? "If they already have an account on the site, link it now. Otherwise leave it unclaimed and they can claim it later."
                  : "The artist's own account. They need to have signed up first."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "new" ? (
                <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                  <Choice
                    selected={linkNow}
                    onSelect={() => setLinkNow(true)}
                    title="Link it to their account now"
                    detail="They can edit it straight away."
                  />
                  <Choice
                    selected={!linkNow}
                    onSelect={() => setLinkNow(false)}
                    title="Leave it unclaimed"
                    detail="They claim it from its page once it is published."
                  />
                </div>
              ) : profile?.user ? (
                <Caution>
                  @{profile.handle} is linked to {profile.user.name}. Linking
                  someone else takes it off them.
                </Caution>
              ) : null}
              {mode === "existing" || linkNow ? (
                <Field id="artist-owner" label="Their account">
                  <PickerSelect
                    id="artist-owner"
                    endpoint={api.pickers.users}
                    value={user?.id ?? null}
                    onChange={(value, option) => {
                      setNeedsMerge(false);
                      setUser(
                        value && option
                          ? {
                              id: value,
                              name: option.label,
                              email: option.description ?? "",
                            }
                          : null,
                      );
                    }}
                    placeholder="Search by name or email"
                    emptyText="Nobody matches. They need to sign up first."
                  />
                </Field>
              ) : null}
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={!ownerReady}
            hint={ownerReady ? undefined : "Pick their account."}
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <DiffList rows={rows}>
            {needsMerge && profile ? (
              <div className="space-y-2">
                <Caution>
                  That account already has its own profile. Merging moves its
                  blocks into @{profile.handle} and deletes the other one.
                </Caution>
                <Button
                  variant="outline"
                  onClick={() => save(true)}
                  disabled={link.isPending}
                >
                  Merge them
                </Button>
              </div>
            ) : null}
          </DiffList>
          <WizardFooter
            onBack={steps.back}
            label={mode === "new" ? "Make the profile" : "Link it"}
            onNext={() => save()}
            disabled={!artistReady || !ownerReady || needsMerge}
            isPending={create.isPending || link.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}

/** Search the artist profiles, showing who owns each one. */
function FindProfile({
  picked,
  onPick,
}: {
  picked: Profile | null;
  onPick: (profile: Profile) => void;
}) {
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim());
  const profiles = api.artistProfiles.listAll.useQuery(
    search ? { search } : undefined,
    { placeholderData: (previous) => previous },
  );
  const list = (profiles.data ?? []).slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Which profile?</CardTitle>
        <CardDescription>
          Unclaimed profiles were made by an admin and have nobody to edit them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or handle"
            className="pl-9"
            aria-label="Search profiles"
            autoFocus
          />
        </div>
        {profiles.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading...
          </div>
        ) : list.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {search ? "No profiles match." : "No profiles yet."}
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {list.map((profile) => (
              <li key={profile.id}>
                <button
                  type="button"
                  onClick={() => onPick(profile)}
                  aria-pressed={picked?.id === profile.id}
                  className={cn(
                    "hover:bg-secondary/60 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    picked?.id === profile.id && "bg-secondary",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {profile.displayName}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      @{profile.handle}
                      {profile.user ? ` · ${profile.user.name}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      profile.claimStatus === "ACTIVE"
                        ? "text-muted-foreground"
                        : "text-amber-200",
                    )}
                  >
                    {CLAIM[profile.claimStatus]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
