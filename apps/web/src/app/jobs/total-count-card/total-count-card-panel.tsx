'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
}

export function TotalCountCardPanel() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const total = jobs.length;
  const tone = total >= 50 ? 'good' : total >= 10 ? 'warn' : 'bad';

  return (
    <section className="rounded-lg border border-yge-blue-200 bg-yge-blue-50 p-6 text-center shadow-sm">
      <div className={`text-6xl font-extrabold tracking-tighter ${tone === 'good' ? 'text-green-800' : tone === 'warn' ? 'text-amber-800' : 'text-red-800'}`}>
        {total}
      </div>
      <p className="mt-2 text-sm text-yge-blue-900">
        total job{total === 1 ? '' : 's'} on file.
      </p>
    </section>
  );
}
