'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row { entity: string; count: number }

const HREF_BY: Record<string, string> = {
  customers: '/customers',
  vendors: '/vendors',
  employees: '/employees',
  materials: '/materials',
  equipment: '/equipment-rates',
  equipmentRates: '/equipment-rates',
  laborRates: '/labor-rates',
  costCodes: '/cost-codes',
  jobs: '/jobs',
  importedEstimates: '/imported-estimates',
  bidResults: '/bid-results',
  dailyReports: '/daily-reports',
};

export function LargestTables() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/admin/data-status`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rows?: Row[] } | null) => setRows(j?.rows ?? []));
  }, []);

  if (!rows) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        No data status rows registered.
      </p>
    );
  }

  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, r) => s + r.count, 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Entity</th>
            <th className="px-3 py-2 text-right">Records</th>
            <th className="px-3 py-2 text-right">Share</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.entity} className="border-t border-gray-100">
              <td className="px-3 py-2 font-semibold">{r.entity}</td>
              <td className="px-3 py-2 text-right font-mono">{r.count}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{total > 0 ? `${((r.count / total) * 100).toFixed(1)}%` : '—'}</td>
              <td className="px-3 py-2 text-right">
                {HREF_BY[r.entity] ? <Link href={HREF_BY[r.entity]!} className="text-xs text-yge-blue-700 hover:underline">open</Link> : null}
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
