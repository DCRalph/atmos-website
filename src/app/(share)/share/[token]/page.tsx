import { ReadOnlyEvent } from "~/components/admin/ticketing/read-only-event";

import { sharedEventId } from "~/server/ticketing/share-links";

export default async function SharedEventPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const eventId = await sharedEventId(token);

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="bg-background/90 sticky top-0 z-50 border-b backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center px-6">
          <span className="text-lg font-semibold">Atmos Events</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl">
        <ReadOnlyEvent eventId={eventId} basePath={`/share/${token}`} />
      </main>
    </div>
  );
}
