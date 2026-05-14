// /jobs/[id]/overview-print — one-page job summary, printable.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Job } from '@yge/shared';
import { Letterhead } from '@/components/letterhead';
import { PrintButton } from '@/components/print-button';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { job?: Job }).job ?? null;
  } catch { return null; }
}

interface BudgetActualRow {
  key: string;
  budget: number;
  actual: number;
  variance: number;
  pctUsed: number;
}

interface BudgetActualResp {
  jobNumber: string;
  jobName: string;
  categories: BudgetActualRow[];
  total: { budget: number; actual: number; pctUsed: number };
  status: 'On Track' | 'Watch' | 'Over';
}

async function fetchBudgetActual(id: string): Promise<BudgetActualResp | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}/budget-actual`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as BudgetActualResp;
  } catch { return null; }
}

const LABELS: Record<string, string> = {
  LABOR: 'Labor',
  MATERIALS: 'Materials',
  EQUIPMENT: 'Equipment',
  SUBS: 'Subcontract',
  OTHER: 'Other',
};

export default async function JobOverviewPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const [job, budget] = await Promise.all([fetchJob(params.id), fetchBudgetActual(params.id)]);
  if (!job) notFound();

  return (
    <main className="mx-auto max-w-[8.5in] p-8 print:p-0">
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link
          href={`/jobs/${params.id}`}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          ← Back to job
        </Link>
        <PrintButton label="Print / Save as PDF" />
      </div>

      <Letterhead variant="full" />

      <h1 className="mt-6 text-xl font-bold text-gray-900">
        Job overview — {job.projectName}
      </h1>

      <table className="mt-4 w-full text-sm">
        <tbody>
          <Row label="Owner / agency" value={job.ownerAgency ?? '—'} />
          <Row label="Location" value={job.location ?? '—'} />
          <Row label="Project type" value={job.projectType} />
          <Row label="Contract type" value={job.contractType ?? '—'} />
          <Row label="Status" value={job.status} />
          <Row label="Bid due date" value={job.bidDueDate ?? '—'} />
          <Row
            label="Engineer's estimate"
            value={
              job.engineersEstimateCents
                ? <Money cents={job.engineersEstimateCents} />
                : '—'
            }
          />
          <Row label="Pursuit owner" value={job.pursuitOwner ?? '—'} />
        </tbody>
      </table>

      {budget && budget.total.budget > 0 && (
        <section className="mt-8 break-inside-avoid">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-700">
            Budget vs Actual
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1">Category</th>
                <th className="py-1 text-right">Budget</th>
                <th className="py-1 text-right">Actual</th>
                <th className="py-1 text-right">Variance</th>
                <th className="py-1 text-right">% used</th>
              </tr>
            </thead>
            <tbody>
              {budget.categories.map((c) => (
                <tr key={c.key} className="border-t border-gray-200">
                  <td className="py-1">{LABELS[c.key] ?? c.key}</td>
                  <td className="py-1 text-right font-mono"><Money cents={c.budget} /></td>
                  <td className="py-1 text-right font-mono"><Money cents={c.actual} /></td>
                  <td className={`py-1 text-right font-mono ${c.variance < 0 ? 'text-red-700' : ''}`}><Money cents={c.variance} /></td>
                  <td className={`py-1 text-right font-mono ${c.pctUsed > 1 ? 'text-red-700 font-semibold' : ''}`}>{Math.round(c.pctUsed * 100)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold">
                <td className="py-1">Total</td>
                <td className="py-1 text-right font-mono"><Money cents={budget.total.budget} /></td>
                <td className="py-1 text-right font-mono"><Money cents={budget.total.actual} /></td>
                <td className="py-1 text-right font-mono"><Money cents={budget.total.budget - budget.total.actual} /></td>
                <td className="py-1 text-right font-mono">{Math.round(budget.total.pctUsed * 100)}%</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      {job.notes && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-700">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-xs text-gray-800">{job.notes}</p>
        </section>
      )}

      <p className="mt-10 text-[10px] text-gray-500">
        Generated {new Date().toLocaleString()} · Young General Engineering, Inc.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-1 pr-4 text-gray-700">{label}</td>
      <td className="py-1 font-medium text-gray-900">{value}</td>
    </tr>
  );
}
