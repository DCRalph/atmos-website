"use client";

import { useEffect, useState } from "react";
import { NewsletterForm } from "./newsletter-form";
import { SiteDialog } from "./overlays";

// Same key as the old popup, so people who already saw it aren't asked again.
const STORAGE_KEY = "atmosEmailPopupSeen";
const DELAY_MS = 5000;

const markSeen = () => {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Storage blocked: the popup just shows again next visit.
  }
};

/** Newsletter prompt shown once per browser, a few seconds after arriving. */
export function NewsletterPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      // Storage blocked: still offer it.
    }
    const timer = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SiteDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) markSeen();
      }}
      title="Join the atmosphere"
      description="Gigs, mixes and merch drops, straight to your inbox."
    >
      <div className="p-5">
        <NewsletterForm
          onSubscribed={() => {
            markSeen();
            setTimeout(() => setOpen(false), 1600);
          }}
        />
      </div>
    </SiteDialog>
  );
}
