import { unsubscribeOneClick } from "~/server/mailouts/preferences";

export const runtime = "nodejs";

/**
 * One-click unsubscribe (RFC 8058). Mail apps post here from the Unsubscribe
 * button they draw from a mailout's `List-Unsubscribe` header, with no page
 * and no confirmation. It takes the person off the lists that mailout went
 * to. People clicking the footer link get the preferences page instead.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const done = await unsubscribeOneClick(token);
  return new Response(done ? "Unsubscribed" : "Unknown link", {
    status: done ? 200 : 404,
  });
}
