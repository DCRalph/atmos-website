"use client"

import { useState, useRef, useEffect } from "react"

interface CustomSelectProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hasError?: boolean
}

export function CustomSelect({ options, value, onChange, placeholder = "Select...", hasError = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={selectRef} className="relative">
      {/* Select Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-black/50 border-2 px-4 py-3 text-left text-white font-mono focus:border-accent-strong focus:outline-none focus:shadow-[0_0_15px_var(--accent-muted)] transition-all flex items-center justify-between hover:border-white/40 ${hasError ? "border-accent-strong shadow-[0_0_15px_var(--accent-muted)]" : "border-white/20"
          }`}
      >
        <span className={value ? "text-white" : "text-white/40"}>{value || placeholder}</span>
        <svg
          className={`w-5 h-5 transition-transform text-white ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-black border-2 border-accent-strong shadow-[0_0_20px_var(--accent-muted)] max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option)
                setIsOpen(false)
              }}
              className={`w-full px-4 py-3 text-left font-mono transition-colors border-b border-white/10 last:border-b-0 ${value === option
                ? "bg-accent-strong text-white font-bold"
                : "text-white hover:bg-accent-muted/20 hover:text-accent-muted"
                }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
