'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Report {
  id: string;
  jobId: string;
  reportDate: string;
  lineCount: number;
}

interface Resp {
  from: string;
  to: string;
  jobId: string | null;
  reports: Report[];
  totalReports: number;
  totalLines: number;
  totalCents: number;
}

export function RangeClient() {
  const today = new Date().toISOString().slice(0, 10);
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(lastWeek);
  const [to, setTo] = useState(today);
  const [jobId, setJobId] = useState('');
  const [data, setData] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (jobId) params.set('jobId', jobId);
      const res = await fetch(`${apiBaseUrl()}/api/imported-daily-reports/range?${params.toString()}`, { cache: 'no-store' });
      setData(res.ok ? (await res.json() as Resp) : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">Job ID (optional)</span>
          <input type="text" value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="job-…" className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <button type="button" onClick={() => void run()} disabled={busy} className="rounded bg-yge-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
          {busy ? 'Running…' : 'Run'}
        </button>
      </div>

      {data && (
        <>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <Tile label="Reports" value={data.totalReports} />
            <Tile label="Lines" value={data.totalLines} />
            <Tile label="$" value={<Money cents={data.totalCents} />} />
          </div>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {data.reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <Link href={`/jobs/${r.jobId}`} className="text-yge-blue-700 hover:underline">
                  {r.reportDate} · job {r.jobId.slice(0, 16)}…
                </Link>
                <span className="text-xs text-gray-500">{r.lineCount} lines</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-xl font-bold text-yge-blue-900">{value}</div>
    </div>
  );
}
