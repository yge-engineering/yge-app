'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Year { year: number; jobs: number; revenueCents: number }

export function AwardedRevenueTable() {
  const [years, setYears] = useState<Year[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/stats/awarded-revenue`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { years: [] }))
      .then((j: { years?: Year[] }) => setYears(j.years ?? []));
  }, []);

  if (!years) return <p className="text-sm text-gray-500">Loading…</p>;
  if (years.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No awarded jobs with bid prices yet.
      </p>
    );
  }

  const total = years.reduce((s, y) => s + y.revenueCents, 0);
  const totalJobs = years.reduce((s, y) => s + y.jobs, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2 text-right">Awarded jobs</th>
            <th className="px-3 py-2 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.year} className="border-t border-gray-100">
              <td className="px-3 py-2 font-semibold">{y.year}</td>
              <td className="px-3 py-2 text-right font-mono">{y.jobs}</td>
              <td className="px-3 py-2 text-right font-mono"><Money cents={y.revenueCents} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right font-mono">{totalJobs}</td>
            <td className="px-3 py-2 text-right font-mono"><Money cents={total} /></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
