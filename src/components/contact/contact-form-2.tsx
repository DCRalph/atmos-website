"use client"

import type React from "react"

import { useState } from "react"
import { CustomSelect } from "./custom-select"
import { api } from "~/trpc/react"

const CONTACT_REASONS = [
  "General Inquiry",
  "Booking Request",
  "Partnership Opportunity",
  "Press & Media",
  "Technical Support",
  "Other",
]

type FieldErrors = {
  name?: string
  email?: string
  reason?: string
  message?: string
}

export function ContactForm() {
  const [selectedReason, setSelectedReason] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")

  const createContact = api.contact.create.useMutation({
    onSuccess: () => {
      setSubmitStatus("success")
      setFormData({ name: "", email: "", message: "" })
      setSelectedReason("")
      setErrors({})
    },
    onError: () => {
      setSubmitStatus("error")
    },
  })

  const validateForm = (): boolean => {
    const newErrors: FieldErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = "Please enter your name"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Please enter your email"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (!selectedReason) {
      newErrors.reason = "Please select a reason for contacting us"
    }

    if (!formData.message.trim()) {
      newErrors.message = "Please enter your message"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitStatus("idle")

    if (!validateForm()) {
      return
    }

    createContact.mutate({
      name: formData.name.trim(),
      email: formData.email.trim(),
      reason: selectedReason,
      message: formData.message.trim(),
    })
  }

  const clearFieldError = (field: keyof FieldErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success Message */}
      {submitStatus === "success" && (
        <div className="bg-green-500/20 border-2 border-green-500 px-4 py-3 text-green-400 font-mono text-sm">
          <span className="font-bold uppercase tracking-wider">Message sent!</span>
          <span className="ml-2">We&apos;ll get back to you soon.</span>
        </div>
      )}

      {/* Error Message */}
      {submitStatus === "error" && (
        <div className="bg-red-500/20 border-2 border-red-500 px-4 py-3 text-red-400 font-mono text-sm">
          <span className="font-bold uppercase tracking-wider">Error!</span>
          <span className="ml-2">Something went wrong. Please try again.</span>
        </div>
      )}

      {/* Name Input */}
      <div>
        <label htmlFor="name" className="block text-sm font-bold uppercase tracking-wider mb-2">
          Name
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value })
            clearFieldError("name")
          }}
          className={`w-full bg-black/50 border-2 px-4 py-3 text-white placeholder:text-white/40 focus:border-accent-strong focus:outline-none focus:shadow-[0_0_15px_var(--accent-muted)] transition-all font-mono ${errors.name ? "border-accent-strong shadow-[0_0_15px_var(--accent-muted)]" : "border-white/20"
            }`}
          placeholder="YOUR NAME"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-accent-muted font-mono">{errors.name}</p>
        )}
      </div>

      {/* Email Input */}
      <div>
        <label htmlFor="email" className="block text-sm font-bold uppercase tracking-wider mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => {
            setFormData({ ...formData, email: e.target.value })
            clearFieldError("email")
          }}
          className={`w-full bg-black/50 border-2 px-4 py-3 text-white placeholder:text-white/40 focus:border-accent-strong focus:outline-none focus:shadow-[0_0_15px_var(--accent-muted)] transition-all font-mono ${errors.email ? "border-accent-strong shadow-[0_0_15px_var(--accent-muted)]" : "border-white/20"
            }`}
          placeholder="YOUR@EMAIL.COM"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-accent-muted font-mono">{errors.email}</p>
        )}
      </div>

      {/* Reason Select */}
      <div>
        <label htmlFor="reason" className="block text-sm font-bold uppercase tracking-wider mb-2">
          Reason
        </label>
        <CustomSelect
          options={CONTACT_REASONS}
          value={selectedReason}
          onChange={(value) => {
            setSelectedReason(value)
            clearFieldError("reason")
          }}
          placeholder="SELECT A REASON"
          hasError={!!errors.reason}
        />
        {errors.reason && (
          <p className="mt-1 text-sm text-accent-muted font-mono">{errors.reason}</p>
        )}
      </div>

      {/* Message Textarea */}
      <div>
        <label htmlFor="message" className="block text-sm font-bold uppercase tracking-wider mb-2">
          Message
        </label>
        <textarea
          id="message"
          rows={6}
          value={formData.message}
          onChange={(e) => {
            setFormData({ ...formData, message: e.target.value })
            clearFieldError("message")
          }}
          className={`w-full bg-black/50 border-2 px-4 py-3 text-white placeholder:text-white/40 focus:border-accent-strong focus:outline-none focus:shadow-[0_0_15px_var(--accent-muted)] transition-all resize-none font-mono ${errors.message ? "border-accent-strong shadow-[0_0_15px_var(--accent-muted)]" : "border-white/20"
            }`}
          placeholder="YOUR MESSAGE HERE..."
        />
        {errors.message && (
          <p className="mt-1 text-sm text-accent-muted font-mono">{errors.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={createContact.isPending}
        className="w-full bg-accent-strong hover:bg-accent-muted text-white font-bold uppercase tracking-[0.2em] py-4 px-8 transition-all hover:shadow-[0_0_20px_var(--accent-muted)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
      >
        {createContact.isPending ? "Sending..." : "Send Message"}
      </button>
    </form>
  )
}
