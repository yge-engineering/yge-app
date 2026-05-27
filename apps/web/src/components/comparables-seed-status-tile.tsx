import * as React from 'react';
import { isNextInternalError } from '../lib/next-control-flow';

// Comparables-seed status tile.
//
// Reads the hand-curated YGE_JOB_HISTORY_SEED from /lib and
// surfaces a "Comparables sparse — add more past jobs" warning
// when fewer than 3 entries are seeded. Pairs with the
// comparables panel on /drafts/[id] + bid-day, which gets
// dramatically more useful as the seed grows.
//
// Why this matters for priority #5: the AI + estimator can
// reality-check a draft against past YGE jobs, but only if
// past jobs are in the seed. The tile prods Ryan to keep
// adding them.

import Link from 'next/link';

import { YGE_JOB_HISTORY_SEED } from '../lib/yge-job-history-seed';

const MIN_SEED_FOR_USEFUL_COMPARABLES = 3;

export function ComparablesSeedStatusTile(): React.ReactElement | null {
  try {
    const count = YGE_JOB_HISTORY_SEED.length;
    if (count >= MIN_SEED_FOR_USEFUL_COMPARABLES) {
      // Healthy state — no tile clutter.
      return null;
    }
    return (
      <section className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <header className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Comparables sparse
          </h2>
          <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold">
            {count} of {MIN_SEED_FOR_USEFUL_COMPARABLES}+ seeded
          </span>
        </header>
        <p className="text-xs">
          The comparables panel on /drafts/[id] and the bid-day cockpit
          gets dramatically more useful as the YGE past-job seed grows.
          Today {count === 0 ? 'no past jobs are seeded' : `only ${count} past job ${count === 1 ? 'is' : 'are'} seeded`}.
        </p>
        <p className="mt-2 text-xs">
          <span className="font-semibold">To add more:</span> edit{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">
            apps/web/src/lib/yge-job-history-seed.ts
          </code>{' '}
          with project name, agency, scope keywords, county, bid total,
          actual cost, outcome, lessons learned. Each new entry feeds
          both the UI panel and the AI prompt's reality-check context.
        </p>
        <div className="mt-3">
          <Link
            href="/comparables"
            className="text-xs font-semibold text-amber-900 underline hover:text-amber-700"
          >
            See seed audit table →
          </Link>
        </div>
      </section>
    );
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[ComparablesSeedStatusTile] render failed:', err);
    return null;
  }
}
