// /estimates/[id]/envelope — print-ready bid envelope checklist.
//
// Last-mile manifest the estimator ticks off as they physically stuff the
// bid envelope. Required items render with a checkbox; un-acknowledged
// addenda or missing bid security render in red so the estimator catches
// them before the envelope is sealed.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  YGE_COMPANY_INFO,
  buildEnvelopeChecklist,
  computeEstimateTotals,
  type PricedEstimate,
  type PricedEstimateTotals,
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

export default async function EnvelopeChecklistPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await fetchEstimate(params.id);
  if (!data) notFound();
  const { estimate } = data;
  const totals = computeEstimateTotals(estimate);
  const checklist = buildEnvelopeChecklist(estimate, totals);

  return (
    <>
      <style>{`
        @page { margin: 0.6in 0.75in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .row { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      <div className="no-print bg-gray-100 px-8 py-3 text-sm text-gray-700">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
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
              href={`/estimates/${estimate.id}/transmittal`}
              className="text-yge-blue-500 hover:underline"
            >
              Cover letter
            </Link>
          </div>
          <PrintButton />
        </div>
      </div>

      <main className="mx-auto max-w-3xl bg-white px-10 py-8 text-gray-900">
        {/* ------- Header ------- */}
        <header className="border-b-2 border-yge-blue-500 pb-4">
          <p className="text-xs uppercase tracking-widest text-gray-500">
            {YGE_COMPANY_INFO.legalName}
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            Bid envelope checklist
          </h1>
          <p className="mt-1 text-sm text-gray-700">
            {estimate.projectName}
            {estimate.ownerAgency ? ` \u2014 ${estimate.ownerAgency}` : ''}
          </p>
          {estimate.bidDueDate && (
            <p className="text-sm text-gray-700">
              Bid due: <span className="font-semibold">{estimate.bidDueDate}</span>
            </p>
          )}
        </header>

        {/* ------- Status banner ------- */}
        {checklist.allRequiredAccountedFor ? (
          <div className="mt-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
            All required items are accounted for. Walk down the list as you
            stuff the envelope &mdash; tick each box once it&rsquo;s in.
          </div>
        ) : (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            One or more required items are missing or unresolved. Fix the
            flagged rows before sealing the envelope.
          </div>
        )}

        {/* ------- Required items ------- */}
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Required for a responsive bid
          </h2>
          <ul className="mt-2 divide-y divide-gray-200 border-y border-gray-200">
            {checklist.items
              .filter((i) => i.severity === 'required')
              .map((item) => (
                <li
                  key={item.id}
                  className={`row flex items-start gap-3 py-3 ${item.warn ? 'bg-red-50' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-block h-5 w-5 flex-shrink-0 rounded border-2 ${
                      item.warn ? 'border-red-500' : 'border-gray-700'
                    }`}
                  />
                  <div className="flex-1">
                    <div
                      className={`font-semibold ${item.warn ? 'text-red-800' : 'text-gray-900'}`}
                    >
                      {item.label}
                    </div>
                    {item.detail && (
                      <div
                        className={`text-sm ${item.warn ? 'text-red-700' : 'text-gray-600'}`}
                      >
                        {item.detail}
                      </div>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </section>

        {/* ------- Recommended items ------- */}
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Recommended
          </h2>
          <ul className="mt-2 divide-y divide-gray-200 border-y border-gray-200">
            {checklist.items
              .filter((i) => i.severity === 'recommended')
              .map((item) => (
                <li
                  key={item.id}
                  className="row flex items-start gap-3 py-3"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-block h-5 w-5 flex-shrink-0 rounded border-2 border-gray-400"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {item.label}
                    </div>
                    {item.detail && (
                      <div className="text-sm text-gray-600">{item.detail}</div>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </section>

        {/* ------- Sign-off ------- */}
        <section className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="border-t border-gray-400 pt-1 text-gray-700">
              Assembled by
            </p>
          </div>
          <div>
            <p className="border-t border-gray-400 pt-1 text-gray-700">
              Date / time
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
