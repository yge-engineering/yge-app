// /toolbox-talks — Cal/OSHA T8 §1509 weekly safety meeting tracker.
//
// Plain English: tailgate meetings every 10 working days. Records are
// inspectable. This page tells you when the last one was, whether
// you're overdue, and lists the talks you have on file.

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
import {
  computeToolboxTalkRollup,
  signedAttendeeCount,
  toolboxTalkStatusLabel,
  type ToolboxTalk,
  type ToolboxTalkStatus,
} from '@yge/shared';

const STATUSES: ToolboxTalkStatus[] = ['DRAFT', 'HELD', 'SUBMITTED'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchTalks(filter: { status?: string; jobId?: string }): Promise<ToolboxTalk[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/toolbox-talks`);
    if (filter.status) url.searchParams.set('status', filter.status);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { talks: ToolboxTalk[] }).talks;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<ToolboxTalk[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/toolbox-talks`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { talks: ToolboxTalk[] }).talks;
  } catch {
    return [];
  }
}

export default async function ToolboxTalksPage({
  searchParams,
}: {
  searchParams: { status?: string; jobId?: string };
}) {
  const [talks, all] = await Promise.all([fetchTalks(searchParams), fetchAll()]);
  const rollup = computeToolboxTalkRollup(all);

  function buildHref(overrides: Partial<{ status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.jobId) params.set('jobId', merged.jobId);
    const q = params.toString();
    return q ? `/toolbox-talks?${q}` : '/toolbox-talks';
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Toolbox talks"
          subtitle="Cal/OSHA T8 §1509 requires a tailgate safety meeting at least every 10 working days. Records are subject to inspection."
          actions={
            <LinkButton href="/toolbox-talks/new" variant="primary" size="md">
              + New toolbox talk
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total" value={rollup.total} />
          <Tile label="Last held" value={rollup.lastHeldOn ?? '—'} />
          <Tile
            label="Working days since"
            value={rollup.daysSinceLast ?? '—'}
            tone={rollup.overdue ? 'danger' : 'success'}
          />
          <Tile
            label="§1509 compliance"
            value={rollup.overdue ? 'OVERDUE' : 'Current'}
            tone={rollup.overdue ? 'danger' : 'success'}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Status:</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {toolboxTalkStatusLabel(s)}
            </Link>
          ))}
        </section>

        {talks.length === 0 ? (
          <EmptyState
            title="No toolbox talks yet"
            body="Log your tailgate safety meetings here. Cal/OSHA expects one every 10 working days; we'll flag you if you slip."
            actions={[{ href: '/toolbox-talks/new', label: 'Log a meeting', primary: true }]}
          />
        ) : (
          <DataTable
            rows={talks}
            keyFn={(t) => t.id}
            columns={[
              {
                key: 'heldOn',
                header: 'Held',
                cell: (t) => (
                  <Link href={`/toolbox-talks/${t.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {t.heldOn}
                  </Link>
                ),
              },
              { key: 'topic', header: 'Topic', cell: (t) => <span className="text-sm text-gray-900">{t.topic}</span> },
              { key: 'leader', header: 'Leader', cell: (t) => <span className="text-xs text-gray-700">{t.leaderName}</span> },
              {
                key: 'attendees',
                header: 'Attendees',
                numeric: true,
                cell: (t) => <span className="font-mono text-xs text-gray-700">{signedAttendeeCount(t)} / {t.attendees.length}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (t) => <StatusPill label={toolboxTalkStatusLabel(t.status)} tone="neutral" />,
              },
              {
                key: 'actions',
                header: '',
                cell: (t) => (
                  <Link href={`/toolbox-talks/${t.id}/sign-in`} className="text-xs text-blue-700 hover:underline">
                    Sign-in
                  </Link>
                ),
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
