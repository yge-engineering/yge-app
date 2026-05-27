'use client';

// MarkPdfFormReviewedButton — flips reviewed=true on a PDF form
// mapping via PATCH /api/pdf-form-mappings/:id, then refreshes
// the page. Shown alongside the "draft, not reviewed" warning
// on the per-form page; once clicked, the form library can
// auto-fill from this mapping without refusing.
//
// Plain-English label so an estimator knows exactly what
// flipping means: "I've checked that every PDF field name + every
// profile-path mapping is correct against the current agency
// PDF."

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  mappingId: string;
  apiBaseUrl: string;
}

export function MarkPdfFormReviewedButton({ mappingId, apiBaseUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        "I've verified every PDF field name and every profile-path " +
          'mapping is correct against the current agency PDF. Mark this ' +
          'form as reviewed?',
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/pdf-form-mappings/${encodeURIComponent(mappingId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewed: true }),
        },
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body.slice(0, 200) || `API returned ${res.status}`);
      }
      // Reload server-rendered page so the warning vanishes.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark reviewed');
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Marking…' : 'Mark this form reviewed'}
      </button>
      {error && (
        <p className="max-w-md text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}
