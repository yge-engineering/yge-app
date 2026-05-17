'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Employee {
  id: string;
  classification?: string | null;
  rateType?: string | null;
}

export function PrintPivotPanel() {
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
  const rateTypes = new Set<string>();
  const cells = new Map<string, number>();
  for (const e of employees) {
    const c = e.classification ?? '— unknown —';
    const r = e.rateType ?? '— unknown —';
    classifications.add(c);
    rateTypes.add(r);
    const k = `${c}${r}`;
    cells.set(k, (cells.get(k) ?? 0) + 1);
  }
  const cList = Array.from(classifications).sort();
  const rList = Array.from(rateTypes).sort();

  if (cList.length === 0) {
    return <p className="text-xs text-gray-500">No employees yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-300 text-[11px] uppercase tracking-wide text-gray-600">
        <tr>
          <th className="py-2 text-left">Classification</th>
          {rList.map((r) => (
            <th key={r} className="py-2 text-right">{r}</th>
          ))}
          <th className="py-2 text-right">Row total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {cList.map((c) => {
          let rowTotal = 0;
          const tds = rList.map((r) => {
            const n = cells.get(`${c}${r}`) ?? 0;
            rowTotal += n;
            return (
              <td key={r} className="py-2 text-right text-xs font-mono">
                {n > 0 ? n : <span className="text-gray-300">·</span>}
              </td>
            );
          });
          return (
            <tr key={c}>
              <td className="py-2 text-left font-medium text-gray-900">{c}</td>
              {tds}
              <td className="py-2 text-right font-semibold">{rowTotal}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
