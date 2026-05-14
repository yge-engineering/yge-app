'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  projectName?: string;
  jobNumber?: string;
  rateType?: string | null;
  status?: string | null;
  ownerAgency?: string | null;
}

export function MissingRateTypeTable() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) return <p className="text-sm text-gray-500">Loading…</p>;
  const rows = jobs.filter((j) => !(j.rateType ?? '').trim());

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        Every job has a rate type. Nice.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2">Job #</th>
            <th className="px-3 py-2">Owner agency</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((j) => (
            <tr key={j.id} className="border-t border-gray-100">
              <td className="px-3 py-2">
                <Link href={`/jobs/${j.id}`} className="font-semibold text-yge-blue-700 hover:underline">
                  {j.projectName ?? j.id}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{j.jobNumber ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-700">{j.ownerAgency ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{j.status ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
