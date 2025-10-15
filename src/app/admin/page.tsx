"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { ImageCycleBackground } from "~/app/_components/image-cycle-background";
import { api } from "~/trpc/react";

function formatDateInput(date?: string | Date) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <ImageCycleBackground intervalMs={5000} auto={false} />
      <section className="relative z-10 min-h-screen px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-8 text-4xl font-bold">Admin</h1>
          <Tabs defaultValue="gigs">
            <TabsList>
              <TabsTrigger value="gigs">Gigs</TabsTrigger>
              <TabsTrigger value="crew">Crew</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="merch">Merch</TabsTrigger>
            </TabsList>
            <TabsContent value="gigs">
              <GigsAdmin />
            </TabsContent>
            <TabsContent value="crew">
              <CrewAdmin />
            </TabsContent>
            <TabsContent value="content">
              <ContentAdmin />
            </TabsContent>
            <TabsContent value="merch">
              <MerchAdmin />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </main>
  );
}

function GigsAdmin() {
  const utils = api.useUtils();
  const { data: upcoming = [] } = api.gig.listUpcoming.useQuery();
  const { data: past = [] } = api.gig.listPast.useQuery();
  const create = api.gig.create.useMutation({ onSuccess: () => utils.gig.invalidate() });
  const update = api.gig.update.useMutation({ onSuccess: () => utils.gig.invalidate() });
  const remove = api.gig.delete.useMutation({ onSuccess: () => utils.gig.invalidate() });

  const [form, setForm] = React.useState({ date: "", venue: "", city: "", time: "", ticketLink: "" });

  return (
    <div className="space-y-6">
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ ...form, ticketLink: form.ticketLink || undefined });
          setForm({ date: "", venue: "", city: "", time: "", ticketLink: "" });
        }}
      >
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="venue">Venue</Label>
          <Input id="venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="time">Time</Label>
          <Input id="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ticketLink">Tickets URL</Label>
          <Input id="ticketLink" value={form.ticketLink} onChange={(e) => setForm({ ...form, ticketLink: e.target.value })} />
        </div>
        <div className="md:col-span-5">
          <Button type="submit">Add Gig</Button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xl font-bold">Upcoming</h3>
          <ul className="space-y-2">
            {upcoming.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded border border-white/10 p-3">
                <span>
                  {new Date(g.date).toLocaleDateString()} — {g.venue}, {g.city} ({g.time})
                </span>
                <div className="space-x-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Edit</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <GigEditForm gig={g} onSave={(data) => update.mutate({ id: g.id, ...data })} />
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" onClick={() => remove.mutate({ id: g.id })}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-xl font-bold">Past</h3>
          <ul className="space-y-2">
            {past.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded border border-white/10 p-3">
                <span>
                  {new Date(g.date).toLocaleDateString()} — {g.venue}, {g.city} ({g.time})
                </span>
                <div className="space-x-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Edit</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <GigEditForm gig={g} onSave={(data) => update.mutate({ id: g.id, ...data })} />
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" onClick={() => remove.mutate({ id: g.id })}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function GigEditForm({ gig, onSave }: { gig: any; onSave: (data: any) => void }) {
  const [form, setForm] = React.useState({
    date: formatDateInput(gig.date),
    venue: gig.venue ?? "",
    city: gig.city ?? "",
    time: gig.time ?? "",
    ticketLink: gig.ticketLink ?? "",
  });
  return (
    <form
      className="grid grid-cols-1 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...form, ticketLink: form.ticketLink || undefined });
      }}
    >
      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="venue">Venue</Label>
        <Input id="venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="city">City</Label>
        <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="time">Time</Label>
        <Input id="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="ticketLink">Tickets URL</Label>
        <Input id="ticketLink" value={form.ticketLink} onChange={(e) => setForm({ ...form, ticketLink: e.target.value })} />
      </div>
      <div>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

function CrewAdmin() {
  const utils = api.useUtils();
  const { data: crew = [] } = api.crew.list.useQuery();
  const create = api.crew.create.useMutation({ onSuccess: () => utils.crew.invalidate() });
  const update = api.crew.update.useMutation({ onSuccess: () => utils.crew.invalidate() });
  const remove = api.crew.delete.useMutation({ onSuccess: () => utils.crew.invalidate() });
  const [form, setForm] = React.useState({ name: "", role: "", bio: "", instagram: "", soundcloud: "", photoUrl: "" });

  return (
    <div className="space-y-6">
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            name: form.name,
            role: form.role,
            bio: form.bio,
            instagram: form.instagram || undefined,
            soundcloud: form.soundcloud || undefined,
            photoUrl: form.photoUrl || undefined,
          });
          setForm({ name: "", role: "", bio: "", instagram: "", soundcloud: "", photoUrl: "" });
        }}
      >
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label>Role</Label>
          <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
        </div>
        <div className="md:col-span-3">
          <Label>Bio</Label>
          <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </div>
        <div>
          <Label>Instagram URL</Label>
          <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
        </div>
        <div>
          <Label>SoundCloud URL</Label>
          <Input value={form.soundcloud} onChange={(e) => setForm({ ...form, soundcloud: e.target.value })} />
        </div>
        <div>
          <Label>Photo URL</Label>
          <Input value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} />
        </div>
        <div className="md:col-span-3">
          <Button type="submit">Add Member</Button>
        </div>
      </form>

      <ul className="space-y-2">
        {crew.map((m) => (
          <li key={m.id} className="flex items-center justify-between rounded border border-white/10 p-3">
            <span>
              {m.name} — {m.role}
            </span>
            <div className="space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Edit</Button>
                </DialogTrigger>
                <DialogContent>
                  <CrewEditForm member={m} onSave={(data) => update.mutate({ id: m.id, ...data })} />
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={() => remove.mutate({ id: m.id })}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CrewEditForm({ member, onSave }: { member: any; onSave: (data: any) => void }) {
  const [form, setForm] = React.useState({
    name: member.name ?? "",
    role: member.role ?? "",
    bio: member.bio ?? "",
    instagram: member.instagram ?? "",
    soundcloud: member.soundcloud ?? "",
    photoUrl: member.photoUrl ?? "",
  });
  return (
    <form
      className="grid grid-cols-1 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          instagram: form.instagram || undefined,
          soundcloud: form.soundcloud || undefined,
          photoUrl: form.photoUrl || undefined,
        });
      }}
    >
      <Label>Name</Label>
      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Label>Role</Label>
      <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
      <Label>Bio</Label>
      <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      <Label>Instagram URL</Label>
      <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
      <Label>SoundCloud URL</Label>
      <Input value={form.soundcloud} onChange={(e) => setForm({ ...form, soundcloud: e.target.value })} />
      <Label>Photo URL</Label>
      <Input value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} />
      <Button type="submit">Save</Button>
    </form>
  );
}

