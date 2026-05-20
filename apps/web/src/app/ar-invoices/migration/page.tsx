// /ar-invoices/migration — reassign QuickBooks-imported open A/R off the
// 'qbo-migration' sentinel job onto real jobs.

import Link from 'next/link';
import { AppShell, Money, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { QBO_MIGRATION_JOB_ID, type ArInvoice, type Job } from '@yge/shared';
import { MigrationReassignClient } from './migration-reassign-client';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchArInvoices(): Promise<ArInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
  } catch { return []; }
}
async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch { return []; }
}

export default async function ArMigrationReassignPage() {
  requirePermission('financials:view');
  const [invoices, jobs] = await Promise.all([fetchArInvoices(), fetchJobs()]);
  const migration = invoices
    .filter((i) => i.jobId === QBO_MIGRATION_JOB_ID)
    .sort((a, b) => a.customerName.localeCompare(b.customerName));

  const jobOptions = jobs
    .map((j) => ({ id: j.id, projectName: j.projectName }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName));

  const totalCents = migration.reduce((s, i) => s + i.totalCents, 0);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <div className="mb-3">
          <Link href="/ar-invoices" className="text-sm text-yge-blue-500 hover:underline">
            &larr; AR invoices
          </Link>
        </div>
        <PageHeader
          title="Reassign imported A/R to jobs"
          subtitle="Open invoices imported from QuickBooks are parked on a migration job. Move each one onto its real YGE job so job reporting and billing stay accurate."
        />

        {migration.length === 0 ? (
          <div className="rounded border border-green-300 bg-green-50 p-4 text-sm text-green-900">
            Nothing parked on the migration job — every imported invoice has been
            reassigned. 🎉
          </div>
        ) : (
          <>
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              {migration.length} invoice{migration.length === 1 ? '' : 's'} on the
              migration job · <Money cents={totalCents} /> open. Pick a job for each
              and click Move.
            </div>
            <MigrationReassignClient
              apiBaseUrl={publicApiBaseUrl()}
              invoices={migration.map((i) => ({
                id: i.id,
                invoiceNumber: i.invoiceNumber,
                customerName: i.customerName,
                invoiceDate: i.invoiceDate,
                totalCents: i.totalCents,
              }))}
              jobs={jobOptions}
            />
          </>
        )}
      </main>
    </AppShell>
  );
}
