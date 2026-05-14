// /imported-estimates/[id]/print — print-ready estimate.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ImportedEstimate } from '@yge/shared';
import { Letterhead } from '@/components/letterhead';
import { PrintButton } from '@/components/print-button';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEstimate(id: string): Promise<ImportedEstimate | null> {
  const res = await fetch(
    `${apiBaseUrl()}/api/imported-estimates/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
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

interface Group {
  sectionName: string;
  lines: ImportedEstimate['lines'];
  subtotal: number;
}

function groupBySection(lines: ImportedEstimate['lines']): Group[] {
  const out: Group[] = [];
  let current: Group | null = null;
  for (const ln of lines) {
    const section = ln.sectionName ?? '(Uncategorized)';
    if (!current || current.sectionName !== section) {
      current = { sectionName: section, lines: [], subtotal: 0 };
      out.push(current);
    }
    current.lines.push(ln);
    current.subtotal += ln.bidPriceCents;
  }
  return out;
}

export default async function PrintImportedEstimatePage({
  params,
}: {
  params: { id: string };
}) {
  const estimate = await fetchEstimate(params.id);
  if (!estimate) notFound();

  const sections = groupBySection(estimate.lines);

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

      <div className="mt-6 mb-4 border-b border-gray-200 pb-2">
        <h1 className="text-xl font-bold text-gray-900">
          Estimate — {estimate.projectName}
        </h1>
        <p className="text-sm text-gray-700">
          Job {estimate.jobNumber}
          {estimate.client ? ` · ${estimate.client}` : ''} · Rate type{' '}
          {estimate.rateType} · O&amp;P{' '}
          {Math.round(estimate.oppPercent * 100)}%
        </p>
      </div>

      {sections.map((sec) => (
        <section key={sec.sectionName} className="mb-4 break-inside-avoid">
          <h2 className="mb-1 border-b border-gray-300 pb-0.5 text-sm font-bold uppercase tracking-wide text-gray-900">
            {sec.sectionName}
          </h2>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-1">Cost code</th>
                <th className="py-1">Description</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1">Unit</th>
                <th className="py-1 text-right">Unit cost</th>
                <th className="py-1 text-right">Total</th>
                <th className="py-1 text-right">O&amp;P</th>
                <th className="py-1 text-right">Bid</th>
              </tr>
            </thead>
            <tbody>
              {sec.lines.map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-0.5 font-mono text-[10px]">{l.costCode ?? ''}</td>
                  <td className="py-0.5">{l.description}</td>
                  <td className="py-0.5 text-right font-mono">{l.quantity || ''}</td>
                  <td className="py-0.5">{l.unit ?? ''}</td>
                  <td className="py-0.5 text-right font-mono">
                    {l.unitCostCents ? fmtMoney(l.unitCostCents) : ''}
                  </td>
                  <td className="py-0.5 text-right font-mono">{fmtMoney(l.totalCostCents)}</td>
                  <td className="py-0.5 text-right font-mono text-amber-700">
                    {fmtMoney(l.oppMarkupCents)}
                  </td>
                  <td className="py-0.5 text-right font-mono font-semibold text-green-700">
                    {fmtMoney(l.bidPriceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-300 font-semibold">
                <td className="py-1" colSpan={7}>
                  Section subtotal — {sec.sectionName}
                </td>
                <td className="py-1 text-right font-mono text-green-700">
                  {fmtMoney(sec.subtotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      ))}

      <div className="mt-6 break-inside-avoid border-t-2 border-gray-300 pt-3">
        <table className="ml-auto text-sm">
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
            <tr className="border-t-2 border-gray-300 text-base font-bold">
              <td className="pr-6 pt-2 text-yge-blue-900">Bid price:</td>
              <td className="pt-2 text-right font-mono text-yge-blue-900">
                {fmtMoney(estimate.bidPriceCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {estimate.notes && (
        <div className="mt-6 break-inside-avoid">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-900">
            Notes
          </h3>
          <p className="whitespace-pre-wrap text-xs text-gray-700">{estimate.notes}</p>
        </div>
      )}

      <p className="mt-8 text-[10px] text-gray-500">
        Generated {new Date().toLocaleString()} · Young General Engineering, Inc.
        · CSLB 1145219 · DIR 2000018967
      </p>
    </main>
  );
}
