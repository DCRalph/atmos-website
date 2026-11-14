import {
  Clause,
  ContractSheet,
  Field,
  FieldGroup,
  Signatures,
  Terms,
} from "~/components/admin/contracts/contract-sheet";
import type { PerformerDetails } from "~/lib/contracts";

/**
 * The performer agreement. `details` is whatever the database knows about
 * the booking; pass nothing for a blank one. "Arrive by" is worked out from
 * the 30 minutes in clause 2.1: change one and change `ARRIVAL_LEAD_MINUTES`
 * in `~/lib/contracts` with it.
 */
export function PerformerAgreement({
  details = {},
}: {
  details?: Partial<PerformerDetails>;
}) {
  return (
    <ContractSheet title="Performer agreement">
      <FieldGroup title="Performer">
        <Field label="Legal name" value={details.legalName} span={2} />
        <Field label="Stage name" value={details.stageName} span={2} />
        <Field label="Email" value={details.email} span={2} />
        <Field label="Phone" />
        <Field label="GST no. (if any)" />
        <Field label="Bank account for payment (name and number)" span={4} />
      </FieldGroup>

      <FieldGroup title="Booking details">
        <Field label="Event" value={details.event} span={2} />
        <Field label="Date" value={details.date} span={2} />
        <Field label="Venue" value={details.venue} span={4} />
        <Field label="Set time" value={details.setTime} />
        <Field label="Set length" value={details.setLength} />
        <Field label="Arrive by" value={details.arriveBy} />
        <Field label="Guest list places" />
        <Field label="Fee (NZD)" />
        <Field label="GST included (Y / N)" />
        <Field
          label="Atmos contact (name and phone)"
          value={details.atmosContact}
          span={2}
        />
        <Field
          label="Anything else agreed (equipment, travel, extras)"
          span={4}
          as="textarea"
        />
      </FieldGroup>

      <p className="intro">
        This agreement is between Atmos Media (&quot;Atmos&quot;,
        &quot;we&quot;, &quot;us&quot;) and the performer named above
        (&quot;you&quot;). It is made up of the performer and booking details
        above and the terms below.
      </p>

      <Terms>
        <Clause title="The booking">
          <li>
            You agree to perform at the event, on the date and at the set time
            in the booking details, for the full set length.
          </li>
          <li>
            Set times can move as a line-up comes together. We will tell you
            about any change as early as we can, and you agree to reasonable
            changes, including on the night.
          </li>
          <li>
            You will perform personally. You may not send someone in your place,
            or add another performer to your set, unless we agree in writing
            first.
          </li>
          <li>
            You are an independent contractor. Nothing in this agreement makes
            you our employee, partner or agent.
          </li>
        </Clause>

        <Clause title="Arrival and your set">
          <li>
            <strong>
              You must be at the venue, checked in with the Atmos event manager
              and ready to play, at least 30 minutes before your set time.
            </strong>
          </li>
          <li>
            If you are running late, call or message your Atmos contact straight
            away.
          </li>
          <li>
            Start and finish on time, and hand over cleanly to the next
            performer.
          </li>
          <li>
            If you arrive late or are not ready at your set time, we may
            shorten, move or cancel your set and reduce your fee to match the
            time you actually played. If you do not turn up, no fee is payable.
          </li>
        </Clause>

        <Clause title="Equipment and music">
          <li>
            We provide the sound system and the standard DJ booth set-up for the
            event. Tell us at least 7 days before the event if you need anything
            else. We will try to help, but we only promise equipment we have
            confirmed in writing.
          </li>
          <li>
            <strong>
              DJs must bring their music on USB, plus at least one spare USB as
              a backup.
            </strong>
            Both must hold your full set in a format the booth players can read.
          </li>
          <li>
            Bring your own headphones. Anything else you bring, such as a
            controller, laptop or instrument, is yours to look after and stays
            at your own risk.
          </li>
          <li>
            Treat the equipment at the event with care. Keep drinks off and away
            from the booth, and do not unplug or reconfigure anything without
            the OK of our event manager or sound technician.
          </li>
          <li>
            Follow directions from our event manager or sound technician on
            volume, and keep the mixer out of the red.
          </li>
          <li>
            If equipment at the event is damaged because of your negligence or
            misuse, you must pay the reasonable cost of repairing or replacing
            it. We may deduct that cost from your fee.
          </li>
        </Clause>

        <Clause title="Payment">
          <li>
            <strong>
              We will pay your fee within 14 days of your set time,
            </strong>
            by bank transfer to the account in the performer details.
          </li>
          <li>
            If we do not have correct bank details by your set time, the 14 days
            run from the day we receive them.
          </li>
          <li>
            The fee is the total amount payable for the performance. It covers
            your preparation, travel, accommodation and other costs unless the
            booking details say otherwise.
          </li>
          <li>
            If you are registered for GST, give us your GST number and send us a
            tax invoice. GST is added to the fee only if the booking details say
            it is not included.
          </li>
          <li>
            You are responsible for your own income tax, ACC levies and other
            costs of working for yourself. If the law requires us to deduct
            withholding tax from your fee, we will deduct it and pay it to
            Inland Revenue.
          </li>
        </Clause>

        <Clause title="Cancellation">
          <li>
            If you can no longer perform, tell us as soon as you know, and at
            least 14 days before the event wherever possible. No fee is payable
            for a set you do not play.
          </li>
          <li>
            If we cancel your set less than 7 days before the event for a reason
            within our control, we will pay you 50% of the fee. If we cancel
            earlier than that, no fee is payable.
          </li>
          <li>
            If the event is cancelled, cut short or postponed for a reason
            outside our control, such as weather, venue closure, power failure,
            illness, or a licensing, safety or government direction, neither of
            us is liable to the other and no fee is payable for a set that was
            not played. We will try to book you for the new date.
          </li>
          <li>
            We may cancel your set without payment if you seriously breach this
            agreement.
          </li>
        </Clause>

        <Clause title="Conduct and safety">
          <li>
            Treat staff, other performers and guests with respect. We do not
            tolerate harassment, discrimination, violence or threats.
          </li>
          <li>
            Follow the venue&apos;s rules, the conditions of its alcohol
            licence, and every reasonable direction from our event manager,
            venue staff and security, including on health and safety.
          </li>
          <li>
            You must be fit to perform. Do not perform so affected by alcohol or
            anything else that it harms your set or anyone&apos;s safety.
          </li>
          <li>
            Most of our events are R18. Bring valid photo ID, and make sure your
            guests do too.
          </li>
          <li>
            Tell us straight away about any accident, injury, hazard or damage
            you see or are involved in.
          </li>
          <li>
            If you breach this section we may stop your set or ask you to leave,
            and we may reduce or withhold your fee.
          </li>
        </Clause>

        <Clause title="Promotion and recordings">
          <li>
            You allow us to use your name, stage name, likeness, logo, biography
            and any photos you give us to promote the event and Atmos, before
            and after the event, on any channel.
          </li>
          <li>
            You confirm you have the right to give us the promotional material
            you send, and that our using it will not infringe anyone else&apos;s
            rights.
          </li>
          <li>
            We photograph, film and record our events, including sets. You agree
            that we may record your performance, publish the photos, video and
            audio on our website, social and streaming channels, and use them to
            promote Atmos, without further payment. We will credit you wherever
            we reasonably can.
          </li>
          <li>
            We own the recordings we make. You keep all rights in your own
            original music, name and brand. If you would like something we have
            published changed or taken down, ask us and we will work with you in
            good faith.
          </li>
          <li>
            Please do not announce the booking or the line-up before we do. Once
            it is announced, we would appreciate you sharing the event on your
            own channels.
          </li>
        </Clause>

        <Clause title="Guests">
          <li>
            Guest list places are limited to the number in the booking details.
            Send the names to your Atmos contact at least 24 hours before doors
            open.
          </li>
          <li>
            Your guests come in under the same entry conditions as everyone
            else, and may be refused entry or asked to leave on the same basis.
          </li>
        </Clause>

        <Clause title="Liability">
          <li>
            You are responsible for your own equipment and belongings. We are
            not liable for their loss, theft or damage unless our negligence
            caused it.
          </li>
          <li>
            You are responsible for loss or damage you cause through negligence,
            wilful misconduct or a breach of this agreement.
          </li>
          <li>
            Neither of us is liable to the other for indirect or consequential
            loss, or for loss of profit. Our total liability to you under this
            agreement is limited to the fee.
          </li>
          <li>
            Nothing in this agreement limits liability that cannot be limited by
            law.
          </li>
          <li>
            We recommend you hold your own insurance for your equipment and for
            public liability.
          </li>
        </Clause>

        <Clause title="General">
          <li>
            This agreement is the whole agreement between us about the booking
            and replaces anything said or written earlier.
          </li>
          <li>
            Changes are valid only if agreed in writing. An email or message
            between you and your Atmos contact counts as writing.
          </li>
          <li>
            Keep your fee and the terms of the booking confidential, other than
            from your advisers or where the law requires disclosure.
          </li>
          <li>
            We hold your details to run the booking, pay you and keep our
            records, as set out in our privacy policy at
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

      <Signatures party="Performer" />
    </ContractSheet>
  );
}
