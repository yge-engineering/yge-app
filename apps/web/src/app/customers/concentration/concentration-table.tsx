'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row {
  id: string;
  name: string;
  revenueCents: number;
  jobsCount: number;
  sharePct: number;
}

interface Resp {
  rows: Row[];
  totalRevenueCents: number;
  hhi: number;
  hhiClass: 'competitive' | 'moderate' | 'concentrated';
}

export function ConcentrationTable() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers/revenue-concentration`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (data.rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No awarded/active/closed jobs with bid prices yet.
      </p>
    );
  }

  const tone = data.hhiClass === 'concentrated' ? 'bg-red-100 text-red-800' : data.hhiClass === 'moderate' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Total tracked revenue</div>
          <div className="text-2xl font-bold"><Money cents={data.totalRevenueCents} /></div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-gray-500">HHI</div>
          <div className="text-2xl font-bold">{data.hhi.toLocaleString()}</div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
            {data.hhiClass}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2 text-right">Jobs</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">Share %</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <Link href={`/customers/${r.id}`} className="font-medium text-yge-blue-700 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right">{r.jobsCount}</td>
                <td className="px-3 py-2 text-right font-mono"><Money cents={r.revenueCents} /></td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{(r.sharePct * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        HHI = Σ (share% × 100)². Below 1500 is competitive; 1500–2500 moderate; above 2500 concentrated (bonding underwriters use this).
      </p>
    </div>
  );
}
