import Image from "next/image";

import {
  CONTRACT_FORM_ID,
  CONTRACT_VERSION,
  formatShortContractDate,
  type ContractDefaults,
  type ContractSigning,
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
 * editable unless the field is `readOnly`. `as="textarea"` gives two lines.
 *
 * `as="line"` is a bare line for ink: whatever is written at signing or
 * handover belongs on the paper, and a typed value would be lost with the
 * next save. A line can still print a `value` it was given, which is how an
 * electronic signature shows. `tall` leaves room for a signature.
 *
 * `fill` marks a field the reader is being asked to complete (the signing
 * page), so it stands out on screen.
 */
export function Field({
  label,
  name,
  value,
  span,
  as = "input",
  tall = as === "textarea",
  readOnly,
  fill,
}: {
  label: string;
  name?: string;
  value?: string;
  span?: 2 | 4;
  as?: "input" | "textarea" | "line";
  tall?: boolean;
  readOnly?: boolean;
  fill?: boolean;
}) {
  const className = cn(
    "field",
    span && `span${span}`,
    tall && "tall",
    fill && "fill",
  );
  if (as === "line") {
    return (
      <div className={className}>
        <span>{label}</span>
        {value ? <p className="ink">{value}</p> : null}
      </div>
    );
  }
  return (
    <label className={className}>
      <span>{label}</span>
      {as === "textarea" ? (
        <textarea
          rows={2}
          name={name}
          defaultValue={value}
          readOnly={readOnly}
        />
      ) : (
        <input
          type="text"
          name={name}
          defaultValue={value}
          readOnly={readOnly}
        />
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

/**
 * The signature block: the other party on the left, Atmos on the right.
 *
 * Blank lines for ink until the contract is sent. Sending it is Atmos's
 * signature, so the admin who sent it and the date print on the right. The
 * other party's side prints the name they typed when they signed on the
 * website, or just the date when an admin marked a paper copy signed.
 */
export function Signatures({
  party,
  signing,
}: {
  party: string;
  signing?: ContractSigning | null;
}) {
  const signedOn = signing?.signedAt
    ? formatShortContractDate(signing.signedAt)
    : undefined;
  const sentOn = signing?.sentAt
    ? formatShortContractDate(signing.sentAt)
    : undefined;
  const sentBy = signing?.sentAt
    ? (signing.sentByName ?? undefined)
    : undefined;

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
            <Field
              label="Signature"
              value={signing?.signedName ?? undefined}
              span={2}
              as="line"
              tall
            />
            <Field
              label="Name"
              value={signing?.signedName ?? undefined}
              as="line"
            />
            <Field label="Date" value={signedOn} as="line" />
          </div>
          {signing?.signedName ? (
            <p className="esign">Signed electronically at atmosmedia.co.nz</p>
          ) : null}
        </div>
        <div>
          <h3>Atmos Media</h3>
          <div className="fields">
            <Field label="Signature" value={sentBy} span={2} as="line" tall />
            <Field label="Name and role" value={sentBy} as="line" />
            <Field label="Date" value={sentOn} as="line" />
          </div>
          {sentBy ? (
            <p className="esign">Issued electronically by Atmos Media</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
