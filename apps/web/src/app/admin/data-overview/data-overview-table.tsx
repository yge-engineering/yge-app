'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Row { entity: string; count: number }

const ACTIONS: Record<string, { browse: string; create?: string; importPath?: string; exportPath?: string }> = {
  customers: { browse: '/customers', create: '/customers/new', importPath: '/admin/csv-imports', exportPath: '/admin/csv-exports' },
  vendors: { browse: '/vendors', create: '/vendors/new', importPath: '/admin/csv-imports', exportPath: '/admin/csv-exports' },
  employees: { browse: '/employees', create: '/employees/new', importPath: '/admin/csv-imports', exportPath: '/admin/csv-exports' },
  jobs: { browse: '/jobs', create: '/jobs/new' },
  importedEstimates: { browse: '/imported-estimates', create: '/imported-estimates/new' },
  bidResults: { browse: '/bid-results', create: '/bid-results/new', importPath: '/bid-results/import', exportPath: '/admin/csv-exports' },
  materials: { browse: '/materials', create: '/materials/new', importPath: '/admin/csv-imports' },
  costCodes: { browse: '/cost-codes', create: '/cost-codes/new' },
  equipmentRates: { browse: '/equipment-rates', create: '/equipment-rates/new', importPath: '/admin/csv-imports', exportPath: '/admin/csv-exports' },
  laborRates: { browse: '/labor-rates', create: '/labor-rates/new', importPath: '/admin/csv-imports' },
  dailyReports: { browse: '/daily-reports', importPath: '/daily-reports/import' },
};

export function DataOverviewTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/admin/data-status`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rows?: Row[] } | null) => setRows(j?.rows ?? []));
  }, []);

  if (!rows) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No data status rows registered.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Entity</th>
            <th className="px-3 py-2 text-right">Records</th>
            <th className="px-3 py-2">Browse</th>
            <th className="px-3 py-2">New</th>
            <th className="px-3 py-2">Import</th>
            <th className="px-3 py-2">Export</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const a = ACTIONS[r.entity];
            return (
              <tr key={r.entity} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{r.entity}</td>
                <td className="px-3 py-2 text-right font-mono">{r.count}</td>
                <td className="px-3 py-2">{a?.browse ? <Link href={a.browse} className="text-yge-blue-700 hover:underline">Open</Link> : <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-2">{a?.create ? <Link href={a.create} className="text-yge-blue-700 hover:underline">New</Link> : <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-2">{a?.importPath ? <Link href={a.importPath} className="text-yge-blue-700 hover:underline">CSV</Link> : <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-2">{a?.exportPath ? <Link href={a.exportPath} className="text-yge-blue-700 hover:underline">CSV</Link> : <span className="text-gray-400">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
