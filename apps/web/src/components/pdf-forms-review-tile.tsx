import * as React from 'react';
import { isNextInternalError } from '../lib/next-control-flow';

// PDF-forms review-queue dashboard tile.
//
// The 21 seeded PDF form mappings all start `reviewed: false`
// and the form filler refuses to auto-fill unreviewed mappings
// (intentional safety — every seed has placeholder field names
// that need cross-checking against the real agency PDF first).
//
// This tile surfaces "X of Y forms reviewed" on the dashboard
// so the office burndown is visible. Hides itself once the
// queue is empty.

import Link from 'next/link';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface FormMappingSummary {
  id: string;
  reviewed?: boolean;
}

async function fetchMappings(): Promise<FormMappingSummary[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/pdf-form-mappings`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { mappings?: FormMappingSummary[] };
    return json.mappings ?? [];
  } catch {
    return [];
  }
}

async function PdfFormsReviewTileInner(): Promise<React.ReactElement | null> {
  const mappings = await fetchMappings();
  if (mappings.length === 0) return null;

  const reviewed = mappings.filter((m) => m.reviewed).length;
  const total = mappings.length;
  const unreviewed = total - reviewed;

  if (unreviewed === 0) {
    // Queue empty — silent tile.
    return null;
  }

  return (
    <section className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          PDF form review queue
        </h2>
        <Link
          href="/pdf-forms?reviewed=false"
          className="rounded border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
        >
          Open queue →
        </Link>
      </header>
      <p className="text-xs">
        <span className="font-semibold">{unreviewed}</span> of {total} mapped
        agency forms are still unreviewed. The form filler refuses to auto-
        fill an unreviewed mapping (every seed has placeholder field names
        that need cross-checking against the real agency PDF first). Walk
        the queue when you have a few minutes.
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-200">
        <div
          className="h-full bg-amber-600"
          style={{ width: `${Math.round((reviewed / total) * 100)}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-amber-700">
        {reviewed} of {total} reviewed ({Math.round((reviewed / total) * 100)}%)
      </div>
    </section>
  );
}

export async function PdfFormsReviewTile(): Promise<React.ReactElement | null> {
  try {
    return await PdfFormsReviewTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[PdfFormsReviewTile] render failed:', err);
    return null;
  }
}
