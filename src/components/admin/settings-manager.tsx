"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { DataTable, type DataTableColumn } from "~/components/data-table";
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
  const {
    data: settings,
    isLoading,
    isFetching,
  } = api.settings.getAll.useQuery();

  const upsertMutation = api.settings.upsert.useMutation({
    onSuccess: () => {
      toast.success(editingKey ? "Setting updated" : "Setting created");
      void utils.settings.getAll.invalidate();
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
      void utils.settings.getAll.invalidate();
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

  const rows = settings ?? [];
  type SettingRow = (typeof rows)[number];
  const columns: DataTableColumn<SettingRow>[] = [
    {
      id: "key",
      header: "Key",
      sortable: true,
      accessor: (row) => row.key,
      className: "font-mono font-medium",
    },
    {
      id: "value",
      header: "Value",
      sortable: true,
      accessor: (row) => row.value,
      // `max-width` on a table cell is only a suggestion in auto layout, so the
      // clamp goes on a block inside it or a long value stretches the table.
      cell: (row) => (
        <div className="max-w-md truncate" title={row.value}>
          {row.value}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (setting) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${setting.key}`}
            onClick={() => handleEdit(setting)}
          >
            <Edit2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${setting.key}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => {
              const ok = await confirm({
                title: "Delete setting",
                description: `Are you sure you want to delete ${setting.key}? This action cannot be undone.`,
                confirmLabel: "Delete",
                variant: "destructive",
              });
              if (ok) deleteMutation.mutate({ key: setting.key });
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

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
                  {editingKey ? "Edit setting" : "Add setting"}
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
                  {editingKey ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.key}
        isLoading={isLoading}
        isFetching={isFetching}
        storageKey="admin-settings"
        emptyMessage="No settings yet."
      />
    </div>
  );
}
