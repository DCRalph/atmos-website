import Image from "next/image";

import { CONTRACT_VERSION } from "~/lib/contracts";
import { cn } from "~/lib/utils";

/**
 * The parts every contract is built from. Styled by `~/styles/contract.css`,
 * which the contracts layout loads. All of it renders on the server: the
 * fields are uncontrolled inputs, so what is typed into them is simply what
 * prints.
 */

/** One contract: the masthead, then whatever the agreement puts under it. */
export function ContractSheet({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
          <span className="t-label">{CONTRACT_VERSION}</span>
        </div>
        <h1>{title}</h1>
      </header>
      <div className="body">{children}</div>
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
 * One labelled line. `value` is what the database already knows; it stays
 * editable. `as="textarea"` gives two lines, and `as="line"` leaves a bare
 * line for ink (a signature).
 */
export function Field({
  label,
  value,
  span,
  as = "input",
}: {
  label: string;
  value?: string;
  span?: 2 | 4;
  as?: "input" | "textarea" | "line";
}) {
  const className = cn(
    "field",
    span && `span${span}`,
    as !== "input" && "tall",
  );
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
        <textarea rows={2} defaultValue={value} />
      ) : (
        <input type="text" defaultValue={value} />
      )}
    </label>
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
            <Field label="Signature" span={2} as="line" />
            <Field label="Name" />
            <Field label="Date" />
          </div>
        </div>
        <div>
          <h3>Atmos Media</h3>
          <div className="fields">
            <Field label="Signature" span={2} as="line" />
            <Field label="Name and role" />
            <Field label="Date" />
          </div>
        </div>
      </div>
    </section>
  );
}
