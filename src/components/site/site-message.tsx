import type { ReactNode } from "react";

/**
 * A whole-page message on the public site: the 404, the error screen. Big
 * heading, one plain sentence, a way forward. Sits inside the site shell.
 */
export function SiteMessage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  /** The actions, usually one primary and one outline button. */
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[70dvh] flex-col justify-center px-5 pt-16 pb-24 md:px-10">
      <h1 className="t-heading max-w-[14ch] text-[clamp(2.75rem,9vw,7rem)]">
        {title}
      </h1>
      <p className="mt-6 max-w-[46ch] text-[16px] text-white/65 md:text-[17px]">
        {body}
      </p>
      <div className="mt-10 flex flex-wrap gap-3">{children}</div>
    </div>
  );
}
