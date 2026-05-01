// /employees — employee master list.
//
// Plain English: roster page. Pulls every employee from the API,
// shows name, classification, role, status. Active first.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import type { Employee } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body.employees;
    return Array.isArray(arr) ? (arr as Employee[]) : [];
  } catch {
    return [];
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800';
    case 'ON_LEAVE':
      return 'bg-amber-100 text-amber-800';
    case 'TERMINATED':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export default async function EmployeesPage() {
  const employees = await fetchEmployees();
  const sorted = [...employees].sort((a, b) => {
    // Active first, then by last name.
    if (a.status !== b.status) {
      if (a.status === 'ACTIVE') return -1;
      if (b.status === 'ACTIVE') return 1;
    }
    return a.lastName.localeCompare(b.lastName);
  });

  const activeCount = sorted.filter((e) => e.status === 'ACTIVE').length;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Dashboard
          </Link>
          <Link
            href="/employees/new"
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            + New employee
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-600">
            {activeCount} active · {sorted.length} total on file
          </p>
        </header>

        {sorted.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
            No employees yet. Add one to get started.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Name</th>
                  <th className="px-4 py-2 font-semibold">Role</th>
                  <th className="px-4 py-2 font-semibold">Classification</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/employees/${e.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {e.firstName} {e.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{e.role}</td>
                    <td className="px-4 py-2 text-gray-700">{e.classification}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(e.status)}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{e.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
