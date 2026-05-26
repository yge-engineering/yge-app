// SubstationScopeBanner — surfaces missing substation-civil scope
// items as a red callout on /drafts/[id], right above the comparables
// panel. Renders nothing for non-substation drafts and for complete
// substation drafts.
//
// This is the programmatic safety net behind the
// Plans-to-Estimate prompt's SUBSTATION CIVIL — REQUIRED SCOPE
// CHECKLIST. If the AI omits an item (the Powerline/Allbaugh
// failure mode), this banner catches it before the estimator
// converts the draft into a priced bid.

import {
  checkSubstationCivilScope,
  type SubstationCheckInput,
} from '@yge/shared';

interface Props {
  /** Either a Plans-to-Estimate draft or a priced estimate.
   *  Bundle 2568 widened the helper signature so the same banner
   *  fires on both /drafts/[id] and the bid-day cockpit. */
  draft: SubstationCheckInput;
}

export function SubstationScopeBanner({ draft }: Props) {
  const result = checkSubstationCivilScope(draft);
  if (!result.isSubstationJob) return null;
  if (result.missingItems.length === 0) return null;

  return (
    <section className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
      <header className="mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide">
          ⚠ Substation scope check — {result.missingItems.length} item
          {result.missingItems.length === 1 ? '' : 's'} missing
        </h2>
        <p className="mt-1 text-xs text-red-800">
          This draft pattern-matches as a substation civil job (
          {result.detectedKeywords.slice(0, 3).join(', ')}
          {result.detectedKeywords.length > 3 ? ', ...' : ''}). The AI was
          told to walk a 12-item required-scope checklist. The items below
          do not appear anywhere in the bid items. Confirm the drawings
          DON&apos;T show them before submitting — Powerline/Allbaugh
          went $2.3M over because the AI omitted transformer foundations.
        </p>
      </header>

      <ul className="space-y-2 text-sm">
        {result.missingItems.map((item) => (
          <li key={item.key} className="rounded border border-red-200 bg-white p-2">
            <div className="font-semibold text-red-900">✗ {item.label}</div>
            <div className="mt-1 text-xs text-red-800">{item.whatToCheck}</div>
          </li>
        ))}
      </ul>

      {result.presentItems.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-red-700">
            {result.presentItems.length} item
            {result.presentItems.length === 1 ? '' : 's'} present
          </summary>
          <ul className="mt-2 space-y-1 pl-4 text-red-700">
            {result.presentItems.map((item) => (
              <li key={item.key}>✓ {item.label}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
