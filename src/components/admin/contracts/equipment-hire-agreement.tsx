import {
  Clause,
  ContractSheet,
  Field,
  FieldGroup,
  Signatures,
  Terms,
} from "~/components/admin/contracts/contract-sheet";
import type { HireDetails } from "~/lib/contracts";

/** The equipment list never has fewer rows than this, so there is room to add to it. */
const MIN_EQUIPMENT_ROWS = 8;

/**
 * The equipment hire agreement. `details` is whatever the database knows
 * about the rental; pass nothing for a blank one. Clause 5.2 points at
 * section 4 by number: keep them in step if sections are added or moved.
 */
export function EquipmentHireAgreement({
  details = {},
}: {
  details?: Partial<HireDetails>;
}) {
  const items = details.items ?? [];
  const rows = [
    ...items,
    ...Array.from(
      { length: Math.max(2, MIN_EQUIPMENT_ROWS - items.length) },
      () => ({ name: "", quantity: "" }),
    ),
  ];

  return (
    <ContractSheet title="Equipment hire agreement">
      <FieldGroup title="Hirer">
        <Field label="Full name" value={details.name} span={2} />
        <Field label="Organisation (if any)" span={2} />
        <Field label="Email" value={details.email} span={2} />
        <Field label="Phone" span={2} />
        <Field label="Address" span={2} />
        <Field label="Photo ID type and number" span={2} />
      </FieldGroup>

      <FieldGroup title="Hire details">
        <Field
          label="Collection date and time"
          value={details.collection}
          span={2}
        />
        <Field label="Return date and time" value={details.return} span={2} />
        <Field label="Where the equipment will be used" span={4} />
        <Field label="Hire fee (NZD)" value={details.hireFee} />
        <Field label="Daily rate if late (NZD)" value={details.dailyRate} />
        <Field label="Bond (NZD)" />
        <Field label="Atmos contact" />
      </FieldGroup>

      <section className="group">
        <h2>Equipment list</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Item</th>
                <th style={{ width: "8%" }}>Qty</th>
                <th style={{ width: "18%" }}>Serial or asset no.</th>
                <th style={{ width: "16%" }}>Replacement value</th>
                <th>Condition at collection</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      aria-label="Item"
                      defaultValue={row.name}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      aria-label="Quantity"
                      defaultValue={row.quantity}
                    />
                  </td>
                  <td>
                    <input type="text" aria-label="Serial or asset number" />
                  </td>
                  <td>
                    <input type="text" aria-label="Replacement value" />
                  </td>
                  <td>
                    <input type="text" aria-label="Condition at collection" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="intro">
        This agreement is between Atmos Media (&quot;Atmos&quot;,
        &quot;we&quot;, &quot;us&quot;) and the hirer named above
        (&quot;you&quot;). It is made up of the hirer details, hire details and
        equipment list above and the terms below. &quot;The equipment&quot;
        means everything in the equipment list, including cables, cases and
        accessories.
      </p>

      <Terms>
        <Clause title="The hire">
          <li>
            We agree to hire the equipment to you for the hire period. The hire
            period runs from when you collect the equipment, or we deliver it,
            until it is back in our hands.
          </li>
          <li>
            The equipment stays our property at all times. You must not sell it,
            lend it, hire it on to anyone else, use it as security or part with
            it in any other way.
          </li>
          <li>
            You must be 18 or over and show us valid photo ID when we ask. If
            you are hiring for an organisation, you confirm you can sign for it,
            and you and the organisation are both responsible under this
            agreement.
          </li>
        </Clause>

        <Clause title="Fees and bond">
          <li>
            The hire fee is payable in full before collection unless we agree
            otherwise in writing.
          </li>
          <li>
            If we ask for a bond, we hold it as security. We will refund it
            within 7 days of the equipment coming back, less anything you owe us
            under this agreement. What you owe is not limited to the bond.
          </li>
          <li>
            If the equipment comes back late, you must pay the daily rate for
            each day or part day it is late.
          </li>
          <li>
            Anything else you owe us under this agreement is payable within 7
            days of our invoice.
          </li>
        </Clause>

        <Clause title="Collection and return">
          <li>
            Check the equipment when you receive it. Tell us about anything
            missing, damaged or not working before you take it away, or within 2
            hours of delivery. Otherwise you accept that it was complete and in
            the condition recorded in the equipment list.
          </li>
          <li>
            Transport the equipment in its cases, secured and protected from the
            weather.
          </li>
          <li>
            Return all of the equipment to the agreed place by the return date
            and time, clean, complete and packed in the cases it came in.
          </li>
          <li>
            We check and test equipment after it comes back, and will tell you
            within 5 working days if anything is missing or damaged.
          </li>
        </Clause>

        <Clause title="Looking after the equipment">
          <li>
            <strong>
              You are responsible for the equipment for the whole hire period,
            </strong>
            including while it is being transported, set up, used and stored,
            and whoever is using it.
          </li>
          <li>
            Keep it secure. Do not leave it unattended in a public place, in an
            unlocked building or vehicle, or in view in a vehicle overnight.
          </li>
          <li>
            Keep it dry and protected from rain, moisture, dust, sand, heat and
            spilled drinks. Outdoor use needs proper cover.
          </li>
          <li>
            Only let competent people set it up and operate it, and follow the
            manufacturer&apos;s instructions and any instructions we give you.
          </li>
          <li>
            Use a safe and suitable power supply, and do not overload the
            equipment. Keep levels out of the red. Speakers and amplifiers
            damaged by overdriving are damaged by misuse.
          </li>
          <li>
            Do not open, repair or modify the equipment, and do not remove or
            cover its labels or serial numbers.
          </li>
          <li>
            Use the equipment only at the place in the hire details unless we
            agree otherwise.
          </li>
          <li>
            You are responsible for setting up safely, including securing stands
            and cables, and for any permission your event needs.
          </li>
        </Clause>

        <Clause title="Damage, loss and theft">
          <li>
            <strong>
              If the equipment is damaged, lost or stolen during the hire period
              because of negligence, misuse or a breach of this agreement, by
              you or by anyone you allow to handle or use it, you must pay us:
            </strong>
            <ol>
              <li>the reasonable cost of repairing it; or</li>
              <li>
                if it is lost, stolen or not worth repairing, the replacement
                value in the equipment list, or the cost of an equivalent
                replacement if no value is listed; and
              </li>
              <li>
                the hire fees we lose while it is being repaired or replaced, at
                the daily rate, for up to 14 days.
              </li>
            </ol>
          </li>
          <li>
            Damage, loss or theft that happens because section 4 was not
            followed is treated as caused by your negligence.
          </li>
          <li>
            You are not liable for fair wear and tear, or for a fault you did
            not cause.
          </li>
          <li>
            Tell us immediately about any damage, loss or theft. If the
            equipment is stolen or deliberately damaged, you must also report it
            to the Police within 24 hours and give us the report number.
          </li>
          <li>
            If the equipment comes back dirty or with parts missing, you must
            pay the reasonable cost of cleaning it or replacing the missing
            parts.
          </li>
          <li>
            We will give you a breakdown of what you owe, with the repair or
            replacement quote or invoice. We may take what you owe from the bond
            and invoice you for the rest.
          </li>
        </Clause>

        <Clause title="Faults and breakdowns">
          <li>
            If the equipment stops working properly, stop using it and tell us
            straight away. Do not try to fix it yourself.
          </li>
          <li>
            If you did not cause the fault, we will repair or replace the
            equipment as soon as we reasonably can, or refund the hire fee for
            the time you could not use it. That is the limit of what we owe you
            for a fault or breakdown.
          </li>
        </Clause>

        <Clause title="Insurance">
          <li>
            We do not insure the equipment for you while it is in your care. We
            recommend you arrange your own cover for the hire period, including
            public liability cover for your event.
          </li>
        </Clause>

        <Clause title="Cancellation">
          <li>
            If you cancel 48 hours or more before the collection time, we will
            refund the hire fee in full. If you cancel later than that, we may
            keep up to 50% of the hire fee. There is no refund for equipment
            returned early.
          </li>
          <li>
            We may cancel before collection if the equipment becomes
            unavailable, for example because of a fault or a late return. If we
            do, we will refund everything you have paid, and that is the limit
            of what we owe you.
          </li>
          <li>
            We may end the hire if you breach this agreement or we reasonably
            believe the equipment is at risk. If we do, you must return the
            equipment immediately or let us collect it.
          </li>
        </Clause>

        <Clause title="Liability">
          <li>
            You use the equipment at your own risk. You are responsible for any
            loss, damage or injury caused by how the equipment is transported,
            set up or used during the hire period, and you will cover us for any
            claim made against us because of it, except to the extent our
            negligence caused it.
          </li>
          <li>
            We are not liable for indirect or consequential loss, loss of profit
            or revenue, or the cost of a cancelled or disrupted event. Our total
            liability to you under this agreement is limited to the hire fee.
          </li>
          <li>
            If you are hiring for a business, you agree that the Consumer
            Guarantees Act 1993 does not apply. Otherwise, nothing in this
            agreement limits your rights under that Act, or any liability that
            cannot be limited by law.
          </li>
        </Clause>

        <Clause title="General">
          <li>
            This agreement is the whole agreement between us about the hire and
            replaces anything said or written earlier.
          </li>
          <li>
            Changes are valid only if agreed in writing. An email or message
            between you and your Atmos contact counts as writing.
          </li>
          <li>
            We hold your details, including your ID details, to run the hire and
            keep our records, as set out in our privacy policy at
            atmosmedia.co.nz/legal/privacy.
          </li>
          <li>
            This agreement may be signed electronically and in separate copies.
          </li>
          <li>
            If we disagree about anything in this agreement, we will both try to
            sort it out by talking first. New Zealand law applies and the New
            Zealand courts have jurisdiction.
          </li>
        </Clause>
      </Terms>

      <Signatures party="Hirer" />

      <section className="sign">
        <p>Condition check, completed with the hirer present where possible.</p>
        <div className="cols">
          <div>
            <h3>At collection</h3>
            <div className="fields">
              <Field label="Date and time" />
              <Field label="Hirer initials" />
              <Field label="Checked by (Atmos)" span={2} />
            </div>
          </div>
          <div>
            <h3>At return</h3>
            <div className="fields">
              <Field label="Date and time" />
              <Field label="Hirer initials" />
              <Field label="Checked by (Atmos)" span={2} />
            </div>
          </div>
        </div>
        <div className="fields">
          <Field
            label="Notes on missing or damaged items"
            span={4}
            as="textarea"
          />
        </div>
      </section>
    </ContractSheet>
  );
}
