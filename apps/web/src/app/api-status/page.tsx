// /api-status — health check page.
//
// Plain English: hits each major API route and shows green/red. Use
// it when the dashboard tiles look weird and you want to know
// whether the problem is the API server, your network, or the data.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';

interface ProbeResult {
  name: string;
  url: string;
  ok: boolean;
  status: number | string;
  count: number | null;
  ms: number;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

const PROBES: { name: string; url: string; key: string }[] = [
  { name: 'Jobs', url: '/api/jobs', key: 'jobs' },
  { name: 'Customers', url: '/api/customers', key: 'customers' },
  { name: 'Vendors', url: '/api/vendors', key: 'vendors' },
  { name: 'Employees', url: '/api/employees', key: 'employees' },
  { name: 'AR invoices', url: '/api/ar-invoices', key: 'invoices' },
  { name: 'AR payments', url: '/api/ar-payments', key: 'payments' },
  { name: 'AP invoices', url: '/api/ap-invoices', key: 'invoices' },
  { name: 'AP payments', url: '/api/ap-payments', key: 'payments' },
  { name: 'RFIs', url: '/api/rfis', key: 'rfis' },
  { name: 'Submittals', url: '/api/submittals', key: 'submittals' },
  { name: 'Daily reports', url: '/api/daily-reports', key: 'reports' },
  { name: 'Dispatches', url: '/api/dispatches', key: 'dispatches' },
  { name: 'Equipment', url: '/api/equipment', key: 'equipment' },
  { name: 'Punch items', url: '/api/punch-items', key: 'items' },
];

async function probe(p: { name: string; url: string; key: string }): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${apiBaseUrl()}${p.url}`, { cache: 'no-store' });
    const ms = Date.now() - start;
    if (!res.ok) {
      return { name: p.name, url: p.url, ok: false, status: res.status, count: null, ms };
    }
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[p.key];
    const count = Array.isArray(arr) ? arr.length : null;
    return { name: p.name, url: p.url, ok: true, status: res.status, count, ms };
  } catch (err) {
    const ms = Date.now() - start;
    return {
      name: p.name,
      url: p.url,
      ok: false,
      status: err instanceof Error ? err.message : 'error',
      count: null,
      ms,
    };
  }
}

export default async function ApiStatusPage() {
  const results = await Promise.all(PROBES.map(probe));
  const upCount = results.filter((r) => r.ok).length;
  const allUp = upCount === results.length;
  const noneUp = upCount === 0;

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">API status</h1>
          <p className="mt-1 text-sm text-gray-600">
            Pinging <code className="rounded bg-gray-100 px-1 font-mono text-xs">{apiBaseUrl()}</code>. {upCount} of {results.length} routes responding.
          </p>
        </header>

        {noneUp && (
          <div className="mb-6 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <strong>API is unreachable.</strong> Locally, run <code className="rounded bg-red-100 px-1 font-mono text-xs">pnpm dev</code> in <code className="rounded bg-red-100 px-1 font-mono text-xs">apps/api</code>. In production, check that the <code className="rounded bg-red-100 px-1 font-mono text-xs">NEXT_PUBLIC_API_URL</code> environment variable points at a running API server.
          </div>
        )}

        {allUp && (
          <div className="mb-6 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900">
            <strong>All routes responding.</strong> Dashboard tiles should be filling in normally.
          </div>
        )}

        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2 font-semibold">Route</th>
                <th className="px-3 py-2 font-semibold">URL</th>
                <th className="px-3 py-2 font-semibold">Records</th>
                <th className="px-3 py-2 font-semibold">Latency</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r) => (
                <tr key={r.url} className={r.ok ? 'hover:bg-gray-50' : 'bg-red-50'}>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${r.ok ? 'bg-green-500' : 'bg-red-500'}`}
                      aria-label={r.ok ? 'up' : 'down'}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.url}</td>
                  <td className="px-3 py-2 text-gray-700">{r.count ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{r.ms} ms</td>
                  <td className="px-3 py-2 text-gray-700">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Page reloads when you refresh. <Link href="/api-status" className="text-blue-700 hover:underline">Re-run checks</Link>.
        </p>
      </main>
    </AppShell>
  );
}
