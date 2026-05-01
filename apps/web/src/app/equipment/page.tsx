// /equipment — heavy iron + vehicle inventory.
//
// Server component fetches equipment + employees + jobs so the dispatch
// dropdown can map ids to human names. Service-due units float to the
// top with a red/yellow flag pill.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  equipmentCategoryLabel,
  equipmentStatusLabel,
  formatUsage,
  fullName,
  isServiceDue,
  serviceDueLevel,
  type Employee,
  type Equipment,
  type Job,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEquipment(): Promise<Equipment[]> {
  const res = await fetch(`${apiBaseUrl()}/api/equipment`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { equipment: Equipment[] }).equipment;
}
async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { employees: Employee[] }).employees;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function EquipmentPage() {
  const [equipment, employees, jobs] = await Promise.all([
    fetchEquipment(),
    fetchEmployees(),
    fetchJobs(),
  ]);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  // Float service-due units to the top.
  const sorted = [...equipment].sort((a, b) => {
    const ad = isServiceDue(a) ? 0 : 1;
    const bd = isServiceDue(b) ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name);
  });

  const dueCount = equipment.filter(isServiceDue).length;
  const assignedCount = equipment.filter((e) => e.status === 'ASSIGNED').length;

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/equipment/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + Add unit
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Equipment + vehicles</h1>
      <p className="mt-2 text-gray-700">
        {equipment.length} unit{equipment.length === 1 ? '' : 's'} on the books
        {' '}&middot; {assignedCount} assigned
        {dueCount > 0 && (
          <>
            {' '}&middot;{' '}
            <span className="text-red-700">{dueCount} due / overdue for service</span>
          </>
        )}
      </p>

      {equipment.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No equipment yet. Click <em>Add unit</em> to start the inventory.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Usage</th>
                <th className="px-4 py-2">Service</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Assignment</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((eq) => {
                const lvl = serviceDueLevel(eq);
                const job = eq.assignedJobId ? jobById.get(eq.assignedJobId) : undefined;
                const op = eq.assignedOperatorEmployeeId
                  ? empById.get(eq.assignedOperatorEmployeeId)
                  : undefined;
                return (
                  <tr
                    key={eq.id}
                    className={
                      lvl === 'overdue'
                        ? 'bg-red-50'
                        : lvl === 'warn'
                          ? 'bg-yellow-50'
                          : ''
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{eq.name}</div>
                      <div className="text-xs text-gray-500">
                        {[eq.year, eq.make, eq.model].filter(Boolean).join(' ')}
                        {eq.plateNumber && (
                          <>
                            {' '}\u00b7 {eq.plateNumber}
                          </>
                        )}
                        {eq.vin && (
                          <>
                            {' '}\u00b7 VIN {eq.vin.slice(-6)}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {equipmentCategoryLabel(eq.category)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatUsage(eq)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <ServicePill eq={eq} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusBadge status={eq.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {job ? (
                        <Link
                          href={`/jobs/${job.id}`}
                          className="text-yge-blue-500 hover:underline"
                        >
                          {job.projectName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                      {op && (
                        <div className="text-xs text-gray-500">
                          Operator: {fullName(op)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link
                        href={`/equipment/${eq.id}`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </AppShell>
  );
}

function ServicePill({ eq }: { eq: Equipment }) {
  const lvl = serviceDueLevel(eq);
  if (lvl === 'none') {
    return <span className="text-gray-400">&mdash;</span>;
  }
  if (lvl === 'overdue') {
    return (
      <span className="rounded bg-red-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-red-800">
        Overdue
      </span>
    );
  }
  if (lvl === 'warn') {
    return (
      <span className="rounded bg-yellow-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-yellow-800">
        Soon
      </span>
    );
  }
  return (
    <span className="rounded bg-green-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-green-800">
      OK
    </span>
  );
}

function StatusBadge({ status }: { status: Equipment['status'] }) {
  const cls =
    status === 'ASSIGNED'
      ? 'bg-blue-100 text-blue-800'
      : status === 'IN_YARD'
        ? 'bg-green-100 text-green-800'
        : status === 'IN_SERVICE'
          ? 'bg-gray-100 text-gray-700'
          : status === 'OUT_FOR_REPAIR'
            ? 'bg-orange-100 text-orange-800'
            : status === 'RETIRED'
              ? 'bg-gray-200 text-gray-600'
              : 'bg-gray-200 text-gray-600';
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${cls}`}
    >
      {equipmentStatusLabel(status)}
    </span>
  );
}
