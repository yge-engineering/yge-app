// /estimates — list every priced estimate (drafts + prices the user added).
//
// Server component: fetches the summary list at request time, no client JS
// needed for the index view.

import Link from 'next/link';
import { formatUSD } from '@yge/shared';

interface EstimateSummary {
  id: string;
  fromDraftId: string;
  jobId: string;
  createdAt: string;
  updatedAt: string;
  projectName: string;
  projectType: string;
  ownerAgency?: string;
  bidDueDate?: string;
  bidItemCount: number;
  pricedLineCount: number;
  unpricedLineCount: number;
  oppPercent: number;
  bidTotalCents: number;
  /** May be missing on summary entries written before the §4104 sub list
   *  feature shipped — treat undefined as 0 so the UI doesn't break. */
  subBidCount?: number;
  /** May be missing on summary entries written before the addendum tracking
   *  feature shipped — treat undefined as 0. */
  addendumCount?: number;
  /** Logged but un-acknowledged addenda. > 0 = bid is non-responsive. */
  unacknowledgedAddendumCount?: number;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

// Browser-facing API URL — CSV downloads are fetched directly from the
// user's browser, so they need the public URL.
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchEstimates(): Promise<EstimateSummary[]> {
  const res = await fetch(`${apiBaseUrl()}/api/priced-estimates`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { estimates: EstimateSummary[] };
  return json.estimates;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function EstimatesPage() {
  let estimates: EstimateSummary[] = [];
  let fetchError: string | null = null;
  try {
    estimates = await fetchEstimates();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link href="/drafts" className="text-sm text-yge-blue-500 hover:underline">
          Saved drafts &rarr;
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Priced estimates</h1>
      <p className="mt-2 text-gray-700">
        Estimates you&rsquo;ve started pricing. Open one to fill in unit prices, adjust the O&amp;P
        percentage, and see the running bid total. Convert any saved draft to start a new one.
      </p>

      {fetchError && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Couldn&rsquo;t load estimates from the API: {fetchError}. Make sure the API server is
          running on port 4000.
        </div>
      )}

      {!fetchError && estimates.length === 0 && (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No estimates yet. Open a saved draft on the{' '}
          <Link href="/drafts" className="text-yge-blue-500 hover:underline">
            Saved drafts page
          </Link>{' '}
          and click <em>Convert to priced estimate</em> to start one.
        </div>
      )}

      {estimates.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Lines</th>
                <th className="px-4 py-2">Subs</th>
                <th className="px-4 py-2">Addenda</th>
                <th className="px-4 py-2">Bid total</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estimates.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{e.projectName}</div>
                    {e.ownerAgency && (
                      <div className="text-xs text-gray-500">{e.ownerAgency}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {e.projectType.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {e.pricedLineCount} of {e.bidItemCount}
                    {e.unpricedLineCount > 0 && (
                      <span className="ml-2 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-800">
                        {e.unpricedLineCount} to price
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {e.subBidCount && e.subBidCount > 0 ? (
                      <span>
                        {e.subBidCount} sub{e.subBidCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="text-gray-400">none</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {e.addendumCount && e.addendumCount > 0 ? (
                      <span>
                        {e.addendumCount} addend
                        {e.addendumCount === 1 ? 'um' : 'a'}
                        {e.unacknowledgedAddendumCount &&
                        e.unacknowledgedAddendumCount > 0 ? (
                          <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
                            {e.unacknowledgedAddendumCount} un-acked
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-gray-400">none</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {e.unpricedLineCount > 0 ? (
                      <span className="text-gray-500">
                        {formatUSD(e.bidTotalCents)}{' '}
                        <span className="text-[10px] uppercase">running</span>
                      </span>
                    ) : (
                      formatUSD(e.bidTotalCents)
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {formatWhen(e.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/estimates/${e.id}`}
                      className="mr-3 text-yge-blue-500 hover:underline"
                    >
                      Open
                    </Link>
                    <Link
                      href={`/estimates/${e.id}/print`}
                      className="mr-3 text-yge-blue-500 hover:underline"
                    >
                      Print
                    </Link>
                    <Link
                      href={`/estimates/${e.id}/transmittal`}
                      className="mr-3 text-yge-blue-500 hover:underline"
                    >
                      Cover
                    </Link>
                    <Link
                      href={`/estimates/${e.id}/envelope`}
                      className="mr-3 text-yge-blue-500 hover:underline"
                    >
                      Envelope
                    </Link>
                    <a
                      href={`${publicApiBaseUrl()}/api/priced-estimates/${e.id}/export.csv`}
                      className="text-yge-blue-500 hover:underline"
                    >
                      CSV
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
