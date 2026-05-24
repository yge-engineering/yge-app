'use client';

// "Convert to estimate" button.
//
// Lives on /drafts/[id]. POSTs to the API to clone the draft into an editable
// priced estimate, then pushes the user to /estimates/[newId] where they
// fill in unit prices.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PtoEBidItem } from '@yge/shared';
import { formatUSD, sumPtoEBidTotalCents } from '@yge/shared';
import { useTranslator } from '../lib/use-translator';

interface Props {
  draftId: string;
  /** Public-facing API URL — passed in from the server component. */
  apiBaseUrl: string;
  /** Optional preview of what gets carried over. When provided, a small
   *  caption above the button tells the user how many items are priced
   *  and what the starting bid total will be. Pass undefined to suppress
   *  the preview (older callers stay unchanged). */
  preview?: { bidItems: PtoEBidItem[] };
}

export function ConvertDraftButton({ draftId, apiBaseUrl, preview }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslator();

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/priced-estimates/from-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDraftId: draftId }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as { estimate: { id: string } };
      router.push(`/estimates/${json.estimate.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('convertDraft.unknown'));
      setLoading(false);
    }
  }

  // Compute the one-line preview from the draft items if the caller
  // supplied them. Done here (not in render) to keep the JSX terse.
  const previewLine = (() => {
    if (!preview) return null;
    const items = preview.bidItems;
    const total = items.length;
    if (total === 0) return null;
    const pricedCount = items.filter(
      (i) => i.estimatedUnitPriceCents != null,
    ).length;
    if (pricedCount === 0) return t('convertDraft.previewUnpriced');
    const grand = sumPtoEBidTotalCents(items);
    return t('convertDraft.previewPriced', {
      priced: String(pricedCount),
      total: String(total),
      amount: formatUSD(grand, { compact: true }),
    });
  })();

  return (
    <div className="text-right">
      {previewLine && (
        <p className="mb-1 text-xs text-gray-600">{previewLine}</p>
      )}
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yge-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        title={t('convertDraft.title')}
      >
        {loading ? t('convertDraft.busy') : t('convertDraft.action')}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-700">{t('convertDraft.error', { message: error })}</p>
      )}
    </div>
  );
}
