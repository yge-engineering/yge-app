// /certified-payrolls/[id] — full CPR editor.

import Link from 'next/link';

import { AppShell, AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { CertifiedPayroll, Employee, Job } from '@yge/shared';
import { CertifiedPayrollEditor } from '@/components/certified-payroll-editor';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchCpr(id: string): Promise<CertifiedPayroll | null> {
  const res = await fetch(`${apiBaseUrl()}/api/certified-payrolls/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { certifiedPayroll: CertifiedPayroll }).certifiedPayroll;
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

export default async function CprDetailPage({ params }: { params: { id: string } }) {
  const t = getTranslator();
  const [cpr, employees, jobs] = await Promise.all([
    fetchCpr(params.id),
    fetchEmployees(),
    fetchJobs(),
  ]);
  if (!cpr) notFound();

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <Link href="/certified-payrolls" className="text-sm text-yge-blue-500 hover:underline">
          {t('newCpr.back')}
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CertifiedPayrollEditor
          initial={cpr}
          employees={employees}
          jobs={jobs}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>

      <AuditBinderPanel entityType="CertifiedPayroll" entityId={cpr.id} />
    </main>
    </AppShell>
  );
}
