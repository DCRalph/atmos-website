import {
  COLORS,
  emailShell,
  escapeHtml,
  intro,
  panel,
  pillButton,
  row,
  type RenderedEmail,
} from "./layout";

/** One line of white text in a panel: the thing to read before the button. */
function note(value: string): string {
  return row(
    panel(
      `<div style="font-size:15px;line-height:1.65;color:${COLORS.text};">${escapeHtml(value)}</div>`,
    ),
    20,
  );
}

/**
 * A contract sent for signature: what it is for, and the button that opens
 * it. The same email is the reminder, with a different opening line.
 */
export function renderContractInviteEmail({
  agreement,
  subjectLine,
  summary,
  url,
  sentBy,
  reminder,
}: {
  /** "performer agreement" or "equipment hire agreement". */
  agreement: string;
  /** What it covers: the event, or the hire dates. */
  subjectLine: string;
  /** One line under the heading: the date and set time, or the hirer. */
  summary: string;
  url: string;
  sentBy: string;
  reminder: boolean;
}): RenderedEmail {
  const heading = reminder
    ? `A reminder to sign your ${agreement}`
    : `Your ${agreement}`;
  const ask =
    "Read it through, fill in your details, and sign it online. It takes a couple of minutes.";
  const subject = `${reminder ? "Reminder: your" : "Your"} ${agreement} for ${subjectLine}`;
  const about = [subjectLine, summary].filter(Boolean).join(". ");

  const body = [
    intro(heading, `${escapeHtml(about)}.`),
    note(ask),
    row(pillButton(url, "Read and sign"), 8),
  ].join("\n");

  const footer = `Sent by ${escapeHtml(sentBy)} at Atmos. Questions? Reply to this email.`;

  const text = [
    heading,
    "",
    `${about}.`,
    "",
    ask,
    "",
    `Read and sign: ${url}`,
    "",
    `Sent by ${sentBy} at Atmos. Questions? Reply to this email.`,
  ].join("\n");

  return { subject, html: emailShell({ title: subject, body, footer }), text };
}

/** The other party's copy once they have signed: a link back to the signed contract. */
export function renderContractSignedEmail({
  agreement,
  subjectLine,
  signedName,
  signedOn,
  url,
}: {
  agreement: string;
  subjectLine: string;
  signedName: string;
  signedOn: string;
  url: string;
}): RenderedEmail {
  const subject = `Signed: your ${agreement} for ${subjectLine}`;
  const keep =
    "Keep this email. The link opens your signed agreement, which you can print or save as a PDF.";

  const body = [
    intro(
      "Signed",
      `Your ${escapeHtml(agreement)} for ${escapeHtml(subjectLine)}, signed by ${escapeHtml(signedName)} on ${escapeHtml(signedOn)}.`,
    ),
    note(keep),
    row(pillButton(url, "View your copy"), 8),
  ].join("\n");

  const text = [
    "Signed",
    "",
    `Your ${agreement} for ${subjectLine}, signed by ${signedName} on ${signedOn}.`,
    "",
    keep,
    "",
    `View your copy: ${url}`,
  ].join("\n");

  return {
    subject,
    html: emailShell({
      title: subject,
      body,
      footer: "Questions? Reply to this email.",
    }),
    text,
  };
}
