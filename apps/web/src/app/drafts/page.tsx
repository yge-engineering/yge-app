// /drafts — list every saved Plans-to-Estimate run.
//
// Server component: it fetches the summary list from the API at request time,
// no client JS needed for the index view. The detail page (/drafts/[id]) is
// where the interactive client component takes over.

import Link from 'next/link';

import { Alert, AppShell } from '../../components';
import { relativeTime } from '../../lib/relative-time';
import { DraftsSearchInput } from '../../components/drafts-search-input';
import { projectTypeIcon } from '../../lib/project-type-icon';
import { DashboardRefreshButton } from '../../components/dashboard-refresh-button';
import { DraftsPinButton, DraftsPinReorder } from '../../components/drafts-pin-button';
import { DraftsPinFilterChip } from '../../components/drafts-pin-filter-chip';
import { EstimatesKeyboardNav } from '../../components/estimates-keyboard-nav';
import { PinnedCountBadge } from '../../components/pinned-count-badge';
import { EstimatesSortHeaders } from '../../components/estimates-sort-headers';
import { getTranslator } from '../../lib/locale';

interface DraftSummary {
  id: string;
  createdAt: string;
  jobId: string;
  projectName: string;
  projectType: string;
  ownerAgency?: string;
  location?: string;
  bidDueDate?: string;
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  bidItemCount: number;
  modelUsed: string;
  promptVersion: string;
}

// Server-side fetches need an absolute URL. Prefer the server-only API_URL,
// fall back to the public one (still works on the Mac when both run locally).
function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

// Browser-facing API URL — the CSV download is fetched directly from the user's
// browser, not from the Next.js server, so it must use the public URL.
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchDrafts(): Promise<DraftSummary[]> {
  const res = await fetch(`${apiBaseUrl()}/api/plans-to-estimate/drafts`, {
    // Always fresh — the list changes every time a new draft is saved.
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }
  const json = (await res.json()) as { drafts: DraftSummary[] };
  return json.drafts;
}

const CONFIDENCE_STYLES = {
  HIGH: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-red-100 text-red-800',
} as const;

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

export default async function DraftsPage() {
  let drafts: DraftSummary[] = [];
  let fetchError: string | null = null;
  try {
    drafts = await fetchDrafts();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown error';
  }
  const t = getTranslator();

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
          &larr; Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <DashboardRefreshButton />
          <Link href="/plans-to-estimate" className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
            {t('drafts.newDraft')} &rarr;
          </Link>
        </div>
      </div>

      <div className="flex items-center"><h1 className="text-3xl font-bold text-yge-blue-500">{t('drafts.title')}</h1><PinnedCountBadge storageKey="yge.drafts.pinnedIds" eventName="yge:drafts-pinned-changed" /></div>
      <p className="mt-2 text-gray-700">{t('drafts.subtitle')}</p>

      {fetchError && (
        <Alert tone="danger" className="mt-6" title={t('drafts.fetchError.title')}>
          {fetchError}. Make sure the API server is running on port 4000.
        </Alert>
      )}

      {!fetchError && drafts.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-700">{t('drafts.empty')}</p>
          <Link
            href="/plans-to-estimate"
            className="mt-4 inline-block rounded-md bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yge-blue-700"
          >
            + Start AI draft
          </Link>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <DraftsSearchInput targetId="drafts-table" totalCount={drafts.length} />
            <DraftsPinFilterChip targetId="drafts-table" />
          </div>
          <EstimatesSortHeaders targetId="drafts-table" />
          <DraftsPinReorder targetId="drafts-table" />
          <EstimatesKeyboardNav targetId="drafts-table" />
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table id="drafts-table" className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th data-sort-key="name" className="select-none px-4 py-2 hover:bg-gray-100">
                  {t('drafts.col.project')}
                  <span className="sort-arrow" />
                </th>
                <th className="px-4 py-2">{t('drafts.col.type')}</th>
                <th data-sort-key="cents" className="select-none px-4 py-2 hover:bg-gray-100">
                  {t('drafts.col.items')}
                  <span className="sort-arrow" />
                </th>
                <th className="px-4 py-2">{t('drafts.col.confidence')}</th>
                <th data-sort-key="updated" className="select-none px-4 py-2 hover:bg-gray-100">
                  {t('drafts.col.saved')}
                  <span className="sort-arrow" />
                </th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drafts.map((d) => (
                <tr
                  key={d.id}
                  data-id={d.id}
                  data-search={`${d.projectName} ${d.ownerAgency ?? ''} ${d.projectType.replace(/_/g, ' ')}`}
                  data-sort-name={d.projectName.toLowerCase()}
                  data-sort-cents={d.bidItemCount}
                  data-sort-updated={d.createdAt}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      <DraftsPinButton draftId={d.id} />
                      <Link
                        href={`/drafts/${d.id}`}
                        className="text-gray-900 hover:text-yge-blue-700 hover:underline"
                      >
                        {d.projectName}
                      </Link>
                      <span className="ml-2 inline-block rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                        🤖 AI
                      </span>
                    </div>
                    {d.ownerAgency && (
                      <div className="text-xs text-gray-500">{d.ownerAgency}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <span className="mr-1">{projectTypeIcon(d.projectType)}</span>
                    {d.projectType.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{d.bidItemCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CONFIDENCE_STYLES[d.overallConfidence]}`}
                    >
                      {d.overallConfidence}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600" title={formatWhen(d.createdAt)}>
                    {relativeTime(d.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link href={`/drafts/${d.id}`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
                        {t('drafts.action.open')}
                      </Link>
                      <a
                        href={`${publicApiBaseUrl()}/api/plans-to-estimate/drafts/${d.id}/export.csv`}
                        className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
                      >
                        {t('drafts.action.csv')}
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </main>
    </AppShell>
  );
}
