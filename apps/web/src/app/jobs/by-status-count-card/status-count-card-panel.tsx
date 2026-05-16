'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Job {
  id: string;
  status?: string | null;
}

export function StatusCountCardPanel() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs?: Job[] }) => setJobs(j.jobs ?? []));
  }, []);

  if (!jobs) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const statuses = new Set<string>();
  let missing = 0;
  for (const j of jobs) {
    const s = j.status;
    if (!s) {
      missing += 1;
    } else {
      statuses.add(s);
    }
  }
  const count = statuses.size;
  const tone = count >= 4 ? 'good' : count >= 2 ? 'warn' : 'bad';

  return (
    <section className="rounded-lg border border-yge-blue-200 bg-yge-blue-50 p-6 text-center shadow-sm">
      <div className={`text-6xl font-extrabold tracking-tighter ${tone === 'good' ? 'text-green-800' : tone === 'warn' ? 'text-amber-800' : 'text-red-800'}`}>
        {count}
      </div>
      <p className="mt-2 text-sm text-yge-blue-900">
        distinct status{count === 1 ? '' : 'es'} across {jobs.length} job{jobs.length === 1 ? '' : 's'}.
      </p>
      <p className="mt-1 text-[11px] text-yge-blue-700">
        {missing} job{missing === 1 ? '' : 's'} have no status on file.
      </p>
    </section>
  );
}
