'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row { entity: string; count: number; href?: string }

interface Resp { rows?: Array<{ entity: string; count: number; href?: string }> }

const HREF_BY_ENTITY: Record<string, string> = {
  customers: '/customers',
  vendors: '/vendors',
  materials: '/materials',
  equipment: '/equipment',
  employees: '/employees',
  jobs: '/jobs',
  importedEstimates: '/imported-estimates',
  bidResults: '/bid-results',
  dailyReports: '/daily-reports',
  costCodes: '/cost-codes',
  laborRates: '/labor-rates',
};

export function DataSummaryTiles() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/admin/data-status`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setRows(j?.rows ?? []));
  }, []);

  if (!rows) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No data tables registered.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {rows.map((r) => {
        const href = r.href ?? HREF_BY_ENTITY[r.entity];
        const tone = r.count === 0 ? 'text-red-700' : r.count < 5 ? 'text-amber-700' : 'text-yge-blue-900';
        const tile = (
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{r.entity}</div>
            <div className={`text-2xl font-bold ${tone}`}>{r.count}</div>
          </div>
        );
        return href ? (
          <Link key={r.entity} href={href} className="block hover:bg-gray-50">{tile}</Link>
        ) : (
          <div key={r.entity}>{tile}</div>
        );
      })}
    </div>
  );
}
