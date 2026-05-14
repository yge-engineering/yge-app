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

export function EmptyTables() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/admin/data-status`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rows?: Row[] } | null) => setRows(j?.rows ?? []));
  }, []);

  if (!rows) return <p className="text-sm text-gray-500">Loading…</p>;
  const empties = rows.filter((r) => r.count === 0);
  if (empties.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-green-300 bg-green-50 p-6 text-sm text-green-700">
        Every entity has at least one record. Nice.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
      {empties.map((r) => (
        <li key={r.entity} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="font-mono font-semibold text-red-700">{r.entity}</span>
          {HREF_BY[r.entity] ? (
            <Link href={HREF_BY[r.entity]!} className="text-xs text-yge-blue-700 hover:underline">add some →</Link>
          ) : (
            <span className="text-xs text-gray-400">no add link</span>
          )}
        </li>
      ))}
    </ul>
  );
}
