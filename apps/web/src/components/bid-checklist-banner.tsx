'use client';

// Bid readiness checklist banner.
//
// Sits at the top of the estimate editor, between the header and the
// bid items table. Three visual states:
//
//   green — every item is `pass`. Single-line "ready to submit" banner.
//   yellow — every blocker is `pass` but recommended items are warning.
//            Bid is technically valid; user should still see what's
//            missing before they consider this "done".
//   red — at least one blocker is `fail`. The bid will be rejected at
//          bid open in this state. Banner is loud and lists every issue.
//
// All math comes from `computeBidChecklist` in @yge/shared so the print
// page and the editor stay in sync. Pure presentational — no data
// fetching, no callbacks.

import { useState } from 'react';
import {
  computeBidChecklist,
  type PricedEstimate,
  type PricedEstimateTotals,
} from '@yge/shared';

interface Props {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}

export function BidChecklistBanner({ estimate, totals }: Props) {
  const checklist = computeBidChecklist(estimate, totals);
  const [expanded, setExpanded] = useState<boolean>(
    !checklist.readyToSubmit, // start expanded if anything is failing
  );

  // Pick banner color by worst severity present.
  const tone = !checklist.readyToSubmit
    ? 'red'
    : !checklist.allClear
      ? 'yellow'
      : 'green';

  const toneClasses: Record<typeof tone, string> = {
    green: 'border-green-300 bg-green-50 text-green-900',
    yellow: 'border-yellow-300 bg-yellow-50 text-yellow-900',
    red: 'border-red-300 bg-red-50 text-red-900',
  };

  const toneIcon: Record<typeof tone, string> = {
    green: '\u2713', // check
    yellow: '!',
    red: '\u2717', // X
  };

  const headline = !checklist.readyToSubmit
    ? `Bid is non-responsive — ${checklist.blockerFailCount} blocker${
        checklist.blockerFailCount === 1 ? '' : 's'
      } to fix`
    : !checklist.allClear
      ? `Ready to submit, but ${checklist.recommendedWarnCount} item${
          checklist.recommendedWarnCount === 1 ? '' : 's'
        } you may want to review`
      : 'Ready to submit — every check passes';

  return (
    <section
      className={`rounded-lg border-2 p-4 shadow-sm ${toneClasses[tone]}`}
    >
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
              tone === 'green'
                ? 'bg-green-600 text-white'
                : tone === 'yellow'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-red-600 text-white'
            }`}
          >
            {toneIcon[tone]}
          </span>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide">
              Bid readiness
            </div>
            <div className="text-base font-bold">{headline}</div>
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </header>

      {expanded && (
        <ul className="mt-4 space-y-2 border-t border-current/20 pt-3 text-sm">
          {checklist.items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <ItemMarker status={item.status} severity={item.severity} />
              <div className="flex-1">
                <div className="font-medium">
                  {item.label}
                  {item.severity === 'blocker' &&
                    item.status === 'fail' && (
                      <span className="ml-2 inline-block rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Blocker
                      </span>
                    )}
                </div>
                {item.detail && (
                  <div className="mt-0.5 text-xs opacity-80">{item.detail}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemMarker({
  status,
  severity,
}: {
  status: 'pass' | 'warn' | 'fail';
  severity: 'blocker' | 'recommended';
}) {
  if (status === 'pass') {
    return (
      <span
        aria-label="Pass"
        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white"
      >
        &#10003;
      </span>
    );
  }
  if (status === 'fail') {
    return (
      <span
        aria-label="Fail"
        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white"
      >
        &#10007;
      </span>
    );
  }
  // warn
  return (
    <span
      aria-label={severity === 'blocker' ? 'Blocker warning' : 'Recommended'}
      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-white"
    >
      !
    </span>
  );
}
