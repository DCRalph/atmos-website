"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { GigMediaManager } from "~/components/admin/gig-media-manager";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Loader2, ExternalLink, Trash2, ArrowLeft } from "lucide-react";
import { CoreDetailsCard } from "~/components/admin/gig-edit/core-details-card";
import { DateTimeCard } from "~/components/admin/gig-edit/date-time-card";
import { TagsCard } from "~/components/admin/gig-edit/tags-card";
import { PosterCard } from "~/components/admin/gig-edit/poster-card";
import { CreatorsCard } from "~/components/admin/gig-edit/creators-card";
import { SaveStatusPill } from "~/components/admin/gig-edit/save-status";

type PageProps = {
  params: Promise<{ id: string }>;
};

type DirtySection = "core" | "dateTime";

export default function GigManagementPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: gig, refetch, isLoading } = api.gigs.getById.useQuery({ id });
  const [dirtySections, setDirtySections] = useState<Set<DirtySection>>(
    new Set(),
  );
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [confirmNavigation, setConfirmNavigation] = useState<{
    open: boolean;
    href: string | null;
  }>({ open: false, href: null });

  const deleteGig = api.gigs.delete.useMutation({
    onSuccess: () => {
      toast.success("Gig deleted");
      router.push("/admin/gigs");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete gig");
    },
  });

  const setDirty = useCallback((section: DirtySection, dirty: boolean) => {
    setDirtySections((prev) => {
      const next = new Set(prev);
      if (dirty) next.add(section);
      else next.delete(section);
      return next;
    });
  }, []);

  const isDirty = dirtySections.size > 0;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleRefetch = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleProtectedNavigate = (href: string) => {
    if (isDirty) {
      setConfirmNavigation({ open: true, href });
    } else {
      router.push(href);
    }
  };

  const globalStatus = useMemo<"idle" | "dirty">(
    () => (isDirty ? "dirty" : "idle"),
    [isDirty],
  );

  if (isLoading || !gig) {
    return (
      <AdminSection
        title="Manage Gig"
        backLink={{ href: "/admin/gigs", label: "← Back to Gigs" }}
      >
        <div className="text-muted-foreground flex items-center gap-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading gig...</span>
        </div>
      </AdminSection>
    );
  }

  const media = gig.media ?? [];
  const gigTags =
    (gig.gigTags as Array<{
      id: string;
      gigTag: {
        id: string;
        name: string;
        color: string;
        description: string | null;
      };
    }>) ?? [];

  return (
    <AdminSection
      title="Manage Gig"
      subtitle={gig.title}
      actions={
        <div className="flex items-center gap-2">
          <SaveStatusPill status={globalStatus} />
          <Button
            variant="outline"
            onClick={() => handleProtectedNavigate(`/gigs/${gig.id}`)}
          >
            <ExternalLink className="h-4 w-4" />
            View Gig
          </Button>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteOpen(true)}
            disabled={deleteGig.isPending}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      }
    >
      <div className="mb-4">
        <Button
          variant="outline"
          onClick={() => handleProtectedNavigate("/admin/gigs")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Gigs
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          <CoreDetailsCard
            gig={{
              id: gig.id,
              title: gig.title,
              subtitle: gig.subtitle,
              shortDescription: gig.shortDescription,
              descriptionLexical: gig.descriptionLexical,
              mode: gig.mode,
              ticketLink: gig.ticketLink,
            }}
            onSaved={handleRefetch}
            onDirtyChange={(dirty) => setDirty("core", dirty)}
          />
        </div>

        <div className="flex flex-col gap-6 xl:col-span-4">
          <DateTimeCard
            gig={{
              id: gig.id,
              gigStartTime: gig.gigStartTime,
              gigEndTime: gig.gigEndTime,
            }}
            onSaved={handleRefetch}
            onDirtyChange={(dirty) => setDirty("dateTime", dirty)}
          />
          <TagsCard
            gigId={gig.id}
            gigTags={gigTags}
            onSaved={handleRefetch}
          />
        </div>

        <div className="xl:col-span-12">
          <CreatorsCard
            gigId={gig.id}
            gigCreators={(gig.gigCreators ?? []).map((gc) => ({
              id: gc.id,
              role: gc.role,
              sortOrder: gc.sortOrder,
              creatorProfile: {
                id: gc.creatorProfile.id,
                handle: gc.creatorProfile.handle,
                displayName: gc.creatorProfile.displayName,
                avatarFileId: gc.creatorProfile.avatarFileId,
                claimStatus: gc.creatorProfile.claimStatus,
              },
            }))}
            onSaved={handleRefetch}
          />
        </div>

        <div className="xl:col-span-12">
          <PosterCard
            gig={{
              id: gig.id,
              title: gig.title,
              posterFileUpload: gig.posterFileUpload
                ? {
                    name: gig.posterFileUpload.name,
                    url: gig.posterFileUpload.url,
                  }
                : null,
            }}
            onSaved={handleRefetch}
          />
        </div>

        <div className="xl:col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
              <CardDescription>
                Upload and organize photos and videos. Drag and drop to reorder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GigMediaManager
                gigId={gig.id}
                media={media.map((m) => ({
                  id: m.id,
                  type: m.type,
                  url: m.url,
                  section: m.section,
                  sortOrder: m.sortOrder,
                  fileUpload: m.fileUpload,
                }))}
                onRefetch={() => void refetch()}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete gig</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes &quot;{gig.title}&quot;. Media, tags, and
              poster associations will be removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGig.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGig.mutate({ id: gig.id })}
              disabled={deleteGig.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGig.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete gig"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmNavigation.open}
        onOpenChange={(open) => {
          if (!open) setConfirmNavigation({ open: false, href: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Leaving now will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const href = confirmNavigation.href;
                setConfirmNavigation({ open: false, href: null });
                if (href) router.push(href);
              }}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminSection>
  );
}
