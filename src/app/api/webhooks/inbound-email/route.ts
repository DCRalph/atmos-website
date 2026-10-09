import { Resend } from "resend";
import { z } from "zod";
import { env } from "~/env";
import { taskPeople } from "~/server/tasks/data";
import { extractTasks } from "~/server/tasks/extract";
export const runtime = "nodejs";
export const maxDuration = 120;
function address(from: string) {
  return (/<([^<>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase();
}
export async function POST(request: Request) {
  if (!env.RESEND_API_KEY || !env.RESEND_INBOUND_SECRET)
    return new Response("Receiving is not configured", { status: 503 });
  const payload = await request.text();
  if (new TextEncoder().encode(payload).length > 256_000)
    return new Response("Payload too large", { status: 413 });
  const resend = new Resend(env.RESEND_API_KEY);
  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: env.RESEND_INBOUND_SECRET,
    });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }
  if (event.type !== "email.received")
    return new Response(null, { status: 204 });
  if (
    ![...event.data.to, ...event.data.cc, ...event.data.received_for].some(
      (to) => address(to) === env.TASKS_INBOUND_ADDRESS.toLowerCase(),
    )
  )
    return new Response(null, { status: 204 });
  const from = address(event.data.from);
  const admins = await taskPeople();
  let forwarders: Record<string, string> = {};
  try {
    forwarders = z
      .record(z.string(), z.email())
      .parse(JSON.parse(env.TASKS_FORWARDERS ?? "{}"));
  } catch {
    return new Response("Invalid forwarding configuration", { status: 503 });
  }
  const admin = admins.find(
    (person) =>
      person.email.toLowerCase() === (forwarders[from]?.toLowerCase() ?? from),
  );
  if (!admin) return new Response(null, { status: 204 });
  const received = await resend.emails.receiving.get(event.data.email_id);
  if (received.error || !received.data)
    return new Response("Email is not available yet", { status: 503 });
  // Trust Resend's authentication metadata, never a sender-supplied header.
  const authenticated = z
    .object({ authentication: z.object({ dmarc: z.literal("pass") }) })
    .safeParse(received.data);
  if (!authenticated.success) return new Response(null, { status: 204 });
  const text =
    received.data.text ?? received.data.html?.replace(/<[^>]*>/g, " ") ?? "";
  if (!text.trim()) return new Response(null, { status: 204 });
  try {
    const tasks = await extractTasks({
      text: text.slice(0, 30_000),
      actorId: admin.id,
      source: "EMAIL",
      sourceRef: event.data.email_id,
      subject: event.data.subject.slice(0, 500),
      sentAt: new Date(event.data.created_at),
    });
    return Response.json({ proposed: tasks.length });
  } catch (error) {
    console.error(
      "[tasks] inbound extraction failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response("Extraction failed; retry", { status: 503 });
  }
}
