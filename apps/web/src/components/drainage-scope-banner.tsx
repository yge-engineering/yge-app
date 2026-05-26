// DrainageScopeBanner — mirror of road-recon banner for drainage
// / culvert / storm jobs. Amber tone (same as road).

import Link from 'next/link';
import { checkDrainageScope, type DrainageCheckInput } from '@yge/shared';

interface Props {
  draft: DrainageCheckInput;
}

export function DrainageScopeBanner({ draft }: Props) {
  const result = checkDrainageScope(draft);
  if (!result.isDrainageJob) return null;
  if (result.missingItems.length === 0) return null;

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <header className="mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide">
          ⚠ Drainage / storm scope check — {result.missingItems.length} item
          {result.missingItems.length === 1 ? '' : 's'} missing
        </h2>
        <p className="mt-1 text-xs text-amber-800">
          This draft pattern-matches as a drainage / culvert / storm job
          ({result.detectedKeywords.slice(0, 3).join(', ')}
          {result.detectedKeywords.length > 3 ? ', ...' : ''}). The items
          below typically ride along with the pipe itself — confirm the
          plans don&apos;t need them before submitting.
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

      <div className="mt-3 text-right">
        <Link
          href="/scope-checks#drainage"
          className="text-xs text-amber-700 underline hover:text-amber-900"
        >
          View scope-check reference →
        </Link>
      </div>
    </section>
  );
}
