// /estimates/[id]/addenda — print-ready addendum acknowledgment slip.
// Goes in the bid envelope alongside the §4104 sub list. Un-acknowledged
// addenda print in red so the estimator catches them before sealing.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  allAddendaAcknowledged,
  sortedAddenda,
  unacknowledgedAddenda,
  type PricedEstimate,
  type PricedEstimateTotals,
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

export default async function AddendaPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await fetchEstimate(params.id);
  if (!data) notFound();
  const { estimate } = data;

  const addenda = sortedAddenda(estimate.addenda);
  const allAcked = allAddendaAcknowledged(addenda);
  const missing = unacknowledgedAddenda(addenda);

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
            Addendum Acknowledgment
          </div>
          <h1 className="text-xl font-bold">{estimate.projectName}</h1>
          {estimate.ownerAgency && (
            <p className="text-sm">{estimate.ownerAgency}</p>
          )}
        </header>

        {addenda.length === 0 ? (
          <div className="rounded border border-yellow-400 bg-yellow-50 p-3 text-sm">
            <strong>No addenda logged.</strong> Confirm with the agency that no
            addenda were issued for this RFP. If any were, log them on the
            estimate before printing this slip.
          </div>
        ) : (
          <>
            <div
              className={`mb-4 rounded border p-3 ${
                allAcked
                  ? 'border-green-400 bg-green-50'
                  : 'border-red-400 bg-red-50'
              }`}
            >
              <div className="text-xs uppercase tracking-wide">Status</div>
              <div className="text-base font-bold">
                {allAcked
                  ? `\u2713 All ${addenda.length} addenda acknowledged`
                  : `\u2717 ${missing.length} addend${missing.length === 1 ? 'um' : 'a'} not yet acknowledged — bid is NON-RESPONSIVE`}
              </div>
              {!allAcked && (
                <div className="mt-1 text-xs">
                  Missing acknowledgment renders the bid non-responsive on its own.
                  Cannot submit until every row below is acknowledged.
                </div>
              )}
            </div>

            <p className="mb-3 text-xs">
              The undersigned hereby acknowledges receipt of, and incorporation
              into the bid, each of the following addenda issued for the
              above-referenced project:
            </p>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="px-1 py-1 text-left">Addendum #</th>
                  <th className="px-1 py-1 text-left">Date issued</th>
                  <th className="px-1 py-1 text-left">Subject</th>
                  <th className="px-1 py-1 text-center">Ack'd?</th>
                  <th className="px-1 py-1 text-center">Initials</th>
                </tr>
              </thead>
              <tbody>
                {addenda.map((a) => (
                  <tr key={a.id} className="border-b border-gray-300 align-top">
                    <td
                      className={`px-1 py-2 font-semibold ${
                        a.acknowledged ? '' : 'text-red-700'
                      }`}
                    >
                      {a.number}
                    </td>
                    <td className="px-1 py-2">{a.dateIssued ?? '—'}</td>
                    <td className="px-1 py-2">{a.subject ?? '—'}</td>
                    <td
                      className={`px-1 py-2 text-center ${
                        a.acknowledged
                          ? 'text-green-700'
                          : 'font-bold text-red-700'
                      }`}
                    >
                      {a.acknowledged ? 'YES' : 'NO'}
                    </td>
                    <td className="px-1 py-2 text-center">
                      <span className="inline-block min-w-[3rem] border-b border-gray-400">
                        &nbsp;
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <p className="mt-6 text-[10px] italic text-gray-600">
          Submitted under penalty of perjury. CA bid forms require explicit
          acknowledgment of every addendum the agency issues. Failure to
          acknowledge any single addendum renders the bid non-responsive even
          if the addendum's substance was otherwise incorporated.
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
