// RoadReconScopeBanner — surfaces missing road-reconstruction
// scope items as a callout on /drafts/[id] and the bid-day
// cockpit. Parallel of SubstationScopeBanner.
//
// Catches when the AI drafts a road / overlay job and omits
// items the agency plans almost certainly call for (ADA ramps,
// traffic control, striping, SWPPP, etc.). Renders nothing for
// non-road drafts or complete road drafts.

import {
  checkRoadReconScope,
  type RoadReconCheckInput,
} from '@yge/shared';

interface Props {
  draft: RoadReconCheckInput;
}

export function RoadReconScopeBanner({ draft }: Props) {
  const result = checkRoadReconScope(draft);
  if (!result.isRoadJob) return null;
  if (result.missingItems.length === 0) return null;

  // Amber instead of red — these items are "almost always
  // present" but each one has a legitimate reason to be absent
  // (no signalized intersection on the project → no signage,
  // for example). Substation's red tone is reserved for the
  // big-dollar Powerline/Allbaugh pattern.
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <header className="mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide">
          ⚠ Road / overlay scope check — {result.missingItems.length} item
          {result.missingItems.length === 1 ? '' : 's'} missing
        </h2>
        <p className="mt-1 text-xs text-amber-800">
          This draft pattern-matches as a road reconstruction or overlay job
          ({result.detectedKeywords.slice(0, 3).join(', ')}
          {result.detectedKeywords.length > 3 ? ', ...' : ''}). The items
          below are almost always in scope for road work — confirm the plans
          don&apos;t need them before submitting.
        </p>
      </header>

      <ul className="space-y-2 text-sm">
        {result.missingItems.map((item) => (
          <li key={item.key} className="rounded border border-amber-200 bg-white p-2">
            <div className="font-semibold">⚠ {item.label}</div>
            <div className="mt-1 text-xs text-amber-800">{item.whatToCheck}</div>
          </li>
        ))}
      </ul>

      {result.presentItems.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-amber-700">
            {result.presentItems.length} item
            {result.presentItems.length === 1 ? '' : 's'} present
          </summary>
          <ul className="mt-2 space-y-1 pl-4 text-amber-700">
            {result.presentItems.map((item) => (
              <li key={item.key}>✓ {item.label}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
