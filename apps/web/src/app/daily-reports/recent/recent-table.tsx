'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface DailyReport {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  reportDate?: string;
  jobNumber?: string;
  weather?: string;
  lines?: Array<unknown>;
}

export function RecentDailyReportsTable() {
  const [items, setItems] = useState<DailyReport[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/imported-daily-reports`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { reports?: DailyReport[]; importedDailyReports?: DailyReport[] } | null) => {
        const arr = (j?.reports ?? j?.importedDailyReports) ?? [];
        setItems(arr);
      });
  }, []);

  if (!items) return <p className="text-sm text-gray-500">Loading…</p>;
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No daily reports recorded yet.
      </p>
    );
  }

  const recent = [...items]
    .sort((a, b) => (b.reportDate ?? b.updatedAt ?? b.createdAt ?? '').localeCompare(a.reportDate ?? a.updatedAt ?? a.createdAt ?? ''))
    .slice(0, 25);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Report date</th>
            <th className="px-3 py-2">Job #</th>
            <th className="px-3 py-2">Weather</th>
            <th className="px-3 py-2 text-right">Lines</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((d) => (
            <tr key={d.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{(d.reportDate ?? d.updatedAt ?? d.createdAt ?? '').slice(0, 10) || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{d.jobNumber ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-700">{d.weather ?? '—'}</td>
              <td className="px-3 py-2 text-right font-mono">{(d.lines ?? []).length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
