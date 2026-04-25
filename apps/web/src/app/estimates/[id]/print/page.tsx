// /estimates/[id]/print — printable bid summary.
//
// Single-page layout designed for "Print to PDF" or paper output. The print
// CSS at the bottom hides browser nav, sets margins, and prevents the
// totals block from splitting across pages.
//
// Brand kit (logo + final letterhead) lands later; for now we render a
// placeholder block at the top with company info from CLAUDE.md so the
// layout is correct and only the visual assets need to swap in.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  YGE_COMPANY_INFO,
  centsToDollars,
  classifySubBids,
  computeEstimateTotals,
  formatUSD,
  lineExtendedCents,
  type PricedEstimate,
  type PricedEstimateTotals,
  type SubBid,
} from '@yge/shared';
import { PrintButton } from '@/components/print-button';

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function PrintBidPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await fetchEstimate(params.id);
  if (!data) notFound();
  const { estimate } = data;
  const totals = computeEstimateTotals(estimate);

  // PCC §4104 sub list. We print every sub the user has captured, regardless
  // of bucket — leaving a sub off the printed bid form is what makes the
  // bid non-responsive. Optional/borderline rows still go on the form;
  // the bucket only changes whether they're legally required.
  const subClassification = classifySubBids(
    estimate.subBids,
    totals.bidTotalCents,
    estimate.projectType,
  );

  return (
    <>
      {/* Print-only stylesheet. Tailwind's `print:` variants would do most
          of this, but a single inline block is easier to scan. */}
      <style>{`
        @page { margin: 0.6in 0.5in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .totals-block { break-inside: avoid; page-break-inside: avoid; }
        .bid-item-row { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      <div className="no-print bg-gray-100 px-8 py-3 text-sm text-gray-700">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href={`/estimates/${estimate.id}`}
            className="text-yge-blue-500 hover:underline"
          >
            &larr; Back to editor
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {totals.unpricedLineCount > 0
                ? `Heads up: ${totals.unpricedLineCount} line${totals.unpricedLineCount === 1 ? '' : 's'} still unpriced.`
                : 'All lines priced.'}
            </span>
            <PrintButton />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl bg-white px-10 py-8 text-gray-900">
        {/* ------- Letterhead ------- */}
        <header className="border-b-2 border-yge-blue-500 pb-4">
          <div className="flex items-start justify-between gap-6">
            <div>
              {/* Logo placeholder — drops in when brand kit lands. */}
              <div className="mb-2 inline-block rounded border border-dashed border-gray-300 px-3 py-1 text-[10px] uppercase tracking-wide text-gray-400">
                YGE logo
              </div>
              <h1 className="text-2xl font-bold text-yge-blue-700">
                {YGE_COMPANY_INFO.legalName}
              </h1>
              <p className="text-sm text-gray-600">{YGE_COMPANY_INFO.tagline}</p>
            </div>
            <address className="text-right text-xs not-italic text-gray-700">
              {YGE_COMPANY_INFO.address.street}
              <br />
              {YGE_COMPANY_INFO.address.city}, {YGE_COMPANY_INFO.address.state}{' '}
              {YGE_COMPANY_INFO.address.zip}
              <br />
              <br />
              CSLB #{YGE_COMPANY_INFO.cslbLicense}
              <br />
              DIR #{YGE_COMPANY_INFO.dirNumber}
              <br />
              DOT #{YGE_COMPANY_INFO.dotNumber}
            </address>
          </div>
        </header>

        {/* ------- Bid title ------- */}
        <section className="mt-6">
          <p className="text-xs uppercase tracking-widest text-gray-500">
            Bid proposal
          </p>
          <h2 className="mt-1 text-xl font-bold">{estimate.projectName}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {estimate.ownerAgency && (
              <>
                <dt className="font-semibold text-gray-700">Owner / agency</dt>
                <dd className="text-gray-900">{estimate.ownerAgency}</dd>
              </>
            )}
            {estimate.location && (
              <>
                <dt className="font-semibold text-gray-700">Location</dt>
                <dd className="text-gray-900">{estimate.location}</dd>
              </>
            )}
            <dt className="font-semibold text-gray-700">Project type</dt>
            <dd className="text-gray-900">
              {estimate.projectType.replace(/_/g, ' ').toLowerCase()}
            </dd>
            {estimate.bidDueDate && (
              <>
                <dt className="font-semibold text-gray-700">Bid due</dt>
                <dd className="text-gray-900">{estimate.bidDueDate}</dd>
              </>
            )}
            <dt className="font-semibold text-gray-700">Prepared</dt>
            <dd className="text-gray-900">{formatDate(estimate.updatedAt)}</dd>
          </dl>
        </section>

        {/* ------- Bid items ------- */}
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-700">
            Schedule of bid items
          </h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y-2 border-gray-700 bg-gray-50">
                <th className="px-2 py-2 text-left font-semibold">Item #</th>
                <th className="px-2 py-2 text-left font-semibold">Description</th>
                <th className="px-2 py-2 text-right font-semibold">Qty</th>
                <th className="px-2 py-2 text-left font-semibold">Unit</th>
                <th className="px-2 py-2 text-right font-semibold">Unit price</th>
                <th className="px-2 py-2 text-right font-semibold">Extended</th>
              </tr>
            </thead>
            <tbody>
              {estimate.bidItems.map((item, i) => (
                <tr key={i} className="bid-item-row border-b border-gray-200">
                  <td className="px-2 py-2 align-top text-gray-700">
                    {item.itemNumber}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div>{item.description}</div>
                    {item.notes && (
                      <div className="text-xs italic text-gray-500">{item.notes}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right align-top font-mono text-gray-700">
                    {item.quantity.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 align-top text-gray-700">{item.unit}</td>
                  <td className="px-2 py-2 text-right align-top font-mono">
                    {item.unitPriceCents == null
                      ? '—'
                      : `$${centsToDollars(item.unitPriceCents).toFixed(2)}`}
                  </td>
                  <td className="px-2 py-2 text-right align-top font-mono">
                    {item.unitPriceCents == null ? '—' : formatUSD(lineExtendedCents(item))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ------- Totals ------- */}
        <section className="totals-block mt-4 flex justify-end">
          <table className="w-72 border-collapse text-sm">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="px-2 py-2 text-left text-gray-700">Direct cost</td>
                <td className="px-2 py-2 text-right font-mono">
                  {formatUSD(totals.directCents)}
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="px-2 py-2 text-left text-gray-700">
                  Overhead &amp; profit ({(estimate.oppPercent * 100).toFixed(1)}%)
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  {formatUSD(totals.oppCents)}
                </td>
              </tr>
              <tr className="border-y-2 border-gray-700 bg-gray-50">
                <td className="px-2 py-2 text-left font-bold">Bid total</td>
                <td className="px-2 py-2 text-right font-mono font-bold">
                  {formatUSD(totals.bidTotalCents)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ------- Subcontractor list (PCC §4104) ------- */}
        {estimate.subBids.length > 0 && (
          <section className="totals-block mt-8">
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-700">
              Designated subcontractors
            </h3>
            <p className="mb-2 text-[10px] text-gray-600">
              Per California Public Contract Code §4104, the subcontractors
              below will perform a portion of the work. Threshold for
              required listing on this bid:{' '}
              <span className="font-mono">
                {formatUSD(subClassification.thresholdCents)}
              </span>
              {subClassification.highwayFloor && (
                <> (highway/streets/bridges $10,000 floor)</>
              )}
              .
            </p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-y-2 border-gray-700 bg-gray-50">
                  <th className="px-2 py-1 text-left font-semibold">
                    Subcontractor / address
                  </th>
                  <th className="px-2 py-1 text-left font-semibold">CSLB #</th>
                  <th className="px-2 py-1 text-left font-semibold">DIR #</th>
                  <th className="px-2 py-1 text-left font-semibold">
                    Portion of work
                  </th>
                  <th className="px-2 py-1 text-right font-semibold">
                    Bid amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {estimate.subBids.map((sub) => (
                  <SubBidPrintRow key={sub.id} sub={sub} />
                ))}
              </tbody>
            </table>
            {subClassification.mustList.length > 0 && (
              <p className="mt-2 text-[10px] text-gray-700">
                {subClassification.mustList.length} of the listed
                subcontractor{subClassification.mustList.length === 1 ? '' : 's'}{' '}
                exceed{subClassification.mustList.length === 1 ? 's' : ''} the
                §4104 listing threshold.
              </p>
            )}
          </section>
        )}

        {/* ------- Signature ------- */}
        <section className="totals-block mt-12 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-b border-gray-700 pb-1 font-mono">&nbsp;</div>
            <p className="mt-1 text-xs text-gray-700">
              Authorized signature
            </p>
          </div>
          <div>
            <div className="border-b border-gray-700 pb-1 font-mono">&nbsp;</div>
            <p className="mt-1 text-xs text-gray-700">Date</p>
          </div>
          <div className="col-span-2 mt-2 text-xs text-gray-600">
            Submitted by {YGE_COMPANY_INFO.legalName}, a California corporation, in good faith
            on the date above. License #{YGE_COMPANY_INFO.cslbLicense}. This bid is valid for{' '}
            {YGE_COMPANY_INFO.bidValidityDays} days from the date shown unless a different
            validity period is specified by the owner.
          </div>
        </section>

        {totals.unpricedLineCount > 0 && (
          <p className="no-print mt-6 rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
            <strong>Heads up:</strong> {totals.unpricedLineCount} line
            {totals.unpricedLineCount === 1 ? '' : 's'} still need a unit price. Print preview will
            show those rows with em-dashes — finish pricing before sending out.
          </p>
        )}
      </main>
    </>
  );
}

// ---- Subcomponents -------------------------------------------------------

function SubBidPrintRow({ sub }: { sub: SubBid }) {
  return (
    <tr className="bid-item-row border-b border-gray-200 align-top">
      <td className="px-2 py-1.5">
        <div className="font-semibold text-gray-900">{sub.contractorName}</div>
        {sub.address && (
          <div className="text-[10px] text-gray-600">{sub.address}</div>
        )}
      </td>
      <td className="px-2 py-1.5 font-mono text-[11px] text-gray-700">
        {sub.cslbLicense || '—'}
      </td>
      <td className="px-2 py-1.5 font-mono text-[11px] text-gray-700">
        {sub.dirRegistration || '—'}
      </td>
      <td className="px-2 py-1.5 text-gray-800">{sub.portionOfWork}</td>
      <td className="px-2 py-1.5 text-right font-mono text-gray-900">
        ${centsToDollars(sub.bidAmountCents).toFixed(2)}
      </td>
    </tr>
  );
}
