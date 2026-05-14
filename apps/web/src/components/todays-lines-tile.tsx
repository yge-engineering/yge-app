// Dashboard tile: every DailyReport line logged today.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Line {
  reportId: string;
  jobId: string;
  jobNumber: string;
  jobName: string;
  category: string | null;
  costCode: string | null;
  description: string | null;
  qtyHrs: number | null;
  unit: string | null;
  totalCostCents: number | null;
  employeeVendor: string | null;
}

export function TodaysLinesTile() {
  const [lines, setLines] = useState<Line[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/imported-daily-reports/today`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { lines: [] }))
      .then((j: { lines?: Line[] }) => setLines(j.lines ?? []));
  }, []);

  const total = (lines ?? []).reduce((s, l) => s + (l.totalCostCents ?? 0), 0);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Today&rsquo;s cost lines
        </h2>
        <span className="text-xs text-gray-500">
          {lines === null ? 'Loading…' : `${lines.length} line${lines.length === 1 ? '' : 's'} · `}
          {lines !== null && <Money cents={total} />}
        </span>
      </div>
      {lines === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing logged yet today. Use{' '}
          <span className="font-mono">Quick-log a cost line</span> on any
          job&rsquo;s page to add entries.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1">Job</th>
                <th className="py-1">Category</th>
                <th className="py-1">Code</th>
                <th className="py-1">Description</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">$</th>
              </tr>
            </thead>
            <tbody>
              {lines.slice(0, 20).map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-1">
                    <Link
                      href={`/jobs/${l.jobId}`}
                      className="text-xs text-yge-blue-700 hover:underline"
                    >
                      {l.jobNumber}
                    </Link>
                  </td>
                  <td className="py-1 text-xs text-gray-600">{l.category ?? ''}</td>
                  <td className="py-1 font-mono text-[11px]">{l.costCode ?? ''}</td>
                  <td className="py-1 text-xs">{l.description ?? ''}</td>
                  <td className="py-1 text-right font-mono text-xs">
                    {l.qtyHrs ?? ''}
                    {l.unit ? ` ${l.unit}` : ''}
                  </td>
                  <td className="py-1 text-right font-mono text-xs">
                    {l.totalCostCents ? <Money cents={l.totalCostCents} /> : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lines.length > 20 && (
            <p className="mt-2 text-[11px] text-gray-500">
              Showing the most recent 20 of {lines.length} lines.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
