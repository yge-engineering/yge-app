// /imported-estimates/[id]/cover — printable bid cover sheet.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ImportedEstimate } from '@yge/shared';
import { Letterhead } from '@/components/letterhead';
import { PrintButton } from '@/components/print-button';

function apiBaseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchEstimate(id: string): Promise<ImportedEstimate | null> {
  const res = await fetch(`${apiBaseUrl()}/api/imported-estimates/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { importedEstimate: ImportedEstimate }).importedEstimate;
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function BidCoverPage({
  params,
}: {
  params: { id: string };
}) {
  const estimate = await fetchEstimate(params.id);
  if (!estimate) notFound();

  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="mx-auto max-w-[8.5in] p-8 print:p-0">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link
          href={`/imported-estimates/${params.id}`}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          ← Back to estimate
        </Link>
        <PrintButton label="Print / Save as PDF" />
      </div>

      <Letterhead variant="full" />

      <div className="mt-12 text-right text-sm">{today}</div>

      <div className="mt-10 text-sm">
        <div className="font-semibold">{estimate.client ?? '[Client TBD]'}</div>
        <div className="mt-1 text-gray-700">RE: {estimate.projectName}</div>
        <div className="text-gray-700">Job # {estimate.jobNumber}</div>
      </div>

      <p className="mt-8 text-sm leading-6 text-gray-900">
        Young General Engineering, Inc. is pleased to submit our bid for the
        above-referenced project. Our base bid includes all labor, materials,
        equipment, supervision, and overhead required to complete the scope of
        work as set forth in the bid documents.
      </p>

      <table className="mt-10 ml-auto text-base">
        <tbody>
          <tr>
            <td className="pr-6 font-semibold text-gray-700">Direct cost:</td>
            <td className="text-right font-mono">
              {fmtMoney(estimate.directCostCents)}
            </td>
          </tr>
          <tr>
            <td className="pr-6 font-semibold text-gray-700">
              O&amp;P markup ({Math.round(estimate.oppPercent * 100)}%):
            </td>
            <td className="text-right font-mono text-amber-700">
              {fmtMoney(estimate.oppMarkupCents)}
            </td>
          </tr>
          <tr className="border-t-2 border-gray-300 text-lg font-bold">
            <td className="pr-6 pt-2 text-yge-blue-900">Total bid price:</td>
            <td className="pt-2 text-right font-mono text-yge-blue-900">
              {fmtMoney(estimate.bidPriceCents)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-8 text-sm leading-6 text-gray-900">
        This bid is valid for sixty (60) days from the date above. Should you
        have any questions or require clarification on any portion of our
        submission, please contact Ryan D. Young, Vice President, at (707)
        599-9921 or ryoung@youngge.com.
      </p>

      <p className="mt-3 text-sm leading-6 text-gray-900">
        We appreciate the opportunity to bid on this project and look forward
        to a favorable response.
      </p>

      <div className="mt-16">
        <p className="text-sm">Sincerely,</p>
        <div className="mt-12 border-t border-gray-700 pt-1 text-sm">
          <div className="font-semibold">Ryan D. Young</div>
          <div className="text-gray-700">Vice President</div>
          <div className="text-gray-700">Young General Engineering, Inc.</div>
        </div>
      </div>

      <p className="mt-10 text-[10px] text-gray-500">
        Young General Engineering, Inc. · CSLB 1145219 · DIR 2000018967
      </p>
    </main>
  );
}
