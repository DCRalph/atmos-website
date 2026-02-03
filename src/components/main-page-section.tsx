import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

type MainPageSectionProps = {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
};

export function MainPageSection({
  children,
  className,
  containerClassName,
}: MainPageSectionProps) {
  return (
    <section className={cn("relative z-10 mt-4 sm:mt-0 lg:mt-12 px-2 pb-12 md:px-4", className)}>
      <div className={cn("mx-auto max-w-6xl", containerClassName)}>
        {children}
      </div>
    </section>
  );
}
