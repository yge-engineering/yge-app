'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Resp {
  total: number;
  byStatus: Record<string, number>;
  byRateType: Record<string, number>;
}

export function JobsStatsTile() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);

  if (!data) return null;

  const entries = Object.entries(data.byStatus).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Jobs by status
        </h2>
        <Link
          href="/jobs/board"
          className="rounded border border-yge-blue-500 px-2 py-0.5 text-[11px] font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          Board →
        </Link>
      </div>
      <ul className="divide-y divide-gray-100 text-sm">
        {entries.map(([status, n]) => (
          <li key={status} className="flex items-center justify-between py-1.5">
            <span className="text-gray-700">{status}</span>
            <span className="font-mono font-semibold text-yge-blue-900">{n}</span>
          </li>
        ))}
        <li className="flex items-center justify-between border-t-2 border-gray-200 py-1.5 font-semibold">
          <span>Total</span>
          <span className="font-mono">{data.total}</span>
        </li>
      </ul>
    </section>
  );
}
