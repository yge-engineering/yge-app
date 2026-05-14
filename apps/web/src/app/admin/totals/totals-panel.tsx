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

export function TotalsTiles() {
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

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {rows.map((r) => {
        const tone = r.count === 0 ? 'text-red-700' : r.count < 5 ? 'text-amber-700' : 'text-yge-blue-900';
        const inner = (
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{r.entity}</div>
            <div className={`text-3xl font-bold ${tone}`}>{r.count}</div>
          </div>
        );
        return HREF_BY[r.entity] ? (
          <Link key={r.entity} href={HREF_BY[r.entity]!} className="block hover:bg-gray-50">{inner}</Link>
        ) : (
          <div key={r.entity}>{inner}</div>
        );
      })}
    </div>
  );
}
