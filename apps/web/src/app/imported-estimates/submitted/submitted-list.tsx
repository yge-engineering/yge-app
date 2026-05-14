'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  id: string;
  jobNumber: string;
  projectName: string;
  bidPriceCents: number;
  notes: string | undefined;
}

export function SubmittedList() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/imported-estimates/submitted-list`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { estimates: [] }))
      .then((j: { estimates?: Row[] }) => setRows(j.estimates ?? []));
  }, []);

  if (!rows) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No estimates marked submitted yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
      {rows.map((e) => {
        const submitMatch = /\[Submitted ([^\]]+)\]/.exec(e.notes ?? '');
        return (
          <li key={e.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/imported-estimates/${e.id}`} className="text-sm font-semibold text-yge-blue-700 hover:underline">
                {e.jobNumber} · {e.projectName}
              </Link>
              <span className="text-xs font-mono"><Money cents={e.bidPriceCents} /></span>
            </div>
            {submitMatch && (
              <div className="mt-1 text-[11px] text-green-700">
                Submitted {new Date(submitMatch[1] ?? '').toLocaleString()}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