function ContentAdmin() {
  const utils = api.useUtils();
  const { data: items = [] } = api.content.list.useQuery();
  const create = api.content.create.useMutation({ onSuccess: () => utils.content.invalidate() });
  const update = api.content.update.useMutation({ onSuccess: () => utils.content.invalidate() });
  const remove = api.content.delete.useMutation({ onSuccess: () => utils.content.invalidate() });

  const [form, setForm] = React.useState<{ type: "MIX" | "VIDEO" | "PLAYLIST"; title: string; description: string; date: string; link: string; featured: boolean }>({ type: "MIX", title: "", description: "", date: "", link: "", featured: false });

  return (
    <div className="space-y-6">
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ ...form });
          setForm({ type: "MIX", title: "", description: "", date: "", link: "", featured: false });
        }}
      >
        <div>
          <Label>Type</Label>
          <select
            className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-white"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as "MIX" | "VIDEO" | "PLAYLIST" })}
          >
            <option value="MIX">Mix</option>
            <option value="VIDEO">Video</option>
            <option value="PLAYLIST">Playlist</option>
          </select>
        </div>
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="md:col-span-3">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>Link</Label>
          <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <input id="featured" type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
          <Label htmlFor="featured">Featured</Label>
        </div>
        <div className="md:col-span-3">
          <Button type="submit">Add Content</Button>
        </div>
      </form>

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between rounded border border-white/10 p-3">
            <span>
              [{it.type}] {it.title} — {new Date(it.date).toLocaleDateString()}
            </span>
            <div className="space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Edit</Button>
                </DialogTrigger>
                <DialogContent>
                  <ContentEditForm item={it} onSave={(data) => update.mutate({ id: it.id, ...data })} />
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={() => remove.mutate({ id: it.id })}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContentEditForm({ item, onSave }: { item: any; onSave: (data: any) => void }) {
  const [form, setForm] = React.useState({
    type: item.type,
    title: item.title ?? "",
    description: item.description ?? "",
    date: formatDateInput(item.date),
    link: item.link ?? "",
    featured: !!item.featured,
  });
  return (
    <form
      className="grid grid-cols-1 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...form });
      }}
    >
      <Label>Type</Label>
      <select
        className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-white"
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value as any })}
      >
        <option value="MIX">Mix</option>
        <option value="VIDEO">Video</option>
        <option value="PLAYLIST">Playlist</option>
      </select>
      <Label>Title</Label>
      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Label>Description</Label>
      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <Label>Date</Label>
      <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      <Label>Link</Label>
      <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
      <div className="flex items-center gap-2">
        <input id="featuredEdit" type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
        <Label htmlFor="featuredEdit">Featured</Label>
      </div>
      <Button type="submit">Save</Button>
    </form>
  );
}

