"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { readContractForm } from "~/components/admin/contracts/contract-form";
import { SiteCheckbox } from "~/components/site/inputs";
import { Button, inputClass } from "~/components/site/ui";
import {
  fieldLabelClass,
  ticketPanelClass,
} from "~/components/tickets/ticket-shell";
import { SIGNER_FIELDS } from "~/lib/contracts";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

/**
 * Where the other party signs, under the contract on its signing page: they
 * type their name, tick that they agree, and sign. Their own details, filled
 * in on the contract above, go with the signature. The page then reloads as
 * the signed copy.
 */
export function SignPanel({
  token,
  kind,
}: {
  token: string;
  kind: "PERFORMER" | "HIRE";
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const sign = api.contracts.sign.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <form
      className={cn(
        ticketPanelClass,
        "mx-auto mt-6 w-[calc(100%-2rem)] max-w-xl space-y-5 print:hidden",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        const form = readContractForm();
        sign.mutate({
          token,
          name,
          agreed: true,
          details: Object.fromEntries(
            SIGNER_FIELDS[kind].map((key) => [key, form[key] ?? ""]),
          ),
        });
      }}
    >
      <div>
        <h2 className="t-display text-[22px]">Sign this agreement</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/65">
          Check the details highlighted above, then type your full name. Signing
          here has the same effect as signing on paper.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="sign-name" className={fieldLabelClass}>
          Full legal name
        </label>
        <input
          id="sign-name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
        />
      </div>
      <SiteCheckbox
        id="sign-agreed"
        checked={agreed}
        onCheckedChange={setAgreed}
      >
        I have read this agreement and agree to it.
      </SiteCheckbox>
      {sign.error ? (
        <p role="alert" className="text-site-danger-text text-[14px]">
          {sign.error.message}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        disabled={name.trim().length < 2 || !agreed || sign.isPending}
      >
        {sign.isPending ? "Signing…" : "Sign agreement"}
      </Button>
    </form>
  );
}

/** Prints the page, which is how a signed copy is saved as a PDF. */
export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      Print or save as PDF
    </Button>
  );
}
