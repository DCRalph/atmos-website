"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Check,
  Copy,
  LogOut,
  Settings,
  Share2,
  SlidersHorizontal,
  Ticket,
  Wallet,
} from "lucide-react";
import { FaFacebook, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { useBoard } from "../board-state";
import { gallery } from "../fixtures";
import { GlassSelect, GlassSwitch } from "../inputs";
import { DialogClose, GlassDialog, Lightbox, useLightbox } from "../overlays";
import { Button, IconButton, VariantTag } from "../primitives";
import { inputClass } from "./checkout";
import { NewsletterDialogTrigger } from "./closing";

const menuItem =
  "mx-label flex h-11 cursor-default items-center gap-3 rounded-[10px] px-3 text-[11px] text-white/80 outline-none select-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white";

function Demo({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 bg-black p-6">
      <div>
        <p className="mx-label text-[12px]">{title}</p>
        <p className="mt-2 text-[13px] text-white/55">{hint}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-3">
        {children}
      </div>
    </div>
  );
}

function TransferDialog() {
  const { toast } = useBoard();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return setError("Enter the email your mate uses.");
    setOpen(false);
    setEmail("");
    setError(undefined);
    toast({ title: `Ticket sent to ${email}`, tone: "success" });
  };

  return (
    <GlassDialog
      open={open}
      onOpenChange={setOpen}
      title="Transfer ticket"
      description="Your QR stops working and a new one is emailed to them."
      trigger={<Button>Transfer ticket</Button>}
    >
      <form onSubmit={submit} noValidate className="space-y-4 p-5">
        <div>
          <label
            htmlFor="tr-email"
            className="mx-label mb-2 block text-[10px] text-white/70"
          >
            Their email
          </label>
          <input
            id="tr-email"
            type="email"
            autoFocus
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(undefined);
            }}
            aria-invalid={!!error}
            className={inputClass}
            placeholder="mate@example.com"
          />
          {error ? (
            <p className="mt-2 pl-5 text-[13px] text-[#ff8a8a]">{error}</p>
          ) : null}
        </div>
        <div className="flex justify-end gap-3">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="submit" variant="accent">
            Send ticket
          </Button>
        </div>
      </form>
    </GlassDialog>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useBoard();
  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sign out?"
      description="You'll need your email link to see your tickets again."
    >
      <div className="flex justify-end gap-3 p-5">
        <DialogClose asChild>
          <Button variant="ghost">Stay signed in</Button>
        </DialogClose>
        <Button
          className="bg-[#ff6b6b] text-black hover:bg-[#ff8a8a]"
          onClick={() => {
            onOpenChange(false);
            toast({ title: "Signed out", tone: "info" });
          }}
        >
          Sign out
        </Button>
      </div>
    </GlassDialog>
  );
}

function FilterSheet() {
  const { toast } = useBoard();
  const [open, setOpen] = useState(false);
  const [venue, setVenue] = useState<"all" | "sanfran" | "meow">("all");
  const [freeOnly, setFreeOnly] = useState(false);
  return (
    <GlassDialog
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      title="Filter gigs"
      trigger={
        <Button variant="outline">
          <SlidersHorizontal className="size-4" /> Filters
        </Button>
      }
      className="md:mx-auto md:max-w-[560px]"
    >
      <div className="space-y-6 p-5">
        <GlassSelect
          label="Venue"
          value={venue}
          onValueChange={setVenue}
          options={[
            { value: "all", label: "All venues" },
            { value: "sanfran", label: "San Fran" },
            { value: "meow", label: "Meow" },
          ]}
        />
        <GlassSwitch
          checked={freeOnly}
          onCheckedChange={setFreeOnly}
          label="Free entry only"
        />
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              setVenue("all");
              setFreeOnly(false);
            }}
          >
            Reset
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setOpen(false);
              toast({ title: "Filters applied", tone: "info" });
            }}
          >
            Show gigs
          </Button>
        </div>
      </div>
    </GlassDialog>
  );
}

function AccountMenu() {
  const { portalContainer, toast } = useBoard();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="mx-glass flex h-11 items-center gap-2 rounded-full pr-4 pl-1.5 outline-none"
          >
            <Image
              src="/crew_pfp/sunday.jpg"
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-full object-cover"
            />
            <span className="mx-label text-[11px]">Account</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal container={portalContainer}>
          <DropdownMenu.Content
            sideOffset={8}
            align="start"
            className="mx-glass-dark mx-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-[90] min-w-56 rounded-[var(--mx-r-panel)] rounded-tl-none p-1.5"
          >
            <DropdownMenu.Label className="px-3 pt-2 pb-3 text-[13px] text-white/55">
              sunday@atmos.nz
            </DropdownMenu.Label>
            <DropdownMenu.Item
              className={menuItem}
              onSelect={() =>
                toast({ title: "Opening your tickets", tone: "info" })
              }
            >
              <Ticket className="size-4" /> My tickets
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItem}
              onSelect={() =>
                toast({
                  title: "Wallet passes are on your phone",
                  tone: "info",
                })
              }
            >
              <Wallet className="size-4" /> Wallet passes
            </DropdownMenu.Item>
            <DropdownMenu.Item className={menuItem} disabled>
              <Settings className="size-4" /> Settings
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1.5 h-px bg-white/10" />
            <DropdownMenu.Item
              className={`${menuItem} text-[#ff8a8a] data-[highlighted]:text-[#ffb3b3]`}
              onSelect={() => setConfirm(true)}
            >
              <LogOut className="size-4" /> Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} />
    </>
  );
}

