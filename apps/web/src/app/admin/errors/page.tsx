// /admin/errors — Postgres-captured server errors.
//
// Plain English: lookup tool for "I clicked Save and got an error."
// Filter by date, status, or search across message + route. Each
// row shows the X-Request-Id so the office can cross-reference
// against pino logs in Render.

import {
  AppShell,
  PageHeader,
  StatusPill,
} from '../../../components';
import { getTranslator } from '../../../lib/locale';
import { requirePermission } from '../../../lib/permissions';

interface ApiErrorRow {
  id: string;
  companyId: string | null;
  requestId: string | null;
  method: string;
  route: string;
  statusCode: number;
  message: string;
  stack: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  occurredAt: string;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchErrors(params: {
  since?: string;
  statusCode?: string;
  search?: string;
}): Promise<ApiErrorRow[]> {
  const qs = new URLSearchParams();
  if (params.since) qs.set('since', params.since);
  if (params.statusCode) qs.set('statusCode', params.statusCode);
  if (params.search) qs.set('search', params.search);
  qs.set('limit', '200');
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/admin/errors?${qs.toString()}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    return ((await res.json()) as { errors: ApiErrorRow[] }).errors;
  } catch {
    return [];
  }
}

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: { since?: string; statusCode?: string; search?: string };
}) {
  requirePermission('audit:view');
  const errors = await fetchErrors(searchParams);
  const t = getTranslator();

  // Default since = 7 days ago for the form display.
  const defSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Server errors"
          subtitle="Captured 5xx responses with stack + request id. Cross-reference X-Request-Id against the Render log stream for full pino context."
        />

        <form
          action="/admin/errors"
          className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3"
        >
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">
              Since
            </span>
            <input
              type="date"
              name="since"
              defaultValue={searchParams.since ?? defSince}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">
              Status code
            </span>
            <select
              name="statusCode"
              defaultValue={searchParams.statusCode ?? ''}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">Any</option>
              <option value="500">500</option>
              <option value="502">502</option>
              <option value="503">503</option>
              <option value="400">400</option>
              <option value="404">404</option>
            </select>
          </label>
          <label className="block flex-1 text-xs">
            <span className="mb-1 block font-medium text-gray-700">
              Search (message / route)
            </span>
            <input
              type="text"
              name="search"
              defaultValue={searchParams.search ?? ''}
              placeholder="vendor name, error keyword, /api/jobs…"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700"
          >
            Filter
          </button>
        </form>

        {errors.length === 0 ? (
          <div className="rounded-md border border-green-300 bg-green-50 px-4 py-6 text-center text-sm text-green-800">
            No captured errors in this window. ✓
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Route</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2">Request id</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errors.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">
                      {e.occurredAt.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill
                        label={String(e.statusCode)}
                        tone={
                          e.statusCode >= 500
                            ? 'danger'
                            : e.statusCode >= 400
                              ? 'warn'
                              : 'muted'
                        }
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{e.method}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700 break-all">
                      {e.route}
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      <details>
                        <summary className="cursor-pointer">
                          {e.message.length > 80
                            ? e.message.slice(0, 80) + '…'
                            : e.message}
                        </summary>
                        {e.stack ? (
                          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-[11px] text-gray-700">
                            {e.stack}
                          </pre>
                        ) : null}
                      </details>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-500">
                      {e.requestId ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-500">
          {t('errors.disclaimer', { default: '' }) ||
            'Showing the most recent 200 errors. To see more, narrow the search or shrink the window.'}
        </p>
      </main>
    </AppShell>
  );
}
