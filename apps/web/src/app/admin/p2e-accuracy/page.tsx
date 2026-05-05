// /admin/p2e-accuracy — historical Plans-to-Estimate AI verdicts.
//
// Plain English: aggregates the JSONL feedback log written by the
// P2eFeedbackCard. Owners + office see a count breakdown by verdict
// + the last N entries with reviewer notes. Future: per-prompt-version
// cohort comparison once we have multiple versions in flight.

import Link from 'next/link';

import { AppShell, Card, PageHeader, Tile } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Entry {
  id: string;
  loggedAt: string;
  byEmail?: string;
  draftId?: string;
  estimateId?: string;
  kind: 'good' | 'bad' | 'mixed';
  notes?: string;
  promptVersion?: string;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEntries(): Promise<Entry[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/p2e-feedback`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { entries?: Entry[] };
    return j.entries ?? [];
  } catch {
    return [];
  }
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

export default async function P2eAccuracyPage() {
  // Audit:view is the closest-fit cap (analytics on a system-wide
  // log). Owners + office have it; PMs + foremen + crew don't.
  requirePermission('audit:view');

  const entries = await fetchEntries();
  // Newest first.
  entries.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  const total = entries.length;
  const good = entries.filter((e) => e.kind === 'good').length;
  const mixed = entries.filter((e) => e.kind === 'mixed').length;
  const bad = entries.filter((e) => e.kind === 'bad').length;
  const acceptanceRate =
    total === 0 ? null : (good + mixed * 0.5) / total;

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Plans-to-Estimate accuracy"
          subtitle="What estimators thought of the AI drafts. Captured from the thumbs / mixed / bad buttons on /estimates/[id]."
        />

        {total === 0 ? (
          <Card>
            <p className="text-sm text-gray-600">
              No feedback recorded yet. Reviewers see the prompt below the
              estimate editor on /estimates/[id] when the estimate came from
              an AI-generated draft.
            </p>
          </Card>
        ) : (
          <>
            <section className="mb-6 grid gap-3 sm:grid-cols-4">
              <Tile label="Total verdicts" value={total} />
              <Tile label="👍 Good" value={good} tone="success" />
              <Tile label="🤔 Mixed" value={mixed} tone="warn" />
              <Tile label="👎 Bad" value={bad} tone="danger" />
            </section>

            {acceptanceRate !== null && (
              <Card className="mb-6">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Weighted acceptance rate
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {(acceptanceRate * 100).toFixed(1)}%
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Good = 1.0 · Mixed = 0.5 · Bad = 0.0. A score below ~70%
                  means the prompt is leaving too many corrections to humans.
                </p>
              </Card>
            )}

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                Last {Math.min(50, entries.length)} verdicts
              </h2>
              <ul className="divide-y divide-gray-100">
                {entries.slice(0, 50).map((e) => {
                  const tone =
                    e.kind === 'good'
                      ? 'text-green-700'
                      : e.kind === 'bad'
                        ? 'text-red-700'
                        : 'text-amber-700';
                  return (
                    <li key={e.id} className="py-2 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs ${tone}`}>
                            {e.kind.toUpperCase()}
                          </span>
                          {e.estimateId && (
                            <Link
                              href={`/estimates/${e.estimateId}`}
                              className="text-blue-700 hover:underline"
                            >
                              {e.estimateId}
                            </Link>
                          )}
                          {e.byEmail && (
                            <span className="text-xs text-gray-500">
                              · {e.byEmail}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatWhen(e.loggedAt)}
                          {e.promptVersion ? ` · ${e.promptVersion}` : ''}
                        </span>
                      </div>
                      {e.notes && (
                        <p className="mt-1 text-xs text-gray-700">{e.notes}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </>
        )}
      </main>
    </AppShell>
  );
}
