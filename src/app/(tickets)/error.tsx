"use client";

import { SiteError } from "~/components/site/site-error";

export default function Error({ retry }: { retry: () => void }) {
  return <SiteError retry={retry} />;
}
