// /crew/[id] — edit a single employee.
//
// Server component fetches the record; the EmployeeEditor client island
// handles the form + cert add/remove + status changes.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Employee } from '@yge/shared';
import { EmployeeEditor } from '@/components/employee-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchEmployee(id: string): Promise<Employee | null> {
  const res = await fetch(`${apiBaseUrl()}/api/employees/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { employee: Employee };
  return json.employee;
}

async function fetchAllEmployees(): Promise<Employee[]> {
  const res = await fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = (await res.json()) as { employees: Employee[] };
  return json.employees;
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [employee, all] = await Promise.all([
    fetchEmployee(params.id),
    fetchAllEmployees(),
  ]);
  if (!employee) notFound();

  const foremen = all.filter(
    (e) => e.role === 'FOREMAN' && e.status === 'ACTIVE' && e.id !== employee.id,
  );

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/crew" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to crew
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <EmployeeEditor
          initial={employee}
          foremen={foremen}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>
    </main>
  );
}
