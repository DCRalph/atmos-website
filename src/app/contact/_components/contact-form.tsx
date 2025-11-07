"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const createSubmission = api.contact.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setTimeout(() => setSubmitted(false), 5000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSubmission.mutate({ name, email, subject, message });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name" className="mb-2 block text-sm font-semibold text-white">
          Name
        </Label>
        <Input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
          placeholder="Your name"
          required
        />
      </div>

      <div>
        <Label htmlFor="email" className="mb-2 block text-sm font-semibold text-white">
          Email
        </Label>
        <Input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
          placeholder="your@email.com"
          required
        />
      </div>

      <div>
        <Label htmlFor="subject" className="mb-2 block text-sm font-semibold text-white">
          Subject
        </Label>
        <Input
          type="text"
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
          placeholder="What's this about?"
          required
        />
      </div>

      <div>
        <Label htmlFor="message" className="mb-2 block text-sm font-semibold text-white">
          Message
        </Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
          placeholder="Tell us more..."
          required
        />
      </div>

      {submitted && (
        <div className="rounded-md bg-green-500/20 border border-green-500/50 px-4 py-3 text-green-200 text-sm">
          Message sent successfully!
        </div>
      )}

      <Button
        type="submit"
        disabled={createSubmission.isPending}
        className="w-full rounded-md bg-white px-6 py-3 font-semibold text-black transition-all hover:bg-white/90"
      >
        {createSubmission.isPending ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}

