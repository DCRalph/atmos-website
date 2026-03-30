"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { format } from "date-fns";
import { Loader2, Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { Badge } from "~/components/ui/badge";
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
import { PackageItemBadge } from "~/components/rentals/package-item-badge";
import { Textarea } from "~/components/ui/textarea";

type InventoryItemForm = {
  name: string;
  shortName: string;
  description: string;
  quantity: number;
};

type PackageForm = {
  name: string;
  shortName: string;
  description: string;
  price: number;
  itemQuantities: Record<string, number>;
};

function createEmptyInventoryItem(): InventoryItemForm {
  return {
    name: "",
    shortName: "",
    description: "",
    quantity: 1,
  };
}

function createEmptyPackage(): PackageForm {
  return {
    name: "",
    shortName: "",
    description: "",
    price: 0,
    itemQuantities: {},
  };
}

export function GearRentalManager() {
  const [activeTab, setActiveTab] = useState("requests");
  const [isAddingInventoryItem, setIsAddingInventoryItem] = useState(false);
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [newInventoryItem, setNewInventoryItem] = useState(createEmptyInventoryItem());
  const [editingInventoryItem, setEditingInventoryItem] = useState<
    | (InventoryItemForm & {
        id: string;
      })
    | null
  >(null);
  const [newPackage, setNewPackage] = useState(createEmptyPackage());
  const [editingPackage, setEditingPackage] = useState<
    | (PackageForm & {
        id: string;
      })
    | null
  >(null);

  const utils = api.useUtils();

  const { data: inventory, isLoading: inventoryLoading } =
    api.rentals.adminGetInventoryItems.useQuery();
  const { data: packages, isLoading: packagesLoading } =
    api.rentals.adminGetPackages.useQuery();
  const { data: rentals, isLoading: rentalsLoading } =
    api.rentals.adminGetRentals.useQuery();

  const invalidateCatalog = async () => {
    await Promise.all([
      utils.rentals.adminGetInventoryItems.invalidate(),
      utils.rentals.adminGetPackages.invalidate(),
      utils.rentals.getPublicPackages.invalidate(),
      utils.rentals.getPublicRentals.invalidate(),
      utils.rentals.adminGetRentals.invalidate(),
    ]);
  };

  const createInventoryItem = api.rentals.adminCreateInventoryItem.useMutation({
    onSuccess: async () => {
      await invalidateCatalog();
      setIsAddingInventoryItem(false);
      setNewInventoryItem(createEmptyInventoryItem());
    },
  });

  const updateInventoryItem = api.rentals.adminUpdateInventoryItem.useMutation({
    onSuccess: async () => {
      await invalidateCatalog();
      setEditingInventoryItem(null);
    },
  });

  const deleteInventoryItem = api.rentals.adminDeleteInventoryItem.useMutation({
    onSuccess: async () => {
      await invalidateCatalog();
    },
  });

  const createPackage = api.rentals.adminCreatePackage.useMutation({
    onSuccess: async () => {
      await invalidateCatalog();
      setIsAddingPackage(false);
      setNewPackage(createEmptyPackage());
    },
  });

  const updatePackage = api.rentals.adminUpdatePackage.useMutation({
    onSuccess: async () => {
      await invalidateCatalog();
      setEditingPackage(null);
    },
  });

  const deletePackage = api.rentals.adminDeletePackage.useMutation({
    onSuccess: async () => {
      await invalidateCatalog();
    },
  });

  const approveRental = api.rentals.adminApproveRental.useMutation({
    onSuccess: async () => {
      await invalidateCatalog();
    },
  });

  const rejectRental = api.rentals.adminRejectRental.useMutation({
    onSuccess: async () => {
      await invalidateCatalog();
    },
  });

  const deleteRental = api.rentals.adminDeleteRental.useMutation({
    onSuccess: async () => {
      await invalidateCatalog();
    },
  });

  const buildPackagePayload = (form: PackageForm) => ({
    name: form.name,
    shortName: form.shortName || undefined,
    description: form.description || undefined,
    price: form.price,
    items: Object.entries(form.itemQuantities)
      .map(([gearItemId, quantity]) => ({
        gearItemId,
        quantity,
      }))
      .filter((item) => item.quantity > 0),
  });

  const packageHasItems = (form: PackageForm) =>
    Object.values(form.itemQuantities).some((quantity) => quantity > 0);

  const openEditPackage = (gearPackage: NonNullable<typeof packages>[number]) => {
    setEditingPackage({
      id: gearPackage.id,
      name: gearPackage.name,
      shortName: gearPackage.shortName ?? "",
      description: gearPackage.description ?? "",
      price: gearPackage.price,
      itemQuantities: Object.fromEntries(
        gearPackage.items.map((item) => [item.gearItemId, item.quantity]),
      ),
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="requests">Rental Requests</TabsTrigger>
        <TabsTrigger value="inventory">Inventory Items</TabsTrigger>
        <TabsTrigger value="packages">Packages</TabsTrigger>
      </TabsList>

      <TabsContent value="requests" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Rental Requests</CardTitle>
            <CardDescription>
              Review package booking requests and approve them only when the
              underlying inventory is still available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Includes</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentalsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : rentals?.map((rental) => (
                  <TableRow key={rental.id}>
                    <TableCell className="font-medium">{rental.userName}</TableCell>
                    <TableCell className="text-xs">{rental.contactInfo}</TableCell>
                    <TableCell>{rental.gearPackage.name}</TableCell>
                    <TableCell className="max-w-[280px] whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {rental.gearPackage.items.map((item) => (
                          <PackageItemBadge
                            key={item.id}
                            quantity={item.quantity}
                            itemName={item.gearItem.name}
                            shortName={item.gearItem.shortName}
                            description={item.gearItem.description}
                            className="text-[10px]"
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(rental.startDate), "MMM d, yyyy")} - {format(new Date(rental.endDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        rental.status === "APPROVED" ? "outline" : 
                        rental.status === "REJECTED" ? "destructive" : 
                        "default"
                      } className={rental.status === "APPROVED" ? "text-green-500 border-green-500/50" : ""}>
                        {rental.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {rental.status === "PENDING" && (
                        <>
                          <Button size="sm" variant="outline" className="text-green-500" onClick={() => approveRental.mutate({ id: rental.id })}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-500" onClick={() => rejectRental.mutate({ id: rental.id })}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => {
                        if (confirm("Delete this rental record?")) {
                          deleteRental.mutate({ id: rental.id });
                        }
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!rentalsLoading && rentals?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No rental requests yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="inventory" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Inventory Items</CardTitle>
              <CardDescription>
                Manage the underlying stock counts that packages consume.
              </CardDescription>
            </div>
            <Dialog open={isAddingInventoryItem} onOpenChange={setIsAddingInventoryItem}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Inventory Item</DialogTitle>
                  <DialogDescription>
                    Inventory items are not directly rentable. They are used to
                    build packages and track available stock.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Item Name</Label>
                    <Input
                      id="name"
                      value={newInventoryItem.name}
                      onChange={(e) =>
                        setNewInventoryItem({
                          ...newInventoryItem,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shortName">Short Name</Label>
                    <Input
                      id="shortName"
                      value={newInventoryItem.shortName}
                      onChange={(e) =>
                        setNewInventoryItem({
                          ...newInventoryItem,
                          shortName: e.target.value,
                        })
                      }
                      placeholder="e.g. CDJ-3000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newInventoryItem.description}
                      onChange={(e) =>
                        setNewInventoryItem({
                          ...newInventoryItem,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity On Hand</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min={0}
                      value={newInventoryItem.quantity}
                      onChange={(e) =>
                        setNewInventoryItem({
                          ...newInventoryItem,
                          quantity: parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingInventoryItem(false)}>Cancel</Button>
                  <Button
                    onClick={() =>
                      createInventoryItem.mutate({
                        name: newInventoryItem.name,
                        shortName: newInventoryItem.shortName || undefined,
                        description: newInventoryItem.description || undefined,
                        quantity: newInventoryItem.quantity,
                      })
                    }
                    disabled={
                      createInventoryItem.isPending || !newInventoryItem.name.trim()
                    }
                  >
                    {createInventoryItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Item"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Dialog
              open={!!editingInventoryItem}
              onOpenChange={(open) => !open && setEditingInventoryItem(null)}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Inventory Item</DialogTitle>
                </DialogHeader>
                {editingInventoryItem && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Item Name</Label>
                      <Input
                        id="edit-name"
                        value={editingInventoryItem.name}
                        onChange={(e) =>
                          setEditingInventoryItem({
                            ...editingInventoryItem,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-short-name">Short Name</Label>
                      <Input
                        id="edit-short-name"
                        value={editingInventoryItem.shortName}
                        onChange={(e) =>
                          setEditingInventoryItem({
                            ...editingInventoryItem,
                            shortName: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editingInventoryItem.description}
                        onChange={(e) =>
                          setEditingInventoryItem({
                            ...editingInventoryItem,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-quantity">Quantity On Hand</Label>
                      <Input
                        id="edit-quantity"
                        type="number"
                        min={0}
                        value={editingInventoryItem.quantity}
                        onChange={(e) =>
                          setEditingInventoryItem({
                            ...editingInventoryItem,
                            quantity: parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingInventoryItem(null)}>Cancel</Button>
                  <Button
                    onClick={() =>
                      editingInventoryItem &&
                      updateInventoryItem.mutate({
                        id: editingInventoryItem.id,
                        name: editingInventoryItem.name,
                        shortName: editingInventoryItem.shortName || undefined,
                        description: editingInventoryItem.description || undefined,
                        quantity: editingInventoryItem.quantity,
                      })
                    }
                    disabled={updateInventoryItem.isPending}
                  >
                    {updateInventoryItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Short Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Used In Packages</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : inventory?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-xs uppercase text-muted-foreground">
                      {item.shortName ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">{item.description}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {item.packageItems.length > 0 ? (
                          item.packageItems.map((packageItem) => (
                            <Badge key={packageItem.id} variant="outline" className="text-[10px]">
                              {packageItem.gearPackage.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">Not used yet</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() =>
                          setEditingInventoryItem({
                            id: item.id,
                            name: item.name,
                            shortName: item.shortName ?? "",
                            description: item.description ?? "",
                            quantity: item.quantity,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete ${item.name}? This will remove it from any packages using it.`)) {
                            deleteInventoryItem.mutate({ id: item.id });
                          }
                        }
                      }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!inventoryLoading && inventory?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No inventory items yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="packages" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Rental Packages</CardTitle>
              <CardDescription>
                Create rentable packages by combining inventory items with the
                quantities each package consumes.
              </CardDescription>
            </div>
            <Dialog open={isAddingPackage} onOpenChange={setIsAddingPackage}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Package
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Add Rental Package</DialogTitle>
                  <DialogDescription>
                    Set the package price, then choose how many of each inventory
                    item the package uses.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="package-name">Package Name</Label>
                      <Input
                        id="package-name"
                        value={newPackage.name}
                        onChange={(e) =>
                          setNewPackage({ ...newPackage, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="package-short-name">Short Name</Label>
                      <Input
                        id="package-short-name"
                        value={newPackage.shortName}
                        onChange={(e) =>
                          setNewPackage({
                            ...newPackage,
                            shortName: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="package-description">Description</Label>
                    <Textarea
                      id="package-description"
                      value={newPackage.description}
                      onChange={(e) =>
                        setNewPackage({
                          ...newPackage,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="package-price">Daily Price ($)</Label>
                    <Input
                      id="package-price"
                      type="number"
                      min={0}
                      value={newPackage.price}
                      onChange={(e) =>
                        setNewPackage({
                          ...newPackage,
                          price: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <div>
                      <Label>Included Inventory</Label>
                      <p className="text-sm text-muted-foreground">
                        Set a quantity above 0 for each inventory item included in
                        this package.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {inventory?.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_120px]"
                        >
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              On hand: {item.quantity}
                              {item.shortName ? ` • ${item.shortName}` : ""}
                            </div>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            value={newPackage.itemQuantities[item.id] ?? 0}
                            onChange={(e) =>
                              setNewPackage({
                                ...newPackage,
                                itemQuantities: {
                                  ...newPackage.itemQuantities,
                                  [item.id]: parseInt(e.target.value, 10) || 0,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingPackage(false)}>Cancel</Button>
                  <Button
                    onClick={() => createPackage.mutate(buildPackagePayload(newPackage))}
                    disabled={
                      createPackage.isPending ||
                      !newPackage.name.trim() ||
                      !packageHasItems(newPackage)
                    }
                  >
                    {createPackage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Package"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Dialog
              open={!!editingPackage}
              onOpenChange={(open) => !open && setEditingPackage(null)}
            >
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Edit Rental Package</DialogTitle>
                </DialogHeader>
                {editingPackage && (
                  <div className="space-y-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit-package-name">Package Name</Label>
                        <Input
                          id="edit-package-name"
                          value={editingPackage.name}
                          onChange={(e) =>
                            setEditingPackage({
                              ...editingPackage,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-package-short-name">Short Name</Label>
                        <Input
                          id="edit-package-short-name"
                          value={editingPackage.shortName}
                          onChange={(e) =>
                            setEditingPackage({
                              ...editingPackage,
                              shortName: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-package-description">Description</Label>
                      <Textarea
                        id="edit-package-description"
                        value={editingPackage.description}
                        onChange={(e) =>
                          setEditingPackage({
                            ...editingPackage,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-package-price">Daily Price ($)</Label>
                      <Input
                        id="edit-package-price"
                        type="number"
                        min={0}
                        value={editingPackage.price}
                        onChange={(e) =>
                          setEditingPackage({
                            ...editingPackage,
                            price: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-3 rounded-lg border p-4">
                      <div>
                        <Label>Included Inventory</Label>
                        <p className="text-sm text-muted-foreground">
                          Update how many units of each inventory item this
                          package consumes.
                        </p>
                      </div>
                      <div className="space-y-3">
                        {inventory?.map((item) => (
                          <div
                            key={item.id}
                            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_120px]"
                          >
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-muted-foreground">
                                On hand: {item.quantity}
                                {item.shortName ? ` • ${item.shortName}` : ""}
                              </div>
                            </div>
                            <Input
                              type="number"
                              min={0}
                              value={editingPackage.itemQuantities[item.id] ?? 0}
                              onChange={(e) =>
                                setEditingPackage({
                                  ...editingPackage,
                                  itemQuantities: {
                                    ...editingPackage.itemQuantities,
                                    [item.id]: parseInt(e.target.value, 10) || 0,
                                  },
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingPackage(null)}>Cancel</Button>
                  <Button
                    onClick={() =>
                      editingPackage &&
                      updatePackage.mutate({
                        id: editingPackage.id,
                        ...buildPackagePayload(editingPackage),
                      })
                    }
                    disabled={
                      updatePackage.isPending ||
                      !editingPackage ||
                      !editingPackage.name.trim() ||
                      !packageHasItems(editingPackage)
                    }
                  >
                    {updatePackage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Short Name</TableHead>
                  <TableHead>Daily Price</TableHead>
                  <TableHead>Contents</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packagesLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : packages?.map((gearPackage) => (
                  <TableRow key={gearPackage.id}>
                    <TableCell className="font-medium">
                      <div>{gearPackage.name}</div>
                      {gearPackage.description && (
                        <div className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {gearPackage.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs uppercase text-muted-foreground">
                      {gearPackage.shortName ?? "—"}
                    </TableCell>
                    <TableCell>${gearPackage.price}</TableCell>
                    <TableCell className="max-w-[320px] whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {gearPackage.items.map((item) => (
                          <PackageItemBadge
                            key={item.id}
                            quantity={item.quantity}
                            itemName={item.gearItem.name}
                            shortName={item.gearItem.shortName}
                            description={item.gearItem.description}
                            className="text-[10px]"
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => openEditPackage(gearPackage)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete ${gearPackage.name}? This will also remove any rentals for it.`)) {
                            deletePackage.mutate({ id: gearPackage.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!packagesLoading && packages?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No rental packages yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
