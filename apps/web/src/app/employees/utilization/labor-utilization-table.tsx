'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface WeekCell {
  week: string;
  hours: number;
  cents: number;
  jobs: string[];
}

interface Row {
  employee: string;
  ytdHours: number;
  ytdCents: number;
  weeks: WeekCell[];
}

interface Resp {
  weeks: string[];
  rows: Row[];
}

export function LaborUtilizationTable() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/employees/utilization?weeks=8`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { weeks: [], rows: [] }))
      .then((j: Resp) => setData(j));
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (data.rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No labor entries logged yet in the last 8 weeks. Daily report lines
        with cost codes prefixed <code>LAB-</code> show up here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2 sticky left-0 bg-white">Employee</th>
            {data.weeks.map((w) => (
              <th key={w} className="px-3 py-2 text-right">{w.slice(5)}</th>
            ))}
            <th className="px-3 py-2 text-right">YTD hrs</th>
            <th className="px-3 py-2 text-right">YTD $</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.employee} className="border-t border-gray-100">
              <td className="px-3 py-2 sticky left-0 bg-white font-medium">{r.employee}</td>
              {r.weeks.map((w) => (
                <td
                  key={w.week}
                  className={`px-3 py-2 text-right font-mono text-xs ${w.hours > 40 ? 'bg-amber-50' : ''}`}
                  title={w.jobs.length > 0 ? `Jobs: ${w.jobs.join(', ')}` : ''}
                >
                  {w.hours || ''}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-mono font-semibold">{r.ytdHours.toFixed(1)}</td>
              <td className="px-3 py-2 text-right font-mono">
                <Money cents={r.ytdCents} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
