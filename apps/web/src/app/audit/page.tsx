// /audit — global audit-event review.
//
// Plain English: who did what, when, with what before/after. Filters
// by entity type, action, actor, and date window. Per-record drill-in
// (the binder panel on every detail page) hits the same API with
// entityType + entityId set.
//
// CLAUDE.md: 'every mutation is audit-logged'. This page is where you
// answer 'when did the §4104 sub list get re-uploaded' or 'who voided
// that AP payment Tuesday afternoon'.

import Link from 'next/link';
import {
  Alert,
  AppShell,
  DataTable,
  PageHeader,
  StatusPill,
} from '../../components';
import { getTranslator, type Translator } from '../../lib/locale';
import {
  auditActionKey,
  changedFields,
  computeAuditRollup,
  type AuditAction,
  type AuditEntityType,
  type AuditEvent,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ListResponse {
  events: AuditEvent[];
  total: number;
}

async function fetchEvents(query: URLSearchParams): Promise<ListResponse> {
  try {
    const url = `${apiBaseUrl()}/api/audit-events?${query.toString()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { events: [], total: 0 };
    return (await res.json()) as ListResponse;
  } catch {
    return { events: [], total: 0 };
  }
}

const ACTION_TONE: Partial<Record<AuditAction, 'success' | 'warn' | 'danger' | 'info' | 'neutral' | 'muted'>> = {
  create: 'success',
  approve: 'success',
  pay: 'success',
  sign: 'success',
  post: 'success',
  reject: 'danger',
  void: 'danger',
  delete: 'danger',
  archive: 'muted',
  submit: 'info',
  answer: 'info',
  reopen: 'warn',
  update: 'neutral',
};

function actionTone(a: AuditAction): 'success' | 'warn' | 'danger' | 'info' | 'neutral' | 'muted' {
  return ACTION_TONE[a] ?? 'neutral';
}

interface SearchParams {
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  action?: string;
  fromDate?: string;
  toDate?: string;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) qs.set(k, v);
  }
  // Cap response so the UI stays snappy on large logs.
  qs.set('limit', '500');
  const data = await fetchEvents(qs);
  const rollup = computeAuditRollup(data.events);
  const t = getTranslator();

  const hasFilter = Boolean(
    searchParams.entityType ||
    searchParams.entityId ||
    searchParams.actorUserId ||
    searchParams.action ||
    searchParams.fromDate ||
    searchParams.toDate,
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Dashboard
          </Link>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>
              {data.events.length} of {data.total} event{data.total === 1 ? '' : 's'}
              {data.events.length < data.total && ' (capped — narrow with filters)'}
            </span>
            {data.events.length > 0 && (
              <a
                href={`${apiBaseUrl()}/api/audit-events/export.csv?${qs.toString()}`}
                className="rounded border border-yge-blue-500 px-2 py-0.5 font-medium text-yge-blue-500 hover:bg-yge-blue-50"
              >
                Export CSV
              </a>
            )}
          </div>
        </div>

        <PageHeader
          title={t('auditPage.title')}
          subtitle={t('auditPage.subtitle')}
        />

        <FilterForm initial={searchParams} t={t} />

        {data.events.length === 0 && hasFilter && (
          <Alert tone="info" className="mt-6">
            No events matched these filters.
          </Alert>
        )}

        {data.events.length === 0 && !hasFilter && (
          <Alert tone="info" className="mt-6">
            No audit events recorded yet. The log starts as soon as the
            first mutation runs through the app.
          </Alert>
        )}

        {data.events.length > 0 && (
          <>
            <Rollup rollup={rollup} t={t} />
            <div className="mt-6">
              <DataTable
                rows={data.events}
                keyFn={(e) => e.id}
                columns={[
                  {
                    key: 'when',
                    header: 'When',
                    cell: (e) => (
                      <time className="font-mono text-xs text-gray-700">
                        {e.createdAt.replace('T', ' ').slice(0, 16)}
                      </time>
                    ),
                  },
                  {
                    key: 'actor',
                    header: 'Actor',
                    cell: (e) => (
                      <span className="text-sm text-gray-900">
                        {e.actorUserId ?? <em className="text-gray-500">system</em>}
                      </span>
                    ),
                  },
                  {
                    key: 'action',
                    header: 'Action',
                    cell: (e) => (
                      <StatusPill label={e.action} tone={actionTone(e.action)} size="sm" />
                    ),
                  },
                  {
                    key: 'entity',
                    header: 'Record',
                    cell: (e) => (
                      <Link
                        href={`/audit?entityType=${e.entityType}&entityId=${encodeURIComponent(e.entityId)}`}
                        className="text-sm text-yge-blue-500 hover:underline"
                      >
                        {e.entityType} · {e.entityId}
                      </Link>
                    ),
                  },
                  {
                    key: 'changed',
                    header: 'Changed',
                    cell: (e) => {
                      const fields = changedFields(e.before, e.after);
                      if (fields.length === 0) return <span className="text-xs text-gray-400">—</span>;
                      const label = fields.slice(0, 3).join(', ') + (fields.length > 3 ? `, +${fields.length - 3} more` : '');
                      return <span className="text-xs text-gray-600 font-mono">{label}</span>;
                    },
                  },
                  {
                    key: 'reason',
                    header: 'Reason',
                    cell: (e) => (
                      <span className="text-xs italic text-gray-600">
                        {e.reason ?? ''}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </>
        )}

        <p className="mt-8 text-xs text-gray-500">
          Phase-1 audit log is file-backed under <code>data/audit-events/</code>.
          Migrates to Postgres alongside the rest of the API stores.
        </p>
      </main>
    </AppShell>
  );
}

function Rollup({ rollup, t }: { rollup: ReturnType<typeof computeAuditRollup>; t: Translator }) {
  return (
    <section className="mt-6 grid gap-3 sm:grid-cols-3">
      <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">{t('auditPage.tile.events')}</div>
        <div className="mt-1 text-2xl font-bold text-gray-900">{rollup.total}</div>
      </div>
      <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">{t('auditPage.tile.actors')}</div>
        <div className="mt-1 text-2xl font-bold text-gray-900">{rollup.distinctActors}</div>
      </div>
      <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-gray-500">{t('auditPage.tile.lastActivity')}</div>
        <div className="mt-1 text-sm text-gray-900 font-mono">
          {rollup.lastAt ? rollup.lastAt.replace('T', ' ').slice(0, 16) : '—'}
        </div>
      </div>
      {rollup.byActionKey.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm sm:col-span-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">{t('auditPage.tile.topActions')}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {rollup.byActionKey.slice(0, 8).map((row) => (
              <span
                key={row.key}
                className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-800"
              >
                {row.key} <span className="text-gray-500">×{row.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function FilterForm({ initial, t }: { initial: SearchParams; t: Translator }) {
  return (
    <form
      method="get"
      className="mt-4 grid gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm sm:grid-cols-3"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-700">{t('auditPage.filter.entityType')}</span>
        <input
          type="text"
          name="entityType"
          defaultValue={initial.entityType ?? ''}
          placeholder="ApInvoice / Estimate / Job …"
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-700">{t('auditPage.filter.entityId')}</span>
        <input
          type="text"
          name="entityId"
          defaultValue={initial.entityId ?? ''}
          placeholder="ap-12345678 …"
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-700">{t('auditPage.filter.actorUserId')}</span>
        <input
          type="text"
          name="actorUserId"
          defaultValue={initial.actorUserId ?? ''}
          placeholder="user-ryan …"
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-700">{t('auditPage.filter.action')}</span>
        <input
          type="text"
          name="action"
          defaultValue={initial.action ?? ''}
          placeholder="create / approve / pay / sign …"
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-700">{t('auditPage.filter.from')}</span>
        <input
          type="date"
          name="fromDate"
          defaultValue={initial.fromDate ?? ''}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-700">{t('auditPage.filter.to')}</span>
        <input
          type="date"
          name="toDate"
          defaultValue={initial.toDate ?? ''}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <div className="flex items-end gap-2 sm:col-span-3">
        <button
          type="submit"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          {t('auditPage.filter.submit')}
        </button>
        <Link
          href="/audit"
          className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-white"
        >
          {t('auditPage.filter.clear')}
        </Link>
      </div>
    </form>
  );
}

// Suppress the unused-import warning for `auditActionKey` — it's
// re-exported so consumers (the binder panels) can call it without
// importing through @yge/shared themselves.
export { auditActionKey };
