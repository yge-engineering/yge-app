// /estimates/[id]/sub-list — print-ready CA Public Contract Code §4104
// subcontractor list. Goes in the bid envelope; required-but-missing
// items (CSLB / DIR) print in red so the estimator catches them
// before sealing.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  classifySubBids,
  computeEstimateTotals,
  formatUSD,
  isHighwayClassProjectType,
  pcc4104ThresholdCents,
  type PricedEstimate,
  type PricedEstimateTotals,
  type SubBid,
} from '@yge/shared';
import { PrintButton } from '@/components/print-button';
import { Letterhead } from '@/components/letterhead';

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

export default async function SubListPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await fetchEstimate(params.id);
  if (!data) notFound();
  const { estimate } = data;
  const totals = computeEstimateTotals(estimate);
  const classification = classifySubBids(
    estimate.subBids,
    totals.bidTotalCents,
    estimate.projectType,
  );
  const thresholdCents = pcc4104ThresholdCents(totals.bidTotalCents, estimate.projectType);
  const isHighway = isHighwayClassProjectType(estimate.projectType);

  // Print rows = mustList + borderline (estimator's call). Optional are
  // shown separately as a reference.
  const printRows = [...classification.mustList, ...classification.borderline].sort(
    (a, b) => b.bidAmountCents - a.bidAmountCents,
  );

  const totalListedCents = printRows.reduce((acc, s) => acc + s.bidAmountCents, 0);

  return (
    <main className="mx-auto max-w-3xl p-8 text-black">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/estimates/${estimate.id}`}
          className="text-sm text-yge-blue-500 hover:underline"
        >
          &larr; Back to estimate
        </Link>
        <PrintButton />
      </div>

      <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
        <Letterhead />

        <header className="mb-4 mt-4 border-b-2 border-black pb-2">
          <div className="text-xs uppercase tracking-wide">
            CA Public Contract Code §4104 Subcontractor List
          </div>
          <h1 className="text-xl font-bold">{estimate.projectName}</h1>
          {estimate.ownerAgency && (
            <p className="text-sm">{estimate.ownerAgency}</p>
          )}
          <p className="text-xs text-gray-600">
            Bid total: {formatUSD(totals.bidTotalCents)} ·{' '}
            {isHighway ? 'Streets/highways/bridges' : 'Standard public works'} ·
            Listing threshold: {formatUSD(thresholdCents)}
            {isHighway && ' ($10,000 statutory floor)'}
          </p>
        </header>

        {printRows.length === 0 ? (
          <div className="rounded border border-yellow-400 bg-yellow-50 p-3 text-sm">
            <strong>No subs listed.</strong> Either the bid is fully self-performed
            or no sub bid exceeds the §4104 threshold of {formatUSD(thresholdCents)}.
            CA PCC §4106 requires the bidder to declare self-performance for any
            scope &gt; threshold not listed here — the bid envelope checklist
            covers that affirmation.
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="px-1 py-1 text-left">#</th>
                <th className="px-1 py-1 text-left">Subcontractor (DBA / Legal)</th>
                <th className="px-1 py-1 text-left">Address</th>
                <th className="px-1 py-1 text-left">CSLB #</th>
                <th className="px-1 py-1 text-left">DIR #</th>
                <th className="px-1 py-1 text-left">Portion of Work</th>
                <th className="px-1 py-1 text-right">Bid Amount</th>
              </tr>
            </thead>
            <tbody>
              {printRows.map((s, i) => (
                <SubRow key={s.id} idx={i + 1} sub={s} />
              ))}
              <tr className="border-t-2 border-black font-semibold">
                <td className="px-1 py-2" colSpan={6}>
                  Total listed
                </td>
                <td className="px-1 py-2 text-right font-mono">
                  {formatUSD(totalListedCents)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {classification.borderline.length > 0 && (
          <div className="mt-4 rounded border border-yellow-400 bg-yellow-50 p-2 text-xs print:bg-white">
            <strong>Borderline subs ({classification.borderline.length}):</strong>{' '}
            One or more subs sit within $1,000 of the §4104 threshold. Listed by
            default — confirm with the estimator before sealing.
          </div>
        )}

        {classification.optional.length > 0 && (
          <section className="mt-6 print:hidden">
            <h2 className="text-xs font-semibold uppercase text-gray-500">
              Below threshold (not printed)
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              These subs fall under the §4104 threshold and don't have to be
              listed on the bid form. Kept here for the estimator's reference.
            </p>
            <ul className="mt-2 list-disc pl-5 text-xs text-gray-700">
              {classification.optional.map((s) => (
                <li key={s.id}>
                  {s.contractorName} — {s.portionOfWork} ·{' '}
                  {formatUSD(s.bidAmountCents)}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-6 text-[10px] italic text-gray-600">
          Submitted under penalty of perjury per CA Public Contract Code §4104.
          Failure to list a sub doing &gt; {formatUSD(thresholdCents)} (or
          {' '}{isHighway ? '$10,000 highway floor' : '0.5% of bid'}) renders the
          bid non-responsive. A sub not listed cannot perform the listed scope
          without the agency's written substitution under §4107.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase">
              Authorized signature (YGE)
            </div>
            <div className="mt-6 border-b border-gray-400" />
            <div className="mt-1 text-xs">Ryan D. Young, Vice President</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase">Date</div>
            <div className="mt-6 border-b border-gray-400">&nbsp;</div>
          </div>
        </div>
      </article>
    </main>
  );
}

function SubRow({ idx, sub }: { idx: number; sub: SubBid }) {
  const missingCslb = !sub.cslbLicense || sub.cslbLicense.trim().length === 0;
  const missingDir = !sub.dirRegistration || sub.dirRegistration.trim().length === 0;
  return (
    <tr className="border-b border-gray-300 align-top">
      <td className="px-1 py-1.5">{idx}</td>
      <td className="px-1 py-1.5">{sub.contractorName}</td>
      <td className="px-1 py-1.5">{sub.address ?? '—'}</td>
      <td className={`px-1 py-1.5 ${missingCslb ? 'font-bold text-red-700' : ''}`}>
        {sub.cslbLicense ?? 'MISSING'}
      </td>
      <td className={`px-1 py-1.5 ${missingDir ? 'font-bold text-red-700' : ''}`}>
        {sub.dirRegistration ?? 'MISSING'}
      </td>
      <td className="px-1 py-1.5">{sub.portionOfWork}</td>
      <td className="px-1 py-1.5 text-right font-mono">
        {formatUSD(sub.bidAmountCents)}
      </td>
    </tr>
  );
}
