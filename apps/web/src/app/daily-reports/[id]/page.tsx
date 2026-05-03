// /daily-reports/[id] — edit one daily report.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuditBinderPanel } from '../../../components';
import type { DailyReport, Employee, Job } from '@yge/shared';
import { DailyReportEditor } from '@/components/daily-report-editor';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchReport(id: string): Promise<DailyReport | null> {
  const res = await fetch(
    `${apiBaseUrl()}/api/daily-reports/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { report: DailyReport };
  return json.report;
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

export default async function DailyReportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [report, employees, jobs] = await Promise.all([
    fetchReport(params.id),
    fetchEmployees(),
    fetchJobs(),
  ]);
  if (!report) notFound();
  const t = getTranslator();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <Link
          href="/daily-reports"
          className="text-sm text-yge-blue-500 hover:underline"
        >
          {t('dailyReportDetail.backLink')}
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <DailyReportEditor
          initial={report}
          employees={employees}
          jobs={jobs}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>

      <AuditBinderPanel entityType="DailyReport" entityId={report.id} />
    </main>
  );
}
