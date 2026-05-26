// BridgeScopeBanner — sixth and final archetype banner. Amber
// like road/drainage/fuel/grading.

import { checkBridgeScope, type BridgeCheckInput } from '@yge/shared';

interface Props {
  draft: BridgeCheckInput;
}

export function BridgeScopeBanner({ draft }: Props) {
  const result = checkBridgeScope(draft);
  if (!result.isBridgeJob) return null;
  if (result.missingItems.length === 0) return null;

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <header className="mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide">
          ⚠ Bridge scope check — {result.missingItems.length} item
          {result.missingItems.length === 1 ? '' : 's'} missing
        </h2>
        <p className="mt-1 text-xs text-amber-800">
          This draft pattern-matches as bridge work
          ({result.detectedKeywords.slice(0, 3).join(', ')}
          {result.detectedKeywords.length > 3 ? ', ...' : ''}). Bridge bids
          have many implied structural items the AI may not enumerate —
          confirm before submitting.
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
