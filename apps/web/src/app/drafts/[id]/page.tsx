// /drafts/[id] — full view of one saved Plans-to-Estimate run.
//
// Server component fetches the saved JSON; the DraftView client component
// renders it (and provides the CSV buttons).

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { notFound } from 'next/navigation';
import type { PtoEOutput } from '@yge/shared';
import { classifyOwnerAgency } from '@yge/shared';
import { DraftView } from '@/components/draft-view';
import { ConvertDraftButton } from '@/components/convert-draft-button';
import { DeleteDraftButton } from '@/components/delete-draft-button';
import { OwnerAgencyComplianceCard } from '@/components/owner-agency-compliance-card';
import { ComparableJobsPanel } from '@/components/comparable-jobs-panel';
import { MasterProfileExpiriesTile } from '@/components/master-profile-expiries-tile';
import { ExtensionSnapshotStatusTile } from '@/components/extension-snapshot-status-tile';
import { PrintButton } from '@/components/print-button';
import { SubstationScopeBanner } from '@/components/substation-scope-banner';
import { RoadReconScopeBanner } from '@/components/road-recon-scope-banner';
import { DrainageScopeBanner } from '@/components/drainage-scope-banner';
import { FuelReductionScopeBanner } from '@/components/fuel-reduction-scope-banner';
import { GradingScopeBanner } from '@/components/grading-scope-banner';
import { BridgeScopeBanner } from '@/components/bridge-scope-banner';
import { ScopeCheckSummary } from '@/components/scope-check-summary';
import { getTranslator } from '../../../lib/locale';

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
  const t = getTranslator();
  const saved = await fetchDraft(params.id);
  if (!saved) notFound();

  return (
    <AppShell>
    <style>{`
      @page { margin: 0.6in 0.75in; }
      @media print {
        .no-print { display: none !important; }
        body { background: white !important; }
        details { display: none; }
        details[open] > div { display: block; }
      }
    `}</style>
    <main className="mx-auto max-w-4xl p-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between no-print">
        <Link href="/drafts" className="text-sm text-yge-blue-500 hover:underline">
          {t('draftPg.back')}
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/plans-to-estimate"
            className="text-sm text-yge-blue-500 hover:underline"
          >
            {t('draftPg.newDraft')}
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* Surface expired CSLB / DIR / insurance early in the draft
       *  review, not only at bid-day. The tile self-hides when
       *  everything's current. */}
      <MasterProfileExpiriesTile />

      {/* Likewise show snapshot status — empty fields mean the
       *  extension can't auto-fill them on the eventual bid forms. */}
      <ExtensionSnapshotStatusTile />

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {t('draftPg.savedAt', { when: formatWhen(saved.createdAt) })}
          </p>
          <div className="flex items-start gap-3">
            <ConvertDraftButton
              draftId={saved.id}
              apiBaseUrl={publicApiBaseUrl()}
              preview={{ bidItems: saved.draft.bidItems }}
            />
            <DeleteDraftButton
              draftId={saved.id}
              draftLabel={saved.draft.projectName}
              apiBaseUrl={publicApiBaseUrl()}
              variant="detail"
            />
          </div>
        </div>
        <DraftView
          draft={saved.draft}
          modelUsed={saved.modelUsed}
          promptVersion={saved.promptVersion}
          usage={saved.usage}
          elapsedMs={saved.durationMs}
        />
      </div>

      <div className="mb-6">
        <OwnerAgencyComplianceCard
          classification={classifyOwnerAgency({
            ownerName: saved.draft.ownerAgency,
            documentText: saved.documentText,
          })}
          ownerLabel={saved.draft.ownerAgency}
          projectType={saved.draft.projectType}
        />
      </div>

      <div className="mb-6 space-y-3">
        <ScopeCheckSummary draft={saved.draft} />
        <SubstationScopeBanner draft={saved.draft} />
        <RoadReconScopeBanner draft={saved.draft} />
        <DrainageScopeBanner draft={saved.draft} />
        <FuelReductionScopeBanner draft={saved.draft} />
        <GradingScopeBanner draft={saved.draft} />
        <BridgeScopeBanner draft={saved.draft} />
      </div>

      <div className="mb-6">
        <ComparableJobsPanel draft={saved.draft} />
      </div>

      <details className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700">
          {t('draftPg.originalText', { chars: saved.documentText.length.toLocaleString() })}
        </summary>
        {saved.sessionNotes && (
          <p className="mt-3 rounded bg-yellow-50 p-3 text-sm text-yellow-900">
            <span className="font-semibold">{t('draftPg.sessionNotes')}</span> {saved.sessionNotes}
          </p>
        )}
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 font-mono text-xs text-gray-800">
          {saved.documentText}
        </pre>
      </details>
    </main>
    </AppShell>
  );
}
