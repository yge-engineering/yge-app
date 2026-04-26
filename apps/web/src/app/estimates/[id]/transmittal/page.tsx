// /estimates/[id]/transmittal — print-ready bid transmittal / cover letter.
//
// Goes on the OUTSIDE of the bid envelope. Names the project, lists what's
// enclosed, and is signed by an officer of YGE. The agency clerk reads the
// transmittal first; if they can't tell at a glance whose envelope they're
// holding, the bid still gets opened, but missing items in the package may
// not get flagged until they cause a rejection.
//
// Single-page layout designed for "Print to PDF" or paper output.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  YGE_COMPANY_INFO,
  buildTransmittal,
  computeEstimateTotals,
  type PricedEstimate,
  type PricedEstimateTotals,
} from '@yge/shared';
import { PrintButton } from '@/components/print-button';
import { Letterhead } from '@/components/letterhead';

// Whom to print as the signer at the bottom of the cover letter.
// `vp` (Ryan) is the default — matches the existing buildTransmittal default
// and is the officer who runs estimating day-to-day. `president` (Brook)
// is offered for bids that for political/relationship reasons should go
// out under the President's name.
type SignerKey = 'vp' | 'president';
function pickSigner(key: SignerKey | string | undefined) {
  return key === 'president'
    ? YGE_COMPANY_INFO.president
    : YGE_COMPANY_INFO.vicePresident;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface FullResponse {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}

async function fetchEstimate(id: string): Promise<FullResponse | null> {
  const res = await fetch(`${apiBaseUrl()}/api/priced-estimates/${id}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return (await res.json()) as FullResponse;
}

export default async function TransmittalPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { signer?: string };
}) {
  const data = await fetchEstimate(params.id);
  if (!data) notFound();
  const { estimate } = data;
  const totals = computeEstimateTotals(estimate);

  const signerKey: SignerKey =
    searchParams.signer === 'president' ? 'president' : 'vp';
  const signer = pickSigner(signerKey);

  // Build the structured letter once, on the server. The presentation below
  // is just spread + render — no logic.
  const letter = buildTransmittal(estimate, totals, { signer });

  return (
    <>
      <style>{`
        @page { margin: 0.75in 0.75in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .signature-block { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      <div className="no-print bg-gray-100 px-8 py-3 text-sm text-gray-700">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link
              href={`/estimates/${estimate.id}`}
              className="text-yge-blue-500 hover:underline"
            >
              &larr; Back to editor
            </Link>
            <Link
              href={`/estimates/${estimate.id}/print`}
              className="text-yge-blue-500 hover:underline"
            >
              Bid summary
            </Link>
            <Link
              href={`/estimates/${estimate.id}/envelope`}
              className="text-yge-blue-500 hover:underline"
            >
              Envelope checklist
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Signer:
            </span>
            <Link
              href={`/estimates/${estimate.id}/transmittal?signer=vp`}
              className={`rounded px-2 py-1 text-xs font-medium ${
                signerKey === 'vp'
                  ? 'bg-yge-blue-500 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {YGE_COMPANY_INFO.vicePresident.name.split(' ')[0]} &mdash; VP
            </Link>
            <Link
              href={`/estimates/${estimate.id}/transmittal?signer=president`}
              className={`rounded px-2 py-1 text-xs font-medium ${
                signerKey === 'president'
                  ? 'bg-yge-blue-500 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {YGE_COMPANY_INFO.president.name.split(' ')[0]} &mdash; President
            </Link>
            <PrintButton />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl bg-white px-12 py-10 text-gray-900">
        {/* ------- Letterhead ------- */}
        <Letterhead
          rightBlock={
            <>
              {letter.companyHeader.addressLine}
              <br />
              <br />
              CSLB #{letter.companyHeader.cslbLicense}
              <br />
              DIR #{letter.companyHeader.dirNumber}
              <br />
              {letter.companyHeader.phone}
              <br />
              {letter.companyHeader.email}
            </>
          }
        />

        {/* ------- Date ------- */}
        <p className="mt-8 text-sm text-gray-700">{letter.date}</p>

        {/* ------- Addressee ------- */}
        <section className="mt-6">
          <p className="font-semibold text-gray-900">{letter.addressee.agency}</p>
          {letter.addressee.attention && (
            <p className="text-gray-700">{letter.addressee.attention}</p>
          )}
          {letter.addressee.addressLines.map((line, i) => (
            <p key={i} className="text-gray-700">
              {line}
            </p>
          ))}
        </section>

        {/* ------- Subject line ------- */}
        <p className="mt-6 font-semibold text-gray-900">{letter.subjectLine}</p>

        {/* ------- Salutation ------- */}
        <p className="mt-6 text-gray-900">{letter.salutation}</p>

        {/* ------- Body paragraphs ------- */}
        <div className="mt-4 space-y-4 text-gray-900">
          {letter.bodyParagraphs.map((p, i) => (
            <p key={i} className="leading-relaxed">
              {p}
            </p>
          ))}
        </div>

        {/* ------- Enclosures list ------- */}
        <section className="mt-6">
          <ul className="list-inside list-disc space-y-1 text-gray-900">
            {letter.enclosures.map((enc, i) => (
              <li key={i}>
                <span className="font-medium">{enc.label}</span>
                {enc.detail && (
                  <span className="text-gray-700"> &mdash; {enc.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* ------- Closing + signature ------- */}
        <section className="signature-block mt-12">
          <p className="text-gray-900">{letter.closing.line}</p>
          <div className="mt-16 border-t border-gray-400 pt-2">
            <p className="font-semibold text-gray-900">
              {letter.closing.signer.name}
            </p>
            <p className="text-sm text-gray-700">{letter.closing.signer.title}</p>
            <p className="text-sm text-gray-700">{letter.closing.signer.company}</p>
            <p className="text-sm text-gray-700">
              {letter.closing.signer.phone} &middot; {letter.closing.signer.email}
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
