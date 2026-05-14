'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  id: string;
  jobId: string;
  reportDate: string;
  data: { lines?: Array<{ totalCostCents?: number | null }>; importedFromExcel?: boolean };
}

export function ImportedListClient() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    // No jobId filter — get them all (could be slow on lots of data).
    fetch(`${apiBaseUrl()}/api/imported-daily-reports/range?from=2000-01-01&to=2099-12-31`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((j: { reports?: Row[] }) => setRows(j.reports ?? []));
  }, []);

  if (rows === null) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No imported daily reports.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
      {rows.map((r) => {
        const lineCount = r.data.lines?.length ?? 0;
        const totalCents = (r.data.lines ?? []).reduce((s, l) => s + (l.totalCostCents ?? 0), 0);
        return (
          <li key={r.id} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
            <Link href={`/jobs/${r.jobId}`} className="text-yge-blue-700 hover:underline">
              {r.reportDate} · job {r.jobId.slice(0, 16)}…
            </Link>
            <span className="text-xs text-gray-500">
              {lineCount} line{lineCount === 1 ? '' : 's'} · <Money cents={totalCents} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
