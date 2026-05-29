// /estimates/[id]/ai-review — AI-driven pre-submit bid review.
//
// Plain English: Claude reads our priced estimate (bid items, sub
// list, addenda, markup, bid security) and returns a structured
// readiness verdict + per-line flags. Designed for the
// "I'm about to seal the envelope — what am I missing?" moment.
//
// The AI server-side route (POST /api/priced-estimates/:id/review)
// was built months ago and has been sitting unmounted in the API
// codebase. This page is the final wire-up that lets Ryan trigger
// it from the browser.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, PageHeader } from '../../../../components';
import { PrintButton } from '../../../../components/print-button';
import { AiReviewClient } from './ai-review-client';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface FullResponse {
  estimate: { id: string; projectName: string; projectType?: string; ownerAgency?: string | null };
}

async function fetchEstimateMeta(id: string): Promise<FullResponse['estimate'] | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/priced-estimates/${id}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return ((await res.json()) as FullResponse).estimate;
  } catch {
    return null;
  }
}

export default async function AiReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const est = await fetchEstimateMeta(params.id);
  if (!est) notFound();

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between text-sm">
          <Link
            href={`/estimates/${est.id}`}
            className="text-yge-blue-500 hover:underline"
          >
            &larr; Back to estimate
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={`/estimates/${est.id}/bid-day`}
              className="text-yge-blue-500 hover:underline"
            >
              Bid-day cockpit →
            </Link>
            <PrintButton label="Print review" />
          </div>
        </div>

        <PageHeader
          title={`AI bid review — ${est.projectName}`}
          subtitle="Pre-submit critique by Claude. Run before sealing the envelope; the model flags unpriced lines, suspicious unit costs, missing bid security, un-acknowledged addenda, and §4104 sub list gaps. Not a substitute for human review — it's a second pair of eyes."
        />

        <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Heads up:</strong> the AI sees a trimmed snapshot of the
          estimate (bid items, sub list, addenda, markup, bid security). It
          does NOT see plan-set PDFs or cost build-ups. Treat every flag as
          a hypothesis to verify, not a deletion request.
        </p>

        <AiReviewClient estimateId={est.id} apiBaseUrl={publicApiBaseUrl()} />

        <p className="mt-8 text-xs text-gray-500">
          Powered by Claude via the Anthropic API. Prompt version is logged
          server-side with every run. The reviewer sees no plan PDFs and
          no customer PII beyond the trimmed estimate shape.
        </p>
      </main>
    </AppShell>
  );
}
