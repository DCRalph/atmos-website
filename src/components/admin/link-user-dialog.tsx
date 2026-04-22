"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export type LinkUserTarget = {
  profileId: string;
  handle: string;
  currentUserId?: string | null;
  currentUserName?: string | null;
};

export function LinkUserDialog({
  target,
  onClose,
  onLinked,
}: {
  target: LinkUserTarget | null;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [query, setQuery] = useState("");
  const [pickedUserId, setPickedUserId] = useState<string | null>(null);
  const [mergeConfirm, setMergeConfirm] = useState(false);

  useEffect(() => {
    if (!target) {
      setQuery("");
      setPickedUserId(null);
      setMergeConfirm(false);
    }
  }, [target]);

  const users = api.users.getAll.useQuery(
    query ? { search: query } : undefined,
    { enabled: Boolean(target) },
  );
  const link = api.creatorProfiles.linkUserToProfile.useMutation({
    onSuccess: () => {
      onLinked();
      setPickedUserId(null);
      setMergeConfirm(false);
      setQuery("");
    },
  });

  const needsMerge = link.error?.data?.code === "CONFLICT";
  const isRelink = Boolean(target?.currentUserId);

  return (
    <Dialog open={Boolean(target)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRelink
              ? `Relink @${target?.handle} to a different user`
              : `Link a user to @${target?.handle}`}
          </DialogTitle>
          <DialogDescription>
            {isRelink ? (
              <>
                Currently linked to{" "}
                <b>{target?.currentUserName ?? target?.currentUserId}</b>. The
                selected user will replace them as the owner of this profile.
              </>
            ) : (
              <>
                Once linked, the user can edit this profile from their creator
                dashboard.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Search users</Label>
            <Input
              placeholder="Name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border">
            {(users.data ?? []).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setPickedUserId(u.id)}
                className={`hover:bg-accent/30 flex w-full items-center justify-between px-3 py-2 text-left ${
                  pickedUserId === u.id ? "bg-accent/40" : ""
                }`}
              >
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-muted-foreground text-xs">{u.email}</div>
                </div>
                {target?.currentUserId === u.id && (
                  <span className="text-muted-foreground text-xs">
                    current
                  </span>
                )}
              </button>
            ))}
            {users.data && users.data.length === 0 && (
              <div className="text-muted-foreground px-3 py-4 text-sm">
                No users match.
              </div>
            )}
          </div>
          {needsMerge && (
            <div className="rounded-md border border-amber-500/60 bg-amber-500/10 p-3 text-sm">
              This user already has a profile. Merging will move their blocks,
              socials and gig attributions into <b>@{target?.handle}</b> and
              delete the duplicate. Continue?
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMergeConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!target || !pickedUserId) return;
                    setMergeConfirm(true);
                    link.mutate({
                      profileId: target.profileId,
                      userId: pickedUserId,
                      merge: true,
                    });
                  }}
                >
                  Merge & link
                </Button>
              </div>
            </div>
          )}
          {link.error && !needsMerge && (
            <p className="text-destructive text-sm">{link.error.message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!target || !pickedUserId) return;
              link.mutate({
                profileId: target.profileId,
                userId: pickedUserId,
                merge: mergeConfirm,
              });
            }}
            disabled={
              link.isPending ||
              !pickedUserId ||
              pickedUserId === target?.currentUserId
            }
          >
            {link.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isRelink ? "Relinking…" : "Linking…"}
              </>
            ) : isRelink ? (
              "Relink"
            ) : (
              "Link user"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
