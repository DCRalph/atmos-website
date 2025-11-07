"use client";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";

export function ContactManager() {
  const { data: submissions, refetch } = api.contact.getAll.useQuery();
  const deleteSubmission = api.contact.delete.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Submissions</CardTitle>
        <CardDescription>View and manage contact form submissions</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions?.map((submission) => (
              <TableRow key={submission.id}>
                <TableCell>{submission.name}</TableCell>
                <TableCell>{submission.email}</TableCell>
                <TableCell>{submission.subject}</TableCell>
                <TableCell>{submission.createdAt.toLocaleDateString()}</TableCell>
                <TableCell>
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
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this submission?")) {
                          deleteSubmission.mutate({ id: submission.id });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

