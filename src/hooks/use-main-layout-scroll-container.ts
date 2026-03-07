"use client"

import { useEffect, useRef, useState } from "react"

export function useMainLayoutScrollContainer() {
  const containerRef = useRef<HTMLElement | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let rafId: number | null = null

    const resolveContainer = () => {
      const next = document.getElementById("main-layout-container")
      if (!next) {
        rafId = requestAnimationFrame(resolveContainer)
        return
      }

      if (containerRef.current !== next) {
        containerRef.current = next
        setIsReady(true)
      }
    }

    resolveContainer()

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [])

  return { containerRef, isReady }
}
