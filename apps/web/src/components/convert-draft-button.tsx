'use client';

// "Convert to estimate" button.
//
// Lives on /drafts/[id]. POSTs to the API to clone the draft into an editable
// priced estimate, then pushes the user to /estimates/[newId] where they
// fill in unit prices.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  draftId: string;
  /** Public-facing API URL — passed in from the server component. */
  apiBaseUrl: string;
}

export function ConvertDraftButton({ draftId, apiBaseUrl }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yge-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        title="Clone this draft into an editable priced estimate"
      >
        {loading ? 'Creating estimate…' : 'Convert to priced estimate →'}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-700">Couldn&rsquo;t create the estimate: {error}</p>
      )}
    </div>
  );
}
