'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  code: string;
  description: string;
  bidHours: number;
  bidCents: number;
  actHours: number;
  actCents: number;
  varianceCents: number;
  jobs: string[];
}

export function EquipmentUsageTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/equipment-rates/usage`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((j: { rows?: Row[] }) => setRows(j.rows ?? []));
  }, []);

  if (rows === null) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No equipment usage data yet. Equipment shows up here once it appears on
        imported estimate lines or daily reports (cost codes prefixed{' '}
        <code>EQP-</code>).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 text-right">Bid hrs</th>
            <th className="px-3 py-2 text-right">Bid $</th>
            <th className="px-3 py-2 text-right">Actual hrs</th>
            <th className="px-3 py-2 text-right">Actual $</th>
            <th className="px-3 py-2 text-right">Variance</th>
            <th className="px-3 py-2">Jobs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-[12px]">{r.code}</td>
              <td className="px-3 py-2 text-xs">{r.description}</td>
              <td className="px-3 py-2 text-right font-mono">{r.bidHours || ''}</td>
              <td className="px-3 py-2 text-right font-mono">
                {r.bidCents ? <Money cents={r.bidCents} /> : ''}
              </td>
              <td className="px-3 py-2 text-right font-mono">{r.actHours || ''}</td>
              <td className="px-3 py-2 text-right font-mono">
                {r.actCents ? <Money cents={r.actCents} /> : ''}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono ${
                  r.varianceCents < 0 ? 'text-red-700 font-semibold' : 'text-gray-700'
                }`}
              >
                <Money cents={r.varianceCents} />
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {r.jobs.join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
