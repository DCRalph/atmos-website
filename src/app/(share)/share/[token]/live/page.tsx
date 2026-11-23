import { sharedEventId } from "~/server/ticketing/share-links";
import { SharedLiveScreen } from "./shared-live-screen";

export default async function SharedLiveScreenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const eventId = await sharedEventId(token);

  return (
    <div className="dark text-foreground bg-black">
      <SharedLiveScreen eventId={eventId} backHref={`/share/${token}`} />
    </div>
  );
}
