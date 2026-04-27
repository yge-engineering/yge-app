// /lien-waivers/[id]/print — printable CA statutory waiver form.
//
// CA Civil Code §8132/§8134/§8136/§8138 require the exact statutory
// wording. The text below tracks the language adopted by the
// California Legislature; only the bracketed blanks change per job.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  formatUSD,
  isFinal,
  lienWaiverKindLabel,
  lienWaiverStatuteLabel,
  type LienWaiver,
  type LienWaiverKind,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchWaiver(id: string): Promise<LienWaiver | null> {
  const res = await fetch(`${apiBaseUrl()}/api/lien-waivers/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { waiver: LienWaiver }).waiver;
}

export default async function LienWaiverPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const w = await fetchWaiver(params.id);
  if (!w) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8 text-black">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/lien-waivers/${w.id}`} className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back
        </Link>
        <span className="text-xs text-gray-500">Use your browser's Print menu (Ctrl/Cmd+P)</span>
      </div>

      <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
        <h1 className="text-center text-lg font-bold uppercase">
          {titleFor(w.kind)}
        </h1>
        <p className="mt-1 text-center text-xs">
          California Civil Code {lienWaiverStatuteLabel(w.kind)}
        </p>

        <hr className="my-4 border-gray-300" />

        <table className="mb-4 w-full text-sm">
          <tbody>
            <Row label="Name of Claimant" value={w.claimantName} />
            <Row label="Name of Customer" value={w.ownerName} />
            <Row label="Job Location" value={w.jobAddress ?? w.jobName} />
            <Row label="Owner" value={w.ownerName} />
            {isFinal(w.kind) ? (
              <Row label="Final Invoice Amount" value={formatUSD(w.paymentAmountCents)} />
            ) : (
              <>
                <Row label="Through Date" value={w.throughDate} />
                <Row label="Amount of Progress Payment" value={formatUSD(w.paymentAmountCents)} />
              </>
            )}
          </tbody>
        </table>

        <BodyText kind={w.kind} waiver={w} />

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase">Date</div>
            <div className="mt-1 border-b border-gray-400 pb-1 text-sm">
              {w.signedOn ?? '\u00A0'}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase">Claimant Signature</div>
            <div className="mt-1 h-8 border-b border-gray-400" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase">Print Name</div>
            <div className="mt-1 border-b border-gray-400 pb-1 text-sm">
              {w.signedByName ?? '\u00A0'}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase">Title</div>
            <div className="mt-1 border-b border-gray-400 pb-1 text-sm">
              {w.signedByTitle ?? '\u00A0'}
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-300" />
        <p className="text-[10px] italic text-gray-600">
          This form is required by California Civil Code{' '}
          {lienWaiverStatuteLabel(w.kind)} and may not be modified except to
          fill in the blanks. Do not sign an unconditional waiver until funds
          have cleared the bank.
        </p>
      </article>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="w-1/3 py-1 align-top text-xs font-semibold uppercase">{label}:</td>
      <td className="py-1 align-top text-sm">{value}</td>
    </tr>
  );
}

function titleFor(k: LienWaiverKind): string {
  switch (k) {
    case 'CONDITIONAL_PROGRESS':
      return 'Conditional Waiver and Release on Progress Payment';
    case 'UNCONDITIONAL_PROGRESS':
      return 'Unconditional Waiver and Release on Progress Payment';
    case 'CONDITIONAL_FINAL':
      return 'Conditional Waiver and Release on Final Payment';
    case 'UNCONDITIONAL_FINAL':
      return 'Unconditional Waiver and Release on Final Payment';
  }
}

