"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Loader2, Plus, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "~/components/confirm-provider";

export function SettingsManager() {
  const confirm = useConfirm();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const utils = api.useUtils();
  const { data: settings, isLoading } = api.settings.getAll.useQuery();

  const upsertMutation = api.settings.upsert.useMutation({
    onSuccess: () => {
      toast.success(editingKey ? "Setting updated" : "Setting created");
      utils.settings.getAll.invalidate();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = api.settings.delete.useMutation({
    onSuccess: () => {
      toast.success("Setting deleted");
      utils.settings.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setKey("");
    setValue("");
    setEditingKey(null);
  };

  const handleEdit = (setting: { key: string; value: string }) => {
    setKey(setting.key);
    setValue(setting.value);
    setEditingKey(setting.key);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate({ key, value });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Add Setting
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingKey ? "Edit Setting" : "Add New Setting"}
                </DialogTitle>
                <DialogDescription>
                  Create or update a key-value pair in the system settings.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="key">Key</Label>
                  <Input
                    id="key"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="e.g. gearRentalNotification"
                    disabled={!!editingKey}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="value">Value</Label>
                  <Input
                    id="value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Value for the setting"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingKey ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No settings found.
                </TableCell>
              </TableRow>
            ) : (
              settings?.map((setting) => (
                <TableRow key={setting.key}>
                  <TableCell className="font-medium">{setting.key}</TableCell>
                  <TableCell className="max-w-md truncate">
                    {setting.value}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(setting)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Delete setting",
                            description: `Are you sure you want to delete ${setting.key}? This action cannot be undone.`,
                            confirmLabel: "Delete",
                            variant: "destructive",
                          });
                          if (ok) {
                            deleteMutation.mutate({ key: setting.key });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
