"use client"

import { useContext } from "react"
import { ScrollContainerContext } from "~/components/scroll-container-provider"

export function useMainLayoutScrollContainer() {
  const containerRef = useContext(ScrollContainerContext)

  if (!containerRef) {
    throw new Error(
      "useMainLayoutScrollContainer must be used within a ScrollContainerProvider"
    )
  }

  return { containerRef }
}