function MerchAdmin() {
  const utils = api.useUtils();
  const { data: items = [] } = api.merch.list.useQuery();
  const create = api.merch.create.useMutation({ onSuccess: () => utils.merch.invalidate() });
  const update = api.merch.update.useMutation({ onSuccess: () => utils.merch.invalidate() });
  const remove = api.merch.delete.useMutation({ onSuccess: () => utils.merch.invalidate() });

  const [form, setForm] = React.useState({ title: "", description: "", price: "", imageUrl: "", active: true });

  return (
    <div className="space-y-6">
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            title: form.title,
            description: form.description,
            price: form.price,
            imageUrl: form.imageUrl || undefined,
            active: form.active,
          });
          setForm({ title: "", description: "", price: "", imageUrl: "", active: true });
        }}
      >
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <Label>Price</Label>
          <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 29.99" />
        </div>
        <div className="md:col-span-3">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>Image URL</Label>
          <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <input id="active" type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <Label htmlFor="active">Active</Label>
        </div>
        <div className="md:col-span-3">
          <Button type="submit">Add Item</Button>
        </div>
      </form>

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between rounded border border-white/10 p-3">
            <span>
              {it.title} — ${(it.priceCents / 100).toFixed(2)}
            </span>
            <div className="space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Edit</Button>
                </DialogTrigger>
                <DialogContent>
                  <MerchEditForm item={it} onSave={(data) => update.mutate({ id: it.id, ...data })} />
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={() => remove.mutate({ id: it.id })}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MerchEditForm({ item, onSave }: { item: any; onSave: (data: any) => void }) {
  const [form, setForm] = React.useState({
    title: item.title ?? "",
    description: item.description ?? "",
    price: (item.priceCents / 100).toFixed(2),
    imageUrl: item.imageUrl ?? "",
    active: !!item.active,
  });
  return (
    <form
      className="grid grid-cols-1 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          imageUrl: form.imageUrl || undefined,
        });
      }}
    >
      <Label>Title</Label>
      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Label>Price</Label>
      <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
      <Label>Description</Label>
      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <Label>Image URL</Label>
      <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
      <div className="flex items-center gap-2">
        <input id="activeEdit" type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        <Label htmlFor="activeEdit">Active</Label>
      </div>
      <Button type="submit">Save</Button>
    </form>
  );
}
