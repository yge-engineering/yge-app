// /plan-takeoffs — list view.
//
// Shows every saved PDF takeoff for this company. Each row links into the
// PlanEditor for measurement work.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
import type { PlanTakeoff } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchTakeoffs(): Promise<PlanTakeoff[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/plan-takeoffs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { takeoffs: PlanTakeoff[] }).takeoffs;
  } catch {
    return [];
  }
}

export default async function PlanTakeoffsPage() {
  requirePermission('estimates:view');
  const takeoffs = await fetchTakeoffs();

  const totalMeasurements = takeoffs.reduce(
    (n, t) => n + t.sheets.reduce((m, s) => m + s.measurements.length, 0),
    0,
  );
  const withScale = takeoffs.filter((t) => t.sheets.some((s) => s.scale != null)).length;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Plan takeoffs"
          subtitle="Drag-to-measure PDFs for bid takeoff. Calibrate scale per sheet, then use Length / Area / Count / Volume tools to drop measurements."
          actions={
            <LinkButton href="/plan-takeoffs/new" variant="primary" size="md">
              + New takeoff
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Tile label="Takeoffs" value={takeoffs.length} />
          <Tile label="With scale set" value={withScale} />
          <Tile label="Total measurements" value={totalMeasurements} />
        </section>

        {takeoffs.length === 0 ? (
          <EmptyState
            title="No takeoffs yet"
            body="Click + New takeoff, paste a PDF URL (a Document or any public link), and start measuring."
          />
        ) : (
          <DataTable
            rows={takeoffs}
            columns={[
              {
                key: 'name',
                header: 'Name',
                cell: (t) => (
                  <Link
                    href={`/plan-takeoffs/${t.id}`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    {t.name}
                  </Link>
                ),
              },
              {
                key: 'sheets',
                header: 'Sheets',
                numeric: true,
                cell: (t) => <span className="text-xs text-gray-700">{t.sheets.length}</span>,
              },
              {
                key: 'measurements',
                header: 'Measurements',
                numeric: true,
                cell: (t) => {
                  const n = t.sheets.reduce((s, sh) => s + sh.measurements.length, 0);
                  return (
                    <span className={n > 0 ? 'font-semibold text-emerald-800' : 'text-gray-500'}>
                      {n}
                    </span>
                  );
                },
              },
              {
                key: 'scale',
                header: 'Scale',
                cell: (t) => {
                  const calibrated = t.sheets.filter((s) => s.scale != null).length;
                  return calibrated > 0 ? (
                    <StatusPill label={`${calibrated} / ${t.sheets.length || '?'}`} tone="success" />
                  ) : (
                    <StatusPill label="not set" tone="warn" />
                  );
                },
              },
              {
                key: 'links',
                header: 'Linked to',
                cell: (t) => (
                  <span className="text-xs text-gray-600">
                    {t.bidId ? `bid ${t.bidId}` : null}
                    {t.bidId && t.jobId ? ' · ' : null}
                    {t.jobId ? `job ${t.jobId}` : null}
                    {!t.bidId && !t.jobId ? '—' : null}
                  </span>
                ),
              },
              {
                key: 'updated',
                header: 'Updated',
                cell: (t) => (
                  <span className="font-mono text-xs text-gray-600">
                    {t.updatedAt.slice(0, 10)}
                  </span>
                ),
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
