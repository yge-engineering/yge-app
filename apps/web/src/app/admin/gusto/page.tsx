// /admin/gusto — Gusto integration status + employee match preview.

import {
  AppShell,
  PageHeader,
  StatusPill,
} from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface GustoStatus {
  configured: boolean;
  configuredFields: { hasApiKey: boolean; hasCompanyUuid: boolean };
}
interface GustoEmployeeRow {
  gustoUuid: string;
  firstName: string;
  lastName: string;
  email: string | null;
  terminated: boolean;
  title: string | null;
  rate: string | null;
  matchedLocalEmployeeId: string | null;
}
interface GustoEmployeesResp {
  total: number;
  matched: number;
  unmatched: number;
  employees: GustoEmployeeRow[];
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchStatus(): Promise<GustoStatus | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/gusto/status`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as GustoStatus;
  } catch {
    return null;
  }
}

async function fetchEmployees(): Promise<GustoEmployeesResp | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/gusto/employees`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as GustoEmployeesResp;
  } catch {
    return null;
  }
}

export default async function AdminGustoPage() {
  requirePermission('audit:view');
  const status = await fetchStatus();
  const employees =
    status?.configured ? await fetchEmployees() : null;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Gusto integration"
          subtitle="Read-only sync v1: list Gusto employees + match against YGE Employee records by name. Push hours + pull paychecks ships once read parity is verified on a real account."
        />

        <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Status
          </h2>
          {status ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span>Overall</span>
                <StatusPill
                  label={status.configured ? 'Configured ✓' : 'Not configured'}
                  tone={status.configured ? 'success' : 'warn'}
                />
              </div>
              <div></div>
              <div>
                <dt className="text-xs text-gray-500">GUSTO_API_KEY</dt>
                <dd>{status.configuredFields.hasApiKey ? '✓ set' : '✗ missing'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">GUSTO_COMPANY_UUID</dt>
                <dd>
                  {status.configuredFields.hasCompanyUuid
                    ? '✓ set'
                    : '✗ missing'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-red-700">Status check failed — API may be down.</p>
          )}
        </section>

        {!status?.configured ? (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <h2 className="font-semibold">Setup steps</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                Sign up for Gusto + create a personal-access token at{' '}
                <code className="rounded bg-white px-1 font-mono text-xs">
                  app.gusto.com/.../personal_access_tokens
                </code>
                .
              </li>
              <li>Look up your company UUID via Gusto API "/v1/me".</li>
              <li>
                In Render, set{' '}
                <code className="font-mono">GUSTO_API_KEY</code> +
                <code className="font-mono">GUSTO_COMPANY_UUID</code> env
                vars.
              </li>
              <li>
                Re-deploy the API and refresh this page. Employees should
                show up below.
              </li>
            </ol>
          </section>
        ) : null}

        {employees ? (
          <section className="mt-6 rounded-md border border-gray-200 bg-white">
            <header className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-800">
              Gusto employees ({employees.total})
              <span className="ml-3 text-xs font-normal text-gray-600">
                {employees.matched} matched · {employees.unmatched}{' '}
                unmatched
              </span>
            </header>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">YGE match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.employees.map((e) => (
                  <tr key={e.gustoUuid}>
                    <td className="px-3 py-2 font-semibold">
                      {e.firstName} {e.lastName}
                    </td>
                    <td className="px-3 py-2">{e.title ?? '—'}</td>
                    <td className="px-3 py-2 font-mono">
                      {e.rate ? `$${e.rate}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">{e.email ?? '—'}</td>
                    <td className="px-3 py-2">
                      <StatusPill
                        label={e.terminated ? 'Terminated' : 'Active'}
                        tone={e.terminated ? 'muted' : 'success'}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {e.matchedLocalEmployeeId ? (
                        <span className="font-mono text-xs text-green-800">
                          {e.matchedLocalEmployeeId}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700">
                          ⚠ no match
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