/** Share popover. Copy writes to the clipboard and flips to a confirmed state. */
export function SharePopover({
  url = "https://atmosmedia.co.nz/gigs/broderbeats-intuition-vol-3-tour",
}: {
  url?: string;
}) {
  const { portalContainer, toast } = useBoard();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy. Long-press the link instead.",
        tone: "error",
      });
    }
  };
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline">
          <Share2 className="size-4" /> Share
        </Button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="mx-glass-dark mx-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-[90] w-[320px] rounded-[var(--mx-r-panel)] rounded-tl-none p-4 outline-none"
        >
          <p className="mx-label mb-3 text-[11px]">Share this gig</p>
          <div className="flex h-11 items-center gap-2 rounded-full border border-white/15 pr-1 pl-4">
            <span className="min-w-0 flex-1 truncate text-[13px] text-white/70">
              {url.replace("https://", "")}
            </span>
            <Button size="sm" onClick={copy} aria-live="polite">
              {copied ? (
                <>
                  <Check className="size-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copy
                </>
              )}
            </Button>
          </div>
          <div className="mt-3 flex gap-2">
            {[
              { label: "WhatsApp", Icon: FaWhatsapp },
              { label: "Facebook", Icon: FaFacebook },
              { label: "X", Icon: FaXTwitter },
            ].map(({ label, Icon }) => (
              <a
                key={label}
                href="#"
                aria-label={`Share on ${label}`}
                className="flex size-10 items-center justify-center rounded-full border border-white/15 text-white/70 hover:border-white/40 hover:text-white"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function Tip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const { portalContainer } = useBoard();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal container={portalContainer}>
        <Tooltip.Content
          sideOffset={6}
          className="mx-label animate-in fade-in-0 z-[95] rounded-[var(--mx-r-chip)] bg-white px-2.5 py-1.5 text-[10px] text-black"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function LightboxDemo() {
  const lb = useLightbox();
  return (
    <>
      <div className="flex gap-2">
        {gallery.slice(0, 4).map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => lb.open(i)}
            aria-label={`Open ${img.alt}`}
            className="relative size-14 overflow-hidden outline-offset-2 transition-opacity hover:opacity-80"
          >
            <Image
              src={img.src}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          </button>
        ))}
      </div>
      <Lightbox images={gallery} {...lb.props} />
    </>
  );
}

export function OverlaysSection() {
  const { toast } = useBoard();
  return (
    <div className="pb-16">
      <VariantTag>
        Everything here opens for real. Esc closes, focus is trapped and
        returned.
      </VariantTag>
      <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        <Demo title="Dialog" hint="Form inside, validation, success toast.">
          <TransferDialog />
        </Demo>
        <Demo
          title="Bottom sheet"
          hint="Filters on phones. Slides up, drag-free."
        >
          <FilterSheet />
        </Demo>
        <Demo
          title="Menu"
          hint="Keyboard nav, disabled item, destructive confirm."
        >
          <AccountMenu />
        </Demo>
        <Demo title="Popover" hint="Copy link writes to your clipboard.">
          <SharePopover />
        </Demo>
        <Demo title="Tooltip" hint="Hover or focus the icons.">
          <Tip label="Add to calendar">
            <IconButton label="Add to calendar">
              <Ticket className="size-5" />
            </IconButton>
          </Tip>
          <Tip label="Share">
            <IconButton label="Share">
              <Share2 className="size-5" />
            </IconButton>
          </Tip>
          <Tip label="Wallet pass">
            <IconButton label="Wallet pass">
              <Wallet className="size-5" />
            </IconButton>
          </Tip>
        </Demo>
        <Demo title="Lightbox" hint="Click a photo, then use arrow keys.">
          <LightboxDemo />
        </Demo>
        <Demo title="Toasts" hint="Stack of three, auto-dismiss after 4.5s.">
          <Button
            size="sm"
            onClick={() =>
              toast({ title: "Saved to your tickets", tone: "success" })
            }
          >
            Success
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast({
                title: "Payment declined. Try another card.",
                tone: "error",
              })
            }
          >
            Error
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              toast({ title: "Doors moved to 9:30pm", tone: "info" })
            }
          >
            Info
          </Button>
        </Demo>
        <Demo title="Popup" hint="The newsletter popup, as a real modal.">
          <NewsletterDialogTrigger />
        </Demo>
      </div>
    </div>
  );
}
