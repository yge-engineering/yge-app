// /employees — employee master list.
//
// Plain English: roster page. Pulls every employee from the API,
// shows name, classification, role, status. Active first.
//
// Refactored to use the shared component library: PageHeader,
// LinkButton, EmptyState, DataTable, StatusPill, RoleBadge.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  RoleBadge,
  StatusPill,
} from '../../components';
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

function statusTone(status: string): 'success' | 'warn' | 'muted' | 'neutral' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'ON_LEAVE': return 'warn';
    case 'TERMINATED': return 'muted';
    default: return 'neutral';
  }
}

export default async function EmployeesPage() {
  const employees = await fetchEmployees();
  const sorted = [...employees].sort((a, b) => {
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
        <PageHeader
          title="Employees"
          subtitle={`${activeCount} active · ${sorted.length} total on file`}
          actions={
            <LinkButton href="/employees/new" variant="primary" size="md">
              + New employee
            </LinkButton>
          }
        />

        {sorted.length === 0 ? (
          <EmptyState
            title="No employees yet"
            body="Add your foremen, operators, and laborers so dispatch boards and certified payrolls have people to reference."
            actions={[{ href: '/employees/new', label: 'Add your first employee', primary: true }]}
          />
        ) : (
          <DataTable
            rows={sorted}
            keyFn={(e) => e.id}
            columns={[
              {
                key: 'name',
                header: 'Name',
                cell: (e) => (
                  <Link href={`/employees/${e.id}`} className="font-medium text-blue-700 hover:underline">
                    {e.firstName} {e.lastName}
                  </Link>
                ),
              },
              {
                key: 'role',
                header: 'Role',
                cell: (e) => <RoleBadge role={e.role} />,
              },
              {
                key: 'classification',
                header: 'Classification',
                cell: (e) => <span className="text-gray-700">{e.classification}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (e) => <StatusPill label={e.status} tone={statusTone(e.status)} />,
              },
              {
                key: 'phone',
                header: 'Phone',
                cell: (e) => e.phone ?? <span className="text-gray-400">—</span>,
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
