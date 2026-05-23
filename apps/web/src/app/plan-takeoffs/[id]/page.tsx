// /plan-takeoffs/[id] — view a PDF takeoff.
//
// Renders the PDF in <PlanViewer/>. Measurement tools come in the next
// bundle. For pre-takeoff testing the page accepts a `?url=` override that
// loads any PDF URL directly.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, PageHeader } from '../../../components';
import { PlanViewer } from '../../../components/plan-viewer';
import { requirePermission } from '../../../lib/permissions';
import type { PlanTakeoff } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchTakeoff(id: string): Promise<PlanTakeoff | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/plan-takeoffs/${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return ((await res.json()) as { takeoff: PlanTakeoff }).takeoff;
  } catch {
    return null;
  }
}

export default async function PlanTakeoffDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { url?: string };
}) {
  requirePermission('estimates:view');
  const takeoff = await fetchTakeoff(params.id);
  const overrideUrl = searchParams.url;
  if (!takeoff && !overrideUrl) notFound();
  const pdfUrl = overrideUrl ?? takeoff?.planRef ?? '';
  const sheetsCount = takeoff?.sheets.length ?? 0;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={takeoff?.name ?? 'Plan viewer'}
          subtitle="Page navigation and zoom. Measurement tools land in the next bundle."
        />
        <div className="mb-3 text-xs text-gray-600">
          <Link href="/plan-takeoffs" className="text-blue-700 hover:underline">
            ← Back to takeoffs
          </Link>
          {takeoff ? (
            <span className="ml-3 text-gray-500">
              {sheetsCount} sheet{sheetsCount === 1 ? '' : 's'} with measurements
              {takeoff.bidId ? ` · bid ${takeoff.bidId}` : ''}
              {takeoff.jobId ? ` · job ${takeoff.jobId}` : ''}
            </span>
          ) : null}
        </div>
        <PlanViewer url={pdfUrl} />
        {!takeoff && overrideUrl ? (
          <p className="mt-3 text-xs text-gray-500">
            Viewing via <code className="font-mono">?url=</code> override — no takeoff record loaded.
          </p>
        ) : null}
      </main>
    </AppShell>
  );
}
