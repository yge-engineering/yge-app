'use client';

import { useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Result { path: string; ms: number; ok: boolean; note?: string }

const ENDPOINTS = [
  '/api/jobs',
  '/api/jobs/stats',
  '/api/jobs/stats/by-year',
  '/api/jobs/stats/awarded-revenue',
  '/api/bid-results',
  '/api/bid-results/stats',
  '/api/bid-results/stats/sparkline',
  '/api/bid-results/by-agency',
  '/api/customers',
  '/api/customers/email-list',
  '/api/vendors',
  '/api/vendors/email-list',
  '/api/vendors/scorecard',
  '/api/employees',
  '/api/employees/utilization',
  '/api/materials',
  '/api/equipment-rates',
  '/api/equipment-rates/usage',
  '/api/labor-rates',
  '/api/cost-codes',
  '/api/imported-estimates',
  '/api/imported-daily-reports',
  '/api/admin/health',
  '/api/admin/data-status',
];

export function ApiTestPanel() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  async function runAll() {
    setRunning(true);
    const out: Result[] = [];
    for (const p of ENDPOINTS) {
      const t0 = performance.now();
      try {
        const r = await fetch(`${apiBaseUrl()}${p}`, { cache: 'no-store' });
        const ms = Math.round(performance.now() - t0);
        out.push({ path: p, ms, ok: r.ok, note: r.ok ? '' : `HTTP ${r.status}` });
      } catch (err) {
        const ms = Math.round(performance.now() - t0);
        out.push({ path: p, ms, ok: false, note: err instanceof Error ? err.message : 'fetch failed' });
      }
    }
    setResults(out);
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <button
        onClick={runAll}
        disabled={running}
        className="rounded bg-yge-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
      >
        {running ? 'Running…' : 'Run all'}
      </button>

      {results ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Endpoint</th>
                <th className="px-3 py-2 text-right">ms</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.path} className={`border-t border-gray-100 ${r.ok ? '' : 'bg-red-50'}`}>
                  <td className="px-3 py-2 font-mono text-xs">{r.path}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.ms}</td>
                  <td className={`px-3 py-2 font-semibold ${r.ok ? 'text-green-700' : 'text-red-700'}`}>
                    {r.ok ? 'OK' : (r.note ?? 'failed')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
