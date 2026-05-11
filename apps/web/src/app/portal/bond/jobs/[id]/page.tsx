// /portal/bond/jobs/[id] — bond-relevant per-job summary.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Money } from '../../../../../components/money';
import { currentUserCan } from '../../../../../lib/permissions';
import { type ChangeOrder, type Job } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { job?: Job };
    return body.job ?? null;
  } catch {
    return null;
  }
}

async function fetchChangeOrders(): Promise<ChangeOrder[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/change-orders`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { orders: ChangeOrder[] }).orders;
  } catch {
    return [];
  }
}

export default async function BondJobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!currentUserCan('portal:bond')) {
    redirect('/login');
  }
  const [job, allCos] = await Promise.all([
    fetchJob(params.id),
    fetchChangeOrders(),
  ]);
  if (!job) notFound();

  const cos = allCos.filter((c) => c.jobId === params.id);
  const approvedCos = cos.filter(
    (c) => c.status === 'APPROVED' || c.status === 'EXECUTED',
  );
  const totalCoImpact = approvedCos.reduce(
    (s, c) => s + c.totalCostImpactCents,
    0,
  );
  const additiveCount = approvedCos.filter(
    (c) => c.totalCostImpactCents > 0,
  ).length;
  const deductiveCount = approvedCos.filter(
    (c) => c.totalCostImpactCents < 0,
  ).length;

  const baseAmount = job.engineersEstimateCents ?? 0;
  const currentAmount = baseAmount + totalCoImpact;
  const coPercent = baseAmount > 0 ? totalCoImpact / baseAmount : 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/portal/bond"
            className="text-xs text-yge-blue-700 hover:underline"
          >
            ← Back to bond portal
          </Link>
          <h1 className="mt-1 text-xl font-bold text-yge-blue-900">
            {job.projectName}
          </h1>
          <p className="text-xs text-gray-600">
            {job.ownerAgency ?? ''}
            {job.location ? ` · ${job.location}` : ''}
            {' · status '}
            {job.status}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-4 px-6 py-6">
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Contract amount tracking
          </h2>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Base contract</div>
              <div className="mt-1 font-mono text-lg font-bold">
                <Money cents={baseAmount} />
              </div>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">CO impact</div>
              <div
                className={`mt-1 font-mono text-lg font-bold ${
                  totalCoImpact > 0
                    ? 'text-amber-800'
                    : totalCoImpact < 0
                      ? 'text-red-700'
                      : 'text-gray-700'
                }`}
              >
                <Money cents={totalCoImpact} />
              </div>
              <div className="text-[11px] text-gray-500">
                {additiveCount} additive · {deductiveCount} deductive
              </div>
            </div>
            <div className="rounded border border-yge-blue-300 bg-yge-blue-50 p-3">
              <div className="text-xs text-yge-blue-900">Current total</div>
              <div className="mt-1 font-mono text-lg font-bold text-yge-blue-900">
                <Money cents={currentAmount} />
              </div>
              {baseAmount > 0 ? (
                <div className="text-[11px] text-gray-700">
                  {coPercent >= 0 ? '+' : ''}
                  {(coPercent * 100).toFixed(1)}% vs base
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Schedule
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Bid due</dt>
              <dd className="font-mono">{job.bidDueDate ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Status</dt>
              <dd>{job.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Project type</dt>
              <dd>{job.projectType}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Contract type</dt>
              <dd>{job.contractType}</dd>
            </div>
          </dl>
        </section>

        <p className="text-[11px] text-gray-500">
          For real-time progress + photos, ask the YGE PM
          {job.pursuitOwner ? ` (${job.pursuitOwner})` : ''} for owner-
          portal access to this project. The bond view is intentionally
          financials-only.
        </p>
      </div>
    </main>
  );
}
