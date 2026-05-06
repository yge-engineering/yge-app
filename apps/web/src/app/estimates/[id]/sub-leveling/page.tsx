// /estimates/[id]/sub-leveling — side-by-side quote comparison for one scope.
//
// Plain English: estimator gets quotes from 3-5 subs for the same
// scope (e.g. "Striping & TC", "Aggregate base"). This page lays
// them out side-by-side, computes deltas vs the low bid, and lets
// the estimator click "Award" on whichever sub they want. The
// awarded value gets copied to the clipboard so they can paste
// into the §4104 sub list editor.
//
// Phase 1 MVP scope: pure client-side worksheet. State doesn't
// persist on the estimate yet — that's the next bundle (subLeveling
// array on PricedEstimate). For now this is a calculator.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, PageHeader } from '../../../../components';
import type { PricedEstimate } from '@yge/shared';
import { SubLevelingClient } from './sub-leveling-client';
import { requirePermission } from '../../../../lib/permissions';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEstimate(id: string): Promise<PricedEstimate | null> {
  const res = await fetch(`${apiBaseUrl()}/api/priced-estimates/${id}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const j = (await res.json()) as { estimate: PricedEstimate };
  return j.estimate;
}

/**
 * Heuristic match for "this scope's awarded bid already lives on the
 * §4104 list". The promote button (bundle 937) doesn't write a back-
 * reference on the SubBid yet, so we identify a match by contractor
 * name + portion of work, both compared case-insensitively after
 * trimming. False positives are possible if two scopes share the
 * same description AND the same awarded contractor — extremely
 * uncommon, and the worst-case symptom is the button stays disabled
 * (no data corruption).
 */
function computePromotedScopeIds(estimate: PricedEstimate): string[] {
  const subBidKeys = new Set(
    estimate.subBids.map((s) =>
      `${s.contractorName.trim().toLowerCase()}|${s.portionOfWork.trim().toLowerCase()}`,
    ),
  );
  const out: string[] = [];
  for (const scope of estimate.subLeveling) {
    if (!scope.awardedBidId) continue;
    const awarded = scope.bids.find((b) => b.id === scope.awardedBidId);
    if (!awarded) continue;
    const key = `${awarded.contractorName.trim().toLowerCase()}|${scope.scope.trim().toLowerCase()}`;
    if (subBidKeys.has(key)) out.push(scope.id);
  }
  return out;
}

export default async function SubLevelingPage({
  params,
}: {
  params: { id: string };
}) {
  requirePermission('estimates:view');
  const estimate = await fetchEstimate(params.id);
  if (!estimate) notFound();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <div className="mb-2 text-xs">
          <Link
            href={`/estimates/${estimate.id}`}
            className="text-blue-700 hover:underline"
          >
            ← Back to estimate
          </Link>
        </div>
        <PageHeader
          title={`Sub-bid leveling — ${estimate.projectName}`}
          subtitle="Compare quotes from competing subs for the same scope, highlight the low bid, and copy the winner into the §4104 sub list."
        />

        <SubLevelingClient
          estimateId={estimate.id}
          initialScopes={estimate.subLeveling}
          initialPromotedScopeIds={computePromotedScopeIds(estimate)}
          apiBaseUrl={
            process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
          }
        />
      </main>
    </AppShell>
  );
}
