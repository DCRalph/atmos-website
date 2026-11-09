import Link from "next/link";

import { unlistedPageMetadata } from "~/lib/seo-constants";
import { CONTACT } from "~/lib/site-constants";
import { loadPreferences } from "~/server/mailouts/preferences";
import { PreferencesForm } from "./preferences-form";

export const metadata = unlistedPageMetadata("Email preferences");
export const dynamic = "force-dynamic";

/**
 * Where the link at the bottom of every mailout goes. Opening it changes
 * nothing, since work inboxes open every link in an email to scan it; the
 * person chooses here.
 */
export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preferences = await loadPreferences(token);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black p-4 text-white">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/"
          className="text-sm font-extrabold tracking-[0.22em] text-[#c6ff33]"
        >
          ATMOS
        </Link>
        {preferences ? (
          <PreferencesForm token={token} initial={preferences} />
        ) : (
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">This link does not work</h1>
            <p className="text-sm text-white/60">
              It may have been copied wrong, or the address it was for has been
              removed. Email{" "}
              <a href={`mailto:${CONTACT.email}`} className="underline">
                {CONTACT.email}
              </a>{" "}
              and we will take you off.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
