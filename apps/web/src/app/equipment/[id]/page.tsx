// /equipment/[id] — full detail + edit + maintenance log + dispatch.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Employee, Equipment, Job } from '@yge/shared';
import { EquipmentEditor } from '@/components/equipment-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchEquipment(id: string): Promise<Equipment | null> {
  const res = await fetch(
    `${apiBaseUrl()}/api/equipment/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { equipment: Equipment };
  return json.equipment;
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

export default async function EquipmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [unit, employees, jobs] = await Promise.all([
    fetchEquipment(params.id),
    fetchEmployees(),
    fetchJobs(),
  ]);
  if (!unit) notFound();

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/equipment" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to equipment
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <EquipmentEditor
          initial={unit}
          employees={employees}
          jobs={jobs}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>
    </main>
  );
}
