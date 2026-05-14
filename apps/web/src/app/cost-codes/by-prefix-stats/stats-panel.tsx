'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface CostCode { id: string; code?: string | null }

export function ByPrefixStats() {
  const [codes, setCodes] = useState<CostCode[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/cost-codes`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { costCodes: [] }))
      .then((j: { costCodes?: CostCode[] }) => setCodes(j.costCodes ?? []));
  }, []);

  if (!codes) return <p className="text-sm text-gray-500">Loading…</p>;
  if (codes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No cost codes in the database yet.
      </p>
    );
  }

  const counts = new Map<string, number>();
  for (const c of codes) {
    const raw = (c.code ?? '').trim().toUpperCase();
    const dash = raw.indexOf('-');
    const prefix = dash > 0 ? raw.slice(0, dash) : (raw || '(unknown)');
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = codes.length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Prefix</th>
            <th className="px-3 py-2 text-right">Codes</th>
            <th className="px-3 py-2 text-right">Share</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([prefix, count]) => (
            <tr key={prefix} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono font-semibold">{prefix}</td>
              <td className="px-3 py-2 text-right font-mono">{count}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{((count / total) * 100).toFixed(1)}%</td>
              <td className="px-3 py-2 text-right">
                <Link href="/cost-codes/by-prefix-detail" className="text-xs text-yge-blue-700 hover:underline">view</Link>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right font-mono">{total}</td>
            <td className="px-3 py-2 text-right font-mono text-gray-500">100.0%</td>
            <td className="px-3 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
