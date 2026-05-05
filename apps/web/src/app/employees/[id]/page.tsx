// /employees/[id] — employee detail + edit.
//
// Plain English: shows everything we know about one person on the
// roster — and lets you edit it. The list page links here, and the
// "Add employee" form redirects here after save. Inline edits flow
// through PATCH /api/employees/:id; status changes too. The Danger
// Zone at the bottom permanently deletes the record (use sparingly —
// payroll history references the employee id).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Employee, EmployeeRole } from '@yge/shared';

import {
  AppShell,
  EmployeeDeleteButton,
} from '../../../components';
import { EmployeeEditor } from '@/components/employee-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

// Roles that can supervise others — same list as the new-employee
// form so the "Reports to" dropdown matches across pages.
const SUPERVISOR_ROLES: EmployeeRole[] = [
  'OWNER',
  'OFFICE',
  'PROJECT_MANAGER',
  'SUPERINTENDENT',
  'FOREMAN',
];

async function fetchEmployee(id: string): Promise<Employee | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/employees/${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const json = (await res.json()) as { employee?: Employee };
    return json.employee ?? null;
  } catch {
    return null;
  }
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/employees`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { employees?: Employee[] };
    return body.employees ?? [];
  } catch {
    return [];
  }
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const employee = await fetchEmployee(params.id);
  if (!employee) notFound();

  const all = await fetchEmployees();
  // Active supervisors, excluding the current employee (can't report to self).
  const supervisors = all.filter(
    (e) =>
      e.id !== employee.id &&
      e.status === 'ACTIVE' &&
      SUPERVISOR_ROLES.includes(e.role),
  );

  const fullName = employee.displayName
    ? `${employee.displayName} ${employee.lastName}`
    : `${employee.firstName} ${employee.lastName}`;

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <div className="mb-2 text-xs">
          <Link href="/employees" className="text-blue-700 hover:underline">
            ← Back to employees
          </Link>
        </div>

        <EmployeeEditor
          initial={employee}
          foremen={supervisors}
          apiBaseUrl={publicApiBaseUrl()}
        />

        {/* Danger zone */}
        <section className="mt-10 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Danger zone
          </div>
          <p className="mt-1 text-sm text-gray-700">
            Use the Status dropdown above to mark this employee Terminated —
            that keeps payroll and timecard history intact. Only delete the
            record if it was added by mistake.
          </p>
          <div className="mt-3">
            <EmployeeDeleteButton
              employeeId={employee.id}
              name={fullName}
              apiBaseUrl={publicApiBaseUrl()}
            />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
