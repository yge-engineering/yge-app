// ScopeCheckSummary — header chip above the five archetype
// banners. Runs all five guards and rolls up "N of M scope
// checks passed". Lets the estimator see at a glance whether
// any banner below needs attention, without scrolling.
//
// When no guard fires (none of the five archetypes match),
// renders a neutral "No scope check applies — review manually"
// note. When all firing guards pass, green. When any has
// missing items, amber/red badge.

import {
  checkBridgeScope,
  checkDrainageScope,
  checkFuelReductionScope,
  checkGradingScope,
  checkRoadReconScope,
  checkSubstationCivilScope,
  type SubstationCheckInput,
} from '@yge/shared';

interface Props {
  draft: SubstationCheckInput & { projectType?: string };
}

interface GuardSummary {
  key: string;
  label: string;
  fired: boolean;
  missingCount: number;
  presentCount: number;
}

export function ScopeCheckSummary({ draft }: Props) {
  const guards: GuardSummary[] = [
    summarize('substation', 'Substation civil', checkSubstationCivilScope(draft), 'isSubstationJob'),
    summarize('road-recon', 'Road / overlay', checkRoadReconScope(draft), 'isRoadJob'),
    summarize('drainage', 'Drainage / storm', checkDrainageScope(draft), 'isDrainageJob'),
    summarize('fuel-reduction', 'Fuel reduction', checkFuelReductionScope(draft), 'isFuelReductionJob'),
    summarize('grading', 'Site grading', checkGradingScope(draft), 'isGradingJob'),
    summarize('bridge', 'Bridge', checkBridgeScope(draft), 'isBridgeJob'),
  ];

  const firingGuards = guards.filter((g) => g.fired);
  const guardsWithGaps = firingGuards.filter((g) => g.missingCount > 0);

  // No guard applies → neutral panel
  if (firingGuards.length === 0) {
    return (
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        No archetype scope check applies to this draft. The six guards
        (substation, road, drainage, fuel reduction, grading, bridge)
        didn&apos;t recognize the project type or keywords — review the bid
        items against the plan set manually.
      </section>
    );
  }

  // All firing guards passed → green
  if (guardsWithGaps.length === 0) {
    return (
      <section className="rounded-lg border border-green-300 bg-green-50 p-3 text-xs text-green-800">
        <span className="font-semibold">
          ✓ All {firingGuards.length} scope check
          {firingGuards.length === 1 ? '' : 's'} passed
        </span>
        {' — '}
        {firingGuards.map((g) => g.label).join(', ')}.
      </section>
    );
  }

  // Mixed → amber summary
  const totalMissing = guardsWithGaps.reduce((acc, g) => acc + g.missingCount, 0);
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      <div className="font-semibold">
        ⚠ {totalMissing} scope item{totalMissing === 1 ? '' : 's'} flagged across{' '}
        {guardsWithGaps.length} archetype{guardsWithGaps.length === 1 ? '' : 's'}
      </div>
      <ul className="mt-1 space-y-0.5">
        {guardsWithGaps.map((g) => (
          <li key={g.key}>
            <span className="font-medium">{g.label}:</span> {g.missingCount}{' '}
            missing
            {g.presentCount > 0 && ` (${g.presentCount} present)`}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-amber-700">See per-archetype banners below for details.</p>
    </section>
  );
}

function summarize<
  K extends
    | 'isSubstationJob'
    | 'isRoadJob'
    | 'isDrainageJob'
    | 'isFuelReductionJob'
    | 'isGradingJob'
    | 'isBridgeJob',
>(
  key: string,
  label: string,
  result: {
    missingItems: ReadonlyArray<unknown>;
    presentItems: ReadonlyArray<unknown>;
  } & Record<K, boolean>,
  flagKey: K,
): GuardSummary {
  const fired = Boolean(result[flagKey]);
  return {
    key,
    label,
    fired,
    missingCount: fired ? result.missingItems.length : 0,
    presentCount: fired ? result.presentItems.length : 0,
  };
}