function BodyText({
  kind,
  waiver,
}: {
  kind: LienWaiverKind;
  waiver: LienWaiver;
}) {
  // The body text intentionally tracks the language enacted by the CA
  // Legislature in §8132/§8134/§8136/§8138. Each form has a NOTICE block
  // and a release clause that we render with the bracketed blanks filled.
  switch (kind) {
    case 'CONDITIONAL_PROGRESS':
      return (
        <div className="space-y-3">
          <p className="rounded border border-gray-400 p-2 text-xs">
            <strong>NOTICE:</strong> THIS DOCUMENT WAIVES THE CLAIMANT'S LIEN,
            STOP PAYMENT NOTICE, AND PAYMENT BOND RIGHTS EFFECTIVE ON RECEIPT
            OF PAYMENT. A PERSON SHOULD NOT RELY ON THIS DOCUMENT UNLESS
            SATISFIED THAT THE CLAIMANT HAS RECEIVED PAYMENT.
          </p>
          <p>
            This document waives and releases lien, stop payment notice, and
            payment bond rights the claimant has for labor and service provided,
            and equipment and material delivered, to the customer on this job
            through the Through Date of this document. Rights based upon labor
            or service provided, or equipment or material delivered, pursuant to
            a written change order that has been fully executed by the parties
            prior to the date that this document is signed by the claimant, are
            waived and released by this document, unless listed as an Exception
            below. This document is effective only on the claimant's receipt of
            payment from the financial institution on which the following check
            is drawn:
          </p>
          <p>
            Maker of Check: <span className="underline">{waiver.ownerName}</span>
          </p>
          <p>
            Amount of Check: <span className="underline">{formatUSD(waiver.paymentAmountCents)}</span>
          </p>
          <p>
            Check Payable To:{' '}
            <span className="underline">{waiver.claimantName}</span>
          </p>
          <ExceptionsBlock waiver={waiver} />
        </div>
      );
    case 'UNCONDITIONAL_PROGRESS':
      return (
        <div className="space-y-3">
          <p className="rounded border border-gray-400 p-2 text-xs">
            <strong>NOTICE TO CLAIMANT:</strong> THIS DOCUMENT WAIVES AND RELEASES
            LIEN, STOP PAYMENT NOTICE, AND PAYMENT BOND RIGHTS UNCONDITIONALLY
            AND STATES THAT YOU HAVE BEEN PAID FOR GIVING UP THOSE RIGHTS. THIS
            DOCUMENT IS ENFORCEABLE AGAINST YOU IF YOU SIGN IT, EVEN IF YOU HAVE
            NOT BEEN PAID. IF YOU HAVE NOT BEEN PAID, USE A CONDITIONAL WAIVER
            AND RELEASE FORM.
          </p>
          <p>
            This document waives and releases lien, stop payment notice, and
            payment bond rights the claimant has for labor and service provided,
            and equipment and material delivered, to the customer on this job
            through the Through Date of this document. Rights based upon labor
            or service provided, or equipment or material delivered, pursuant to
            a written change order that has been fully executed by the parties
            prior to the date that this document is signed by the claimant, are
            waived and released by this document, unless listed as an Exception
            below. The claimant has received the following progress payment:
          </p>
          <p>
            Amount of Progress Payment Received:{' '}
            <span className="underline">{formatUSD(waiver.paymentAmountCents)}</span>
          </p>
          <ExceptionsBlock waiver={waiver} />
        </div>
      );
    case 'CONDITIONAL_FINAL':
      return (
        <div className="space-y-3">
          <p className="rounded border border-gray-400 p-2 text-xs">
            <strong>NOTICE:</strong> THIS DOCUMENT WAIVES THE CLAIMANT'S LIEN,
            STOP PAYMENT NOTICE, AND PAYMENT BOND RIGHTS EFFECTIVE ON RECEIPT
            OF PAYMENT. A PERSON SHOULD NOT RELY ON THIS DOCUMENT UNLESS
            SATISFIED THAT THE CLAIMANT HAS RECEIVED PAYMENT.
          </p>
          <p>
            This document waives and releases lien, stop payment notice, and
            payment bond rights the claimant has for all labor and service
            provided, and equipment and material delivered, to the customer on
            this job. Rights based upon labor or service provided, or equipment
            or material delivered, pursuant to a written change order that has
            been fully executed by the parties prior to the date that this
            document is signed by the claimant, are waived and released by this
            document, unless listed as an Exception below. This document is
            effective only on the claimant's receipt of payment from the
            financial institution on which the following check is drawn:
          </p>
          <p>
            Maker of Check: <span className="underline">{waiver.ownerName}</span>
          </p>
          <p>
            Amount of Check: <span className="underline">{formatUSD(waiver.paymentAmountCents)}</span>
          </p>
          <p>
            Check Payable To:{' '}
            <span className="underline">{waiver.claimantName}</span>
          </p>
          <ExceptionsBlock waiver={waiver} />
        </div>
      );
    case 'UNCONDITIONAL_FINAL':
      return (
        <div className="space-y-3">
          <p className="rounded border border-gray-400 p-2 text-xs">
            <strong>NOTICE TO CLAIMANT:</strong> THIS DOCUMENT WAIVES AND
            RELEASES LIEN, STOP PAYMENT NOTICE, AND PAYMENT BOND RIGHTS
            UNCONDITIONALLY AND STATES THAT YOU HAVE BEEN PAID FOR GIVING UP
            THOSE RIGHTS. THIS DOCUMENT IS ENFORCEABLE AGAINST YOU IF YOU SIGN
            IT, EVEN IF YOU HAVE NOT BEEN PAID. IF YOU HAVE NOT BEEN PAID, USE
            A CONDITIONAL WAIVER AND RELEASE FORM.
          </p>
          <p>
            This document waives and releases lien, stop payment notice, and
            payment bond rights the claimant has for all labor and service
            provided, and equipment and material delivered, to the customer on
            this job. Rights based upon labor or service provided, or equipment
            or material delivered, pursuant to a written change order that has
            been fully executed by the parties prior to the date that this
            document is signed by the claimant, are waived and released by this
            document, unless listed as an Exception below. The claimant has
            been paid in full.
          </p>
          <ExceptionsBlock waiver={waiver} />
        </div>
      );
  }
}

function ExceptionsBlock({ waiver }: { waiver: LienWaiver }) {
  const hasDispute =
    (waiver.disputedAmountCents ?? 0) > 0 ||
    (waiver.disputedItems && waiver.disputedItems.trim().length > 0);
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold uppercase">Exceptions</div>
      <p className="mt-1 text-xs">
        This document does not affect the following:
      </p>
      <div className="mt-1 min-h-[60px] rounded border border-gray-400 p-2 text-xs">
        {hasDispute ? (
          <>
            {(waiver.disputedAmountCents ?? 0) > 0 && (
              <div>
                Disputed claim amount: {formatUSD(waiver.disputedAmountCents ?? 0)}
              </div>
            )}
            {waiver.disputedItems && (
              <div className="mt-1">{waiver.disputedItems}</div>
            )}
          </>
        ) : (
          <span className="text-gray-500">None</span>
        )}
      </div>
    </div>
  );
}
