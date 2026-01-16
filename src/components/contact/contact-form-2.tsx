"use client";

import type React from "react";

import { useState } from "react";
import { CustomSelect } from "./custom-select";
import { api } from "~/trpc/react";

const CONTACT_REASONS = [
  "General Inquiry",
  "Booking Request",
  "Partnership Opportunity",
  "Press & Media",
  "Technical Support",
  "Other",
];

type FieldErrors = {
  name?: string;
  email?: string;
  reason?: string;
  message?: string;
};

export function ContactForm() {
  const [selectedReason, setSelectedReason] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const createContact = api.contact.create.useMutation({
    onSuccess: () => {
      setSubmitStatus("success");
      setFormData({ name: "", email: "", message: "" });
      setSelectedReason("");
      setErrors({});
    },
    onError: () => {
      setSubmitStatus("error");
    },
  });

  const validateForm = (): boolean => {
    const newErrors: FieldErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Please enter your name";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Please enter your email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!selectedReason) {
      newErrors.reason = "Please select a reason for contacting us";
    }

    if (!formData.message.trim()) {
      newErrors.message = "Please enter your message";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("idle");

    if (!validateForm()) {
      return;
    }

    createContact.mutate({
      name: formData.name.trim(),
      email: formData.email.trim(),
      reason: selectedReason,
      message: formData.message.trim(),
    });
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success Message */}
      {submitStatus === "success" && (
        <div className="border-2 border-green-500 bg-green-500/20 px-4 py-3 font-mono text-sm text-green-400">
          <span className="font-bold tracking-wider uppercase">
            Message sent!
          </span>
          <span className="ml-2">We&apos;ll get back to you soon.</span>
        </div>
      )}

      {/* Error Message */}
      {submitStatus === "error" && (
        <div className="border-2 border-red-500 bg-red-500/20 px-4 py-3 font-mono text-sm text-red-400">
          <span className="font-bold tracking-wider uppercase">Error!</span>
          <span className="ml-2">Something went wrong. Please try again.</span>
        </div>
      )}

      {/* Name Input */}
      <div>
        <label
          htmlFor="name"
          className="mb-2 block text-sm font-bold tracking-wider uppercase"
        >
          Name
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            clearFieldError("name");
          }}
          className={`focus:border-accent-strong w-full border-2 bg-black/50 px-4 py-3 font-mono text-white transition-all placeholder:text-white/40 focus:shadow-[0_0_15px_var(--accent-muted)] focus:outline-none ${
            errors.name
              ? "border-accent-strong shadow-[0_0_15px_var(--accent-muted)]"
              : "border-white/20"
          }`}
          placeholder="YOUR NAME"
        />
        {errors.name && (
          <p className="mt-1 font-mono text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      {/* Email Input */}
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-bold tracking-wider uppercase"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => {
            setFormData({ ...formData, email: e.target.value });
            clearFieldError("email");
          }}
          className={`focus:border-accent-strong w-full border-2 bg-black/50 px-4 py-3 font-mono text-white transition-all placeholder:text-white/40 focus:shadow-[0_0_15px_var(--accent-muted)] focus:outline-none ${
            errors.email
              ? "border-accent-strong shadow-[0_0_15px_var(--accent-muted)]"
              : "border-white/20"
          }`}
          placeholder="YOUR@EMAIL.COM"
        />
        {errors.email && (
          <p className="mt-1 font-mono text-sm text-red-500">{errors.email}</p>
        )}
      </div>

      {/* Reason Select */}
      <div>
        <label
          htmlFor="reason"
          className="mb-2 block text-sm font-bold tracking-wider uppercase"
        >
          Reason
        </label>
        <CustomSelect
          options={CONTACT_REASONS}
          value={selectedReason}
          onChange={(value) => {
            setSelectedReason(value);
            clearFieldError("reason");
          }}
          placeholder="SELECT A REASON"
          hasError={!!errors.reason}
        />
        {errors.reason && (
          <p className="mt-1 font-mono text-sm text-red-500">{errors.reason}</p>
        )}
      </div>

      {/* Message Textarea */}
      <div>
        <label
          htmlFor="message"
          className="mb-2 block text-sm font-bold tracking-wider uppercase"
        >
          Message
        </label>
        <textarea
          id="message"
          rows={6}
          value={formData.message}
          onChange={(e) => {
            setFormData({ ...formData, message: e.target.value });
            clearFieldError("message");
          }}
          className={`focus:border-accent-strong w-full resize-none border-2 bg-black/50 px-4 py-3 font-mono text-white transition-all placeholder:text-white/40 focus:shadow-[0_0_15px_var(--accent-muted)] focus:outline-none ${
            errors.message
              ? "border-accent-strong shadow-[0_0_15px_var(--accent-muted)]"
              : "border-white/20"
          }`}
          placeholder="YOUR MESSAGE HERE..."
        />
        {errors.message && (
          <p className="mt-1 font-mono text-sm text-red-500">
            {errors.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={createContact.isPending}
        className="bg-accent-strong hover:bg-accent-muted w-full px-8 py-4 font-bold tracking-[0.2em] text-white uppercase transition-all hover:shadow-[0_0_20px_var(--accent-muted)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
      >
        {createContact.isPending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
