// /jobs/[id]/cost-code-variance — per-cost-code Bid vs Actual table.

import Link from 'next/link';
import { CostCodeVarianceTable } from './cost-code-variance-table';

export default function CostCodeVariancePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={`/jobs/${params.id}`}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          ← Back to job
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">
          Cost-code variance
        </h1>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Per cost code: <b>Bid</b> sums the lines on every imported estimate
        linked to this job; <b>Actual</b> sums the lines on every daily
        report. Variance is Bid &minus; Actual — negative means over budget.
      </p>
      <CostCodeVarianceTable jobId={params.id} />
    </main>
  );
}
