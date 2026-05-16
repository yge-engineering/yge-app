'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  status?: string | null;
  ownerAgency?: string | null;
}

const TOP_N = 6;

export function TwoDPanel() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const agencyCount = new Map<string, number>();
  for (const j of jobs) {
    const a = j.ownerAgency ?? '— none —';
    agencyCount.set(a, (agencyCount.get(a) ?? 0) + 1);
  }
  const topAgencies = Array.from(agencyCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([a]) => a);

  const statuses = new Set<string>();
  const cells = new Map<string, number>();
  for (const j of jobs) {
    const s = j.status ?? '— unknown —';
    let a = j.ownerAgency ?? '— none —';
    if (!topAgencies.includes(a)) a = 'other';
    statuses.add(s);
    const k = `${s}|${a}`;
    cells.set(k, (cells.get(k) ?? 0) + 1);
  }
  const cols = [...topAgencies, 'other'];
  const sList = Array.from(statuses).sort();

  if (sList.length === 0) {
    return <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-xs text-gray-500">No jobs yet.</div>;
  }

  return (
    <div className="overflow-auto rounded border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">Status</th>
            {cols.map((a) => (
              <th key={a} className="px-3 py-2 text-right normal-case">{a}</th>
            ))}
            <th className="px-3 py-2 text-right">Row total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sList.map((s) => {
            let rowTotal = 0;
            const tds = cols.map((a) => {
              const n = cells.get(`${s}|${a}`) ?? 0;
              rowTotal += n;
              return (
                <td key={a} className="px-3 py-2 text-right text-xs font-mono">
                  {n > 0 ? n : <span className="text-gray-300">·</span>}
                </td>
              );
            });
            return (
              <tr key={s}>
                <td className="px-3 py-2 text-left font-medium text-gray-900">{s}</td>
                {tds}
                <td className="px-3 py-2 text-right font-semibold">{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
