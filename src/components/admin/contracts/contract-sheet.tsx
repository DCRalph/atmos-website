import Image from "next/image";

import {
  CONTRACT_FORM_ID,
  CONTRACT_VERSION,
  type ContractDefaults,
} from "~/lib/contracts";
import { cn } from "~/lib/utils";

/**
 * The parts every contract is built from. Styled by `~/styles/contract.css`,
 * which the contracts layout loads. All of it renders on the server: the
 * fields are uncontrolled inputs in one form, so what is typed into them is
 * what prints, and what `ContractBar` reads to save.
 */

/**
 * One contract: the masthead, then whatever the agreement puts under it.
 * `locked` freezes every field (a sent or signed contract). `revision` is
 * the form's key: when it changes, the fields restart from what was passed.
 *
 * `atmosParty` and `version` are printed, not typed, so they are also hidden
 * inputs: a saved contract keeps the ones it was issued under.
 */
export function ContractSheet({
  title,
  atmosParty,
  version,
  locked = false,
  revision,
  children,
}: {
  title: string;
  locked?: boolean;
  revision?: string;
  children: React.ReactNode;
} & Pick<ContractDefaults, "atmosParty" | "version">) {
  return (
    <article className="contract">
      {/* The printed footer's left box. The rest of the footer is in contract.css. */}
      <style>{`@page contract { @bottom-left {
        content: "Atmos Media · ${title}"; color: #777; padding-left: 16mm;
        font: 6.5pt "Helvetica Neue", Helvetica, Arial, sans-serif;
        letter-spacing: 0.08em; text-transform: uppercase; } }`}</style>
      <header className="masthead">
        <div className="top">
          <Image
            src="/logo/atmos-white.png"
            alt="Atmos"
            width={5001}
            height={1120}
            priority
            unoptimized
          />
          <span className="t-label">{version || CONTRACT_VERSION}</span>
        </div>
        <h1>{title}</h1>
      </header>
      <form id={CONTRACT_FORM_ID} key={revision}>
        <fieldset className="body" disabled={locked}>
          <input type="hidden" name="atmosParty" value={atmosParty} />
          <input type="hidden" name="version" value={version} />
          {children}
        </fieldset>
      </form>
    </article>
  );
}

/** A titled block of fields, four to a row. */
export function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="group">
      <h2>{title}</h2>
      <div className="fields">{children}</div>
    </section>
  );
}

/**
 * One labelled line. `name` is the field's key in the saved contract, and
 * every typed field has one. `value` is what is already known, and stays
 * editable. `as="textarea"` gives two lines. `as="line"` is
 * a bare line for ink: whatever is written at signing or handover belongs on
 * the paper, and a typed value would be lost with the next save. `tall`
 * leaves room for a signature.
 */
export function Field({
  label,
  name,
  value,
  span,
  as = "input",
  tall = as === "textarea",
}: {
  label: string;
  name?: string;
  value?: string;
  span?: 2 | 4;
  as?: "input" | "textarea" | "line";
  tall?: boolean;
}) {
  const className = cn("field", span && `span${span}`, tall && "tall");
  if (as === "line") {
    return (
      <div className={className}>
        <span>{label}</span>
      </div>
    );
  }
  return (
    <label className={className}>
      <span>{label}</span>
      {as === "textarea" ? (
        <textarea rows={2} name={name} defaultValue={value} />
      ) : (
        <input type="text" name={name} defaultValue={value} />
      )}
    </label>
  );
}

/**
 * The sentence that names the parties. `atmosParty` is the company as the
 * settings give it; `counterparty` is "performer" or "hirer".
 */
export function Parties({
  atmosParty,
  counterparty,
  children,
}: {
  atmosParty: string;
  counterparty: string;
  children: React.ReactNode;
}) {
  return (
    <p className="intro">
      This agreement is between {atmosParty || "Atmos Media"}{" "}
      (&quot;Atmos&quot;, &quot;we&quot;, &quot;us&quot;) and the {counterparty}{" "}
      named above (&quot;you&quot;). {children}
    </p>
  );
}

/** The numbered terms. Each `Clause` is a section; its `<li>` children are the clauses. */
export function Terms({ children }: { children: React.ReactNode }) {
  return <div className="terms">{children}</div>;
}

export function Clause({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="clause">
      <h2>{title}</h2>
      <ol>{children}</ol>
    </section>
  );
}

/** The signature block: the other party on the left, Atmos on the right. */
export function Signatures({ party }: { party: string }) {
  return (
    <section className="sign">
      <p>
        By signing, each of us confirms we have read this agreement and agree to
        it.
      </p>
      <div className="cols">
        <div>
          <h3>{party}</h3>
          <div className="fields">
            <Field label="Signature" span={2} as="line" tall />
            <Field label="Name" as="line" />
            <Field label="Date" as="line" />
          </div>
        </div>
        <div>
          <h3>Atmos Media</h3>
          <div className="fields">
            <Field label="Signature" span={2} as="line" tall />
            <Field label="Name and role" as="line" />
            <Field label="Date" as="line" />
          </div>
        </div>
      </div>
    </section>
  );
}
