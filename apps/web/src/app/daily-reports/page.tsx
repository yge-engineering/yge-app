// /daily-reports — list of every daily report, newest first.
//
// Server component: fetches reports + employees + jobs in parallel so the
// list rows can show foreman names + project names instead of raw ids.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  fullName,
  reportViolations,
  totalReportHours,
  type DailyReport,
  type Employee,
  type Job,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchReports(): Promise<DailyReport[]> {
  const res = await fetch(`${apiBaseUrl()}/api/daily-reports`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { reports: DailyReport[] };
  return json.reports;
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

export default async function DailyReportsPage() {
  const [reports, employees, jobs] = await Promise.all([
    fetchReports(),
    fetchEmployees(),
    fetchJobs(),
  ]);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/daily-reports/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New report
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Daily reports</h1>
      <p className="mt-2 text-gray-700">
        End-of-day summaries from the field. Submitted reports feed time-card
        and certified-payroll reporting (when those modules ship).
      </p>

      {reports.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No daily reports yet. Click <em>New report</em> to start.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Foreman</th>
                <th className="px-4 py-2">Crew</th>
                <th className="px-4 py-2">Total hrs</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => {
                const foreman = empById.get(r.foremanId);
                const job = jobById.get(r.jobId);
                const total = totalReportHours(r);
                const violationCount = reportViolations(r).length;
                return (
                  <tr key={r.id} className={violationCount > 0 ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {job ? (
                        <Link
                          href={`/jobs/${job.id}`}
                          className="text-yge-blue-500 hover:underline"
                        >
                          {job.projectName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">{r.jobId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {foreman ? fullName(foreman) : (
                        <span className="text-gray-400">{r.foremanId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {r.crewOnSite.length}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.submitted ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-green-800">
                          Submitted
                        </span>
                      ) : violationCount > 0 ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-red-800">
                          {violationCount} violation
                          {violationCount === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="rounded bg-gray-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-gray-700">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link
                        href={`/daily-reports/${r.id}`}
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
