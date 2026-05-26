// GradingScopeBanner — mirror for greenfield grading / mass
// earthwork / pad prep drafts. Amber tone.

import Link from 'next/link';
import { checkGradingScope, type GradingCheckInput } from '@yge/shared';

interface Props {
  draft: GradingCheckInput;
}

export function GradingScopeBanner({ draft }: Props) {
  const result = checkGradingScope(draft);
  if (!result.isGradingJob) return null;
  if (result.missingItems.length === 0) return null;

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <header className="mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide">
          ⚠ Site grading scope check — {result.missingItems.length} item
          {result.missingItems.length === 1 ? '' : 's'} missing
        </h2>
        <p className="mt-1 text-xs text-amber-800">
          This draft pattern-matches as site / mass grading / pad work
          ({result.detectedKeywords.slice(0, 3).join(', ')}
          {result.detectedKeywords.length > 3 ? ', ...' : ''}). When the
          headline cut/fill volume dominates, it&apos;s easy to miss the
          support items below that ride along with every grading job.
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
          href="/scope-checks#grading"
          className="text-xs text-amber-700 underline hover:text-amber-900"
        >
          View scope-check reference →
        </Link>
      </div>
    </section>
  );
}
