"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { extractEmails } from "~/lib/mailouts/emails";

/** A picker of the lists that can take new people. */
function ListSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const lists = api.mailingLists.list.useQuery();
  const open = lists.data?.filter((list) => !list.archivedAt) ?? [];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Pick a list" />
      </SelectTrigger>
      <SelectContent>
        {open.map((list) => (
          <SelectItem key={list.id} value={list.id}>
            {list.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function useRefresh() {
  const utils = api.useUtils();
  return () => {
    void utils.subscribers.invalidate();
    void utils.mailingLists.list.invalidate();
  };
}

export function AddSubscriberDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [listId, setListId] = useState("");
  const refresh = useRefresh();
  const add = api.subscribers.add.useMutation({
    onSuccess: ({ result }) => {
      toast.success(result === "already" ? "Already on that list" : "Added");
      refresh();
      setEmail("");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate({ email: email.trim(), listId });
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a subscriber</DialogTitle>
            <DialogDescription>
              Only add people who asked to hear from Atmos. Anyone who
              unsubscribed can only rejoin themselves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="add-email">Email</Label>
            <Input
              id="add-email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-list">List</Label>
            <ListSelect id="add-list" value={listId} onChange={setListId} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!listId || add.isPending}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [listId, setListId] = useState("");
  const [consent, setConsent] = useState(false);
  const refresh = useRefresh();
  const emails = extractEmails(text);
  const importing = api.subscribers.import.useMutation({
    onSuccess: (counts) => {
      const skipped = [
        counts.already && `${counts.already} already on it`,
        counts.left && `${counts.left} unsubscribed before`,
        counts.suppressed && `${counts.suppressed} suppressed`,
        counts.invalid && `${counts.invalid} not valid`,
      ].filter(Boolean);
      toast.success(
        `Added ${counts.added}${skipped.length ? `. Skipped ${skipped.join(", ")}.` : "."}`,
      );
      refresh();
      setText("");
      setConsent(false);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (consent) importing.mutate({ listId, emails, consent });
          }}
        >
          <DialogHeader>
            <DialogTitle>Import subscribers</DialogTitle>
            <DialogDescription>
              Paste addresses or a CSV, or pick a file. Anything that looks like
              an email is read; the rest is ignored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="import-list">List</Label>
            <ListSelect id="import-list" value={listId} onChange={setListId} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="import-text">Addresses</Label>
              <Input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="h-8 w-auto text-xs"
                aria-label="Read addresses from a file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setText(await file.text());
                }}
              />
            </div>
            <Textarea
              id="import-text"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"sam@example.com\njo@example.co.nz"}
            />
            <p className="text-muted-foreground text-xs">
              {emails.length} address{emails.length === 1 ? "" : "es"} found.
              People who unsubscribed or bounced are not added back.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
              className="mt-0.5"
            />
            These people agreed to get email from Atmos.
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !listId ||
                !consent ||
                emails.length === 0 ||
                emails.length > 20_000 ||
                importing.isPending
              }
            >
              Import {emails.length || ""}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
