'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Employee {
  id: string;
  classification?: string | null;
}

export function ClassCountCardPanel() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((j: { employees?: Employee[] }) => setEmployees(j.employees ?? []));
  }, []);

  if (!employees) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  const classifications = new Set<string>();
  let missing = 0;
  for (const e of employees) {
    const c = e.classification;
    if (!c) {
      missing += 1;
    } else {
      classifications.add(c);
    }
  }
  const count = classifications.size;
  const tone = count >= 8 ? 'good' : count >= 4 ? 'warn' : 'bad';

  return (
    <section className="rounded-lg border border-yge-blue-200 bg-yge-blue-50 p-6 text-center shadow-sm">
      <div className={`text-6xl font-extrabold tracking-tighter ${tone === 'good' ? 'text-green-800' : tone === 'warn' ? 'text-amber-800' : 'text-red-800'}`}>
        {count}
      </div>
      <p className="mt-2 text-sm text-yge-blue-900">
        distinct classification{count === 1 ? '' : 's'} across {employees.length} employee{employees.length === 1 ? '' : 's'}.
      </p>
      <p className="mt-1 text-[11px] text-yge-blue-700">
        {missing} employee{missing === 1 ? '' : 's'} have no classification on file.
      </p>
    </section>
  );
}
