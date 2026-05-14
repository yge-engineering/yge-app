// Empty-master-data banner — only renders if 3+ master tables are empty.
// Shows on dashboard to nudge onboarding.

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

export function DataStatusBanner() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/admin/data-status/counts`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { counts: null }))
      .then((j: { counts?: Counts }) => setCounts(j.counts ?? null));
  }, []);

  if (!counts) return null;
  const emptyTables = Object.entries(counts).filter(([, v]) => v === 0);
  if (emptyTables.length < 3) return null;

  return (
    <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
            ⚠ Onboarding — {emptyTables.length} empty master tables
          </h2>
          <p className="mt-1 text-xs text-amber-900">
            {emptyTables.map(([k]) => k).slice(0, 6).join(', ')}
            {emptyTables.length > 6 ? ` + ${emptyTables.length - 6} more` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/onboarding"
            className="rounded border border-amber-700 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200"
          >
            Onboarding checklist →
          </Link>
          <Link
            href="/admin/excel-import"
          className="rounded border border-amber-700 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
        >
          Run Excel import →
          </Link>
        </div>
      </div>
    </section>
  );
}
