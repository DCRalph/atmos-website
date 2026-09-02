"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useConfirm } from "~/components/confirm-provider";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { formatDate, formatDateTime } from "~/lib/date-utils";

export function ContactManager() {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search).trim();
  const {
    data: submissions,
    isLoading,
    isFetching,
    refetch,
  } = api.contact.getAll.useQuery(
    debouncedSearch ? { search: debouncedSearch } : undefined,
  );

  const deleteSubmission = api.contact.delete.useMutation({
    onSuccess: async () => {
      toast.success("Submission deleted");
      await refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = submissions ?? [];
  type SubmissionRow = (typeof rows)[number];
  const columns: DataTableColumn<SubmissionRow>[] = [
    { id: "name", header: "Name", sortable: true, accessor: (row) => row.name },
    {
      id: "email",
      header: "Email",
      type: "email",
      sortable: true,
      accessor: (row) => row.email,
    },
    {
      id: "subject",
      header: "Subject",
      sortable: true,
      accessor: (row) => row.subject,
    },
    {
      id: "date",
      header: "Received",
      sortable: true,
      accessor: (row) => row.createdAt,
      cell: (row) => formatDate(row.createdAt, "short"),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (submission) => (
        <div className="flex justify-end gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                View
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Contact submission</DialogTitle>
                <DialogDescription>
                  Submitted {formatDateTime(submission.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Name
                  </dt>
                  <dd className="font-medium">{submission.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Email
                  </dt>
                  <dd className="font-medium">
                    <a
                      href={`mailto:${submission.email}`}
                      className="hover:underline"
                    >
                      {submission.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Subject
                  </dt>
                  <dd className="font-medium">{submission.subject}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Message
                  </dt>
                  <dd className="whitespace-pre-wrap">{submission.message}</dd>
                </div>
              </dl>
            </DialogContent>
          </Dialog>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteSubmission.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: "Delete submission",
                description: `Delete the message from ${submission.name}? This cannot be undone.`,
                confirmLabel: "Delete",
                variant: "destructive",
              });
              if (ok) deleteSubmission.mutate({ id: submission.id });
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="relative mb-4 max-w-sm">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            placeholder="Search by name, email, subject, or message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {isFetching ? (
            <Loader2
              className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin"
              aria-hidden
            />
          ) : null}
        </div>
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          storageKey="admin-contact-submissions"
          emptyMessage={search ? "No submissions found" : "No submissions yet"}
        />
      </CardContent>
    </Card>
  );
}
