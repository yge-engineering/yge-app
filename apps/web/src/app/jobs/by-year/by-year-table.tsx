'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface YearStat { year: number; total: number; awarded: number; lost: number }

export function JobsByYearTable() {
  const [years, setYears] = useState<YearStat[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/stats/by-year`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { years: [] }))
      .then((j: { years?: YearStat[] }) => setYears(j.years ?? []));
  }, []);

  if (!years) return <p className="text-sm text-gray-500">Loading…</p>;
  if (years.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No job activity yet.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2 text-right">Total jobs</th>
            <th className="px-3 py-2 text-right">Awarded</th>
            <th className="px-3 py-2 text-right">Lost</th>
            <th className="px-3 py-2 text-right">Hit rate</th>
          </tr>
        </thead>
        <tbody>
          {years.map((s) => {
            const decided = s.awarded + s.lost;
            const hr = decided > 0 ? s.awarded / decided : 0;
            return (
              <tr key={s.year} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{s.year}</td>
                <td className="px-3 py-2 text-right font-mono">{s.total}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{s.awarded}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{s.lost}</td>
                <td className="px-3 py-2 text-right font-mono">{decided > 0 ? `${(hr * 100).toFixed(0)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
