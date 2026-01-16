"use client";

import { useState, useRef, useEffect } from "react";

interface CustomSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  hasError = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={selectRef} className="relative">
      {/* Select Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`focus:border-accent-strong flex w-full items-center justify-between border-2 bg-black/50 px-4 py-3 text-left font-mono text-white transition-all hover:border-white/40 focus:shadow-[0_0_15px_var(--accent-muted)] focus:outline-none ${
          hasError
            ? "border-accent-strong shadow-[0_0_15px_var(--accent-muted)]"
            : "border-white/20"
        }`}
      >
        <span className={value ? "text-white" : "text-white/40"}>
          {value || placeholder}
        </span>
        <svg
          className={`h-5 w-5 text-white transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="square"
            strokeLinejoin="miter"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="border-accent-strong absolute z-50 mt-1 max-h-60 w-full overflow-auto border-2 bg-black shadow-[0_0_20px_var(--accent-muted)]">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              className={`w-full border-b border-white/10 px-4 py-3 text-left font-mono transition-colors last:border-b-0 ${
                value === option
                  ? "bg-accent-strong font-bold text-white"
                  : "hover:bg-accent-muted/20 hover:text-accent-muted text-white"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
