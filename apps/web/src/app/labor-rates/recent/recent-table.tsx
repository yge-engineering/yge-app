'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Rate {
  id: string;
  createdAt?: string;
  classification?: string | null;
  description?: string | null;
  hourlyCents?: number | null;
  rateType?: string | null;
}

interface Resp { laborRates?: Rate[] }

export function RecentLaborRatesTable() {
  const [rates, setRates] = useState<Rate[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/labor-rates`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setRates(j?.laborRates ?? []));
  }, []);

  if (!rates) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rates.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No labor rate records yet.
      </p>
    );
  }

  const recent = [...rates]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 25);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Added</th>
            <th className="px-3 py-2">Classification</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Rate type</th>
            <th className="px-3 py-2 text-right">Hourly</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((r) => (
            <tr key={r.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{(r.createdAt ?? '').slice(0, 10) || '—'}</td>
              <td className="px-3 py-2 font-semibold">
                <Link href={`/labor-rates/${r.id}`} className="text-yge-blue-700 hover:underline">
                  {r.classification ?? '—'}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs text-gray-700">{r.description ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.rateType ?? '—'}</td>
              <td className="px-3 py-2 text-right font-mono">
                {typeof r.hourlyCents === 'number' ? <Money cents={r.hourlyCents} /> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
