"use client"

import { createContext, type RefObject } from "react"

export const ScrollContainerContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

export function ScrollContainerProvider({
  children,
  scrollRef,
}: {
  children: React.ReactNode
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <ScrollContainerContext.Provider value={scrollRef}>
      {children}
    </ScrollContainerContext.Provider>
  )
}
