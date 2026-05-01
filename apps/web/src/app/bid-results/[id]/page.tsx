// /bid-results/[id] — edit a bid result; bidder list editor + outcome.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { notFound } from 'next/navigation';
import type { BidResult, Job } from '@yge/shared';
import { BidResultEditor } from '@/components/bid-result-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchResult(id: string): Promise<BidResult | null> {
  const res = await fetch(
    `${apiBaseUrl()}/api/bid-results/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { result: BidResult };
  return json.result;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function BidResultDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [result, jobs] = await Promise.all([
    fetchResult(params.id),
    fetchJobs(),
  ]);
  if (!result) notFound();
  const job = jobs.find((j) => j.id === result.jobId);

  return (
    <AppShell>
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/bid-results" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to bid results
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <BidResultEditor
          initial={result}
          job={job}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>
    </main>
    </AppShell>
  );
}
