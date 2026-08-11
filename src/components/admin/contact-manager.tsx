"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useConfirm } from "~/components/confirm-provider";

export function ContactManager() {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const {
    data: submissions,
    isLoading,
    refetch,
  } = api.contact.getAll.useQuery(search ? { search } : undefined);
  const deleteSubmission = api.contact.delete.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });
  const rows = submissions ?? [];
  type SubmissionRow = (typeof rows)[number];
  const columns: DataTableColumn<SubmissionRow>[] = [
    { id: "name", header: "Name", accessor: (row) => row.name },
    { id: "email", header: "Email", accessor: (row) => row.email },
    { id: "subject", header: "Subject", accessor: (row) => row.subject },
    {
      id: "date",
      header: "Date",
      cell: (row) => row.createdAt.toLocaleDateString(),
    },
    {
      id: "actions",
      header: "Actions",
      hideable: false,
      cell: (submission) => (
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                View
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Contact Submission</DialogTitle>
                <DialogDescription>
                  Submitted on {submission.createdAt.toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">Name:</p>
                  <p>{submission.name}</p>
                </div>
                <div>
                  <p className="font-semibold">Email:</p>
                  <p>{submission.email}</p>
                </div>
                <div>
                  <p className="font-semibold">Subject:</p>
                  <p>{submission.subject}</p>
                </div>
                <div>
                  <p className="font-semibold">Message:</p>
                  <p className="whitespace-pre-wrap">{submission.message}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              const ok = await confirm({
                title: "Delete submission",
                description:
                  "Are you sure you want to delete this submission? This action cannot be undone.",
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
      <CardHeader>
        <CardTitle>Contact Submissions</CardTitle>
        <CardDescription>
          View and manage contact form submissions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search by name, email, subject, or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
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
