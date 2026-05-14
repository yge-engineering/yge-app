'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Counts {
  customers: number;
  vendors: number;
  jobs: number;
  importedEstimates: number;
  costCodes: number;
  laborRates: number;
  equipmentRates: number;
  equipmentRentals: number;
  materials: number;
  employees: number;
  bidResults: number;
  dailyReports: number;
}

const TILES: Array<{ key: keyof Counts; label: string; href: string }> = [
  { key: 'customers', label: 'Customers', href: '/customers' },
  { key: 'vendors', label: 'Vendors / subs', href: '/vendors' },
  { key: 'jobs', label: 'Jobs', href: '/jobs' },
  { key: 'importedEstimates', label: 'Imported estimates', href: '/imported-estimates' },
  { key: 'costCodes', label: 'Cost codes', href: '/cost-codes' },
  { key: 'laborRates', label: 'Labor rates', href: '/labor-rates' },
  { key: 'equipmentRates', label: 'Equipment owned', href: '/equipment-rates' },
  { key: 'equipmentRentals', label: 'Equipment rental', href: '/equipment-rates' },
  { key: 'materials', label: 'Materials', href: '/materials' },
  { key: 'employees', label: 'Employees', href: '/employees' },
  { key: 'bidResults', label: 'Bid results', href: '/bid-results' },
  { key: 'dailyReports', label: 'Daily reports', href: '/daily-reports' },
];

export function DataStatusGrid() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/admin/data-status/counts`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { counts: null }))
      .then((j: { counts?: Counts }) => setCounts(j.counts ?? null));
  }, []);

  if (!counts) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {TILES.map((t) => {
        const value = counts[t.key];
        const empty = value === 0;
        return (
          <li key={t.key}>
            <Link
              href={t.href}
              className={`block rounded-lg border p-3 shadow-sm transition ${
                empty
                  ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                  : 'border-gray-200 bg-white hover:bg-yge-blue-50'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {t.label}
              </div>
              <div className={`text-2xl font-bold ${empty ? 'text-amber-700' : 'text-yge-blue-900'}`}>
                {value}
              </div>
              {empty && <div className="mt-1 text-[10px] text-amber-700">empty</div>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
