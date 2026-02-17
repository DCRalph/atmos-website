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
import { Textarea } from "~/components/ui/textarea";

export function GearRentalManager() {
  const [activeTab, setActiveTab] = useState("requests");
  const [isAddingGear, setIsAddingGear] = useState(false);
  const [newGear, setNewGear] = useState({ name: "", description: "", price: 0 });
  const [editingGear, setEditingGear] = useState<{ id: string, name: string, description: string | null, price: number } | null>(null);

  const utils = api.useUtils();

  const { data: gear, isLoading: gearLoading } = api.rentals.getAllGear.useQuery();
  const { data: rentals, isLoading: rentalsLoading } = api.rentals.adminGetRentals.useQuery();

  const createGear = api.rentals.adminCreateGear.useMutation({
    onSuccess: () => {
      void utils.rentals.getAllGear.invalidate();
      setIsAddingGear(false);
      setNewGear({ name: "", description: "", price: 0 });
    },
  });

  const updateGear = api.rentals.adminUpdateGear.useMutation({
    onSuccess: () => {
      void utils.rentals.getAllGear.invalidate();
      setEditingGear(null);
    },
  });

  const deleteGear = api.rentals.adminDeleteGear.useMutation({
    onSuccess: () => void utils.rentals.getAllGear.invalidate(),
  });

  const approveRental = api.rentals.adminApproveRental.useMutation({
    onSuccess: () => void utils.rentals.adminGetRentals.invalidate(),
  });

  const rejectRental = api.rentals.adminRejectRental.useMutation({
    onSuccess: () => void utils.rentals.adminGetRentals.invalidate(),
  });

  const deleteRental = api.rentals.adminDeleteRental.useMutation({
    onSuccess: () => void utils.rentals.adminGetRentals.invalidate(),
  });

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="requests">Rental Requests</TabsTrigger>
        <TabsTrigger value="gear">Gear Inventory</TabsTrigger>
      </TabsList>

      <TabsContent value="requests" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Rental Requests</CardTitle>
            <CardDescription>Review and manage booking requests from users.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Gear</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentalsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : rentals?.map((rental) => (
                  <TableRow key={rental.id}>
                    <TableCell className="font-medium">{rental.userName}</TableCell>
                    <TableCell className="text-xs">{rental.contactInfo}</TableCell>
                    <TableCell>{rental.gearItem.name}</TableCell>
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
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No rental requests yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="gear" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Gear Inventory</CardTitle>
              <CardDescription>Add and manage gear available for rent.</CardDescription>
            </div>
            <Dialog open={isAddingGear} onOpenChange={setIsAddingGear}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Gear
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Gear Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Gear Name</Label>
                    <Input id="name" value={newGear.name} onChange={(e) => setNewGear({ ...newGear, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={newGear.description} onChange={(e) => setNewGear({ ...newGear, description: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Daily Price ($)</Label>
                    <Input id="price" type="number" value={newGear.price} onChange={(e) => setNewGear({ ...newGear, price: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingGear(false)}>Cancel</Button>
                  <Button onClick={() => createGear.mutate(newGear)} disabled={createGear.isPending}>
                    {createGear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Gear"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {/* Edit Gear Dialog */}
            <Dialog open={!!editingGear} onOpenChange={(open) => !open && setEditingGear(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Gear Item</DialogTitle>
                </DialogHeader>
                {editingGear && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Gear Name</Label>
                      <Input id="edit-name" value={editingGear.name} onChange={(e) => setEditingGear({ ...editingGear, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea id="edit-description" value={editingGear.description ?? ""} onChange={(e) => setEditingGear({ ...editingGear, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-price">Daily Price ($)</Label>
                      <Input id="edit-price" type="number" value={editingGear.price} onChange={(e) => setEditingGear({ ...editingGear, price: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingGear(null)}>Cancel</Button>
                  <Button onClick={() => editingGear && updateGear.mutate(editingGear)} disabled={updateGear.isPending}>
                    {updateGear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Daily Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gearLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : gear?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">{item.description}</TableCell>
                    <TableCell>${item.price}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-primary" onClick={() => setEditingGear({
                        id: item.id,
                        name: item.name,
                        description: item.description,
                        price: item.price
                      })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => {
                        if (confirm(`Delete ${item.name}? This will also delete all associated rentals.`)) {
                          deleteGear.mutate({ id: item.id });
                        }
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!gearLoading && gear?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No gear in inventory yet.
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
