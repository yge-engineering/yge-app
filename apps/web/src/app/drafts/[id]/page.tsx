// /drafts/[id] — full view of one saved Plans-to-Estimate run.
//
// Server component fetches the saved JSON; the DraftView client component
// renders it (and provides the CSV buttons).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PtoEOutput } from '@yge/shared';
import { DraftView } from '@/components/draft-view';
import { ConvertDraftButton } from '@/components/convert-draft-button';

interface SavedDraft {
  id: string;
  createdAt: string;
  jobId: string;
  modelUsed: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
  documentText: string;
  sessionNotes?: string;
  draft: PtoEOutput;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

// Browser-facing URL — the convert button POSTs from the user's browser, not
// from the Next.js server.
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchDraft(id: string): Promise<SavedDraft | null> {
  const res = await fetch(`${apiBaseUrl()}/api/plans-to-estimate/drafts/${id}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { draft: SavedDraft };
  return json.draft;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function DraftDetailPage({ params }: { params: { id: string } }) {
  const saved = await fetchDraft(params.id);
  if (!saved) notFound();

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/drafts" className="text-sm text-yge-blue-500 hover:underline">
          &larr; All saved drafts
        </Link>
        <Link
          href="/plans-to-estimate"
          className="text-sm text-yge-blue-500 hover:underline"
        >
          New draft &rarr;
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Saved {formatWhen(saved.createdAt)}
          </p>
          <ConvertDraftButton draftId={saved.id} apiBaseUrl={publicApiBaseUrl()} />
        </div>
        <DraftView
          draft={saved.draft}
          modelUsed={saved.modelUsed}
          promptVersion={saved.promptVersion}
          usage={saved.usage}
          elapsedMs={saved.durationMs}
        />
      </div>

      <details className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700">
          Original document text ({saved.documentText.length.toLocaleString()} chars)
        </summary>
        {saved.sessionNotes && (
          <p className="mt-3 rounded bg-yellow-50 p-3 text-sm text-yellow-900">
            <span className="font-semibold">Session notes:</span> {saved.sessionNotes}
          </p>
        )}
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 font-mono text-xs text-gray-800">
          {saved.documentText}
        </pre>
      </details>
    </main>
  );
}
