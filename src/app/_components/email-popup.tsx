"use client";

import { useState, useEffect } from "react";

export function EmailPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    // Check if user has already seen or dismissed the popup
    // const hasSeenPopup = localStorage.getItem("atmosEmailPopupSeen");
    const hasSeenPopup = false

    if (!hasSeenPopup) {
      // Show popup after 5 seconds
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsClosing(true);

    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      localStorage.setItem("atmosEmailPopupSeen", "true");
    }, 400); // Match animation duration
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Here you would typically send the email to your backend
    console.log("Subscribing email:", email);

    setIsSubmitted(true);

    // Close popup after 2 seconds
    setTimeout(() => {
      handleClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none transition-transform duration-500 ease-out ${isClosing ? 'translate-y-full' : 'translate-y-0'
        }`}
    >
      <div className="pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-t-lg border border-white/20 bg-black/95 backdrop-blur-md shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 text-white/60 transition-colors hover:text-white z-10"
          aria-label="Close popup"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {!isSubmitted ? (
          <div className="flex flex-col md:flex-row items-center gap-4 p-4 md:p-6">
            <div className="flex-1 text-center md:text-left">
              <h2 className="mb-1 text-xl md:text-2xl font-bold tracking-wider text-white">
                JOIN THE ATMOSPHERE
              </h2>
              <p className="text-sm text-white/60">
                Get exclusive updates on gigs, mixes, and releases.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2 w-full md:w-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="flex-1 md:w-64 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
              />

              <button
                type="submit"
                className="rounded-md bg-white px-6 py-2 text-sm font-semibold text-black transition-all hover:bg-white/90 whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 p-4 md:p-6">
            <svg
              className="h-6 w-6 text-green-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div>
              <h3 className="text-lg font-bold text-white">Welcome to the Atmosphere!</h3>
              <p className="text-sm text-white/60">Check your inbox to confirm.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

