"use client";

import { LayoutGroup } from "motion/react";

type LayoutGroupProviderProps = {
  children: React.ReactNode;
};

export function LayoutGroupProvider({
  children,
}: LayoutGroupProviderProps) {
  return <LayoutGroup id="gig-poster-transition">{children}</LayoutGroup>;
}
