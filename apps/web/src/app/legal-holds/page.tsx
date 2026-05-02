// /legal-holds — list of every legal hold + create form.
//
// Each hold freezes its entities[] from the records-retention
// purge job. Releasing the hold is its own audit-logged action.

import Link from 'next/link';
import {
  Alert,
  AppShell,
  PageHeader,
  StatusPill,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import { LegalHoldCreateForm } from '@/components/legal-hold-create-form';
import { LegalHoldReleaseButton } from '@/components/legal-hold-release-button';
import {
  computeLegalHoldRollup,
  type LegalHold,
  type LegalHoldStatus,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface ListResponse { holds: LegalHold[] }

async function fetchHolds(): Promise<LegalHold[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/legal-holds`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as ListResponse).holds;
  } catch { return []; }
}

const STATUS_TONE: Record<LegalHoldStatus, 'success' | 'warn' | 'danger' | 'muted' | 'neutral'> = {
  ACTIVE: 'danger',
  RELEASED: 'success',
  EXPIRED: 'muted',
};

export default async function LegalHoldsPage() {
  const holds = await fetchHolds();
  const rollup = computeLegalHoldRollup(holds);
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Dashboard
          </Link>
          <span className="text-xs text-gray-500">
            {holds.length} hold{holds.length === 1 ? '' : 's'}
          </span>
        </div>

        <PageHeader
          title={t('legalHolds.title')}
          subtitle={t('legalHolds.subtitle')}
        />

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tile label={t('legalHolds.tile.active')} value={String(rollup.byStatus.ACTIVE)} tone="danger" />
          <Tile label={t('legalHolds.tile.released')} value={String(rollup.byStatus.RELEASED)} tone="success" />
          <Tile label={t('legalHolds.tile.staleActive')} value={String(rollup.staleActiveCount)} tone="warn" />
        </section>

        {rollup.staleActiveCount > 0 && (
          <Alert
            tone="warn"
            className="mt-4"
            title={`${rollup.staleActiveCount} active hold${rollup.staleActiveCount === 1 ? '' : 's'} >1 year old`}
          >
            {t('legalHolds.staleAlert.body')}
          </Alert>
        )}

        {holds.length === 0 ? (
          <Alert tone="info" className="mt-6">
            {t('legalHolds.empty')}
          </Alert>
        ) : (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">{t('legalHolds.col.status')}</th>
                  <th className="px-3 py-2 text-left">{t('legalHolds.col.titleReason')}</th>
                  <th className="px-3 py-2 text-left">{t('legalHolds.col.entities')}</th>
                  <th className="px-3 py-2 text-left">{t('legalHolds.col.matterDate')}</th>
                  <th className="px-3 py-2 text-right">{t('legalHolds.col.action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {holds.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2">
                      <StatusPill label={h.status} tone={STATUS_TONE[h.status]} size="sm" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{h.title}</div>
                      <div className="text-xs text-gray-500">{h.reason}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {h.entities.map((e, i) => (
                        <div key={i} className="font-mono text-gray-700">
                          {e.entityType} · {e.entityId}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{h.matterDate}</td>
                    <td className="px-3 py-2 text-right">
                      {h.status === 'ACTIVE' ? (
                        <LegalHoldReleaseButton apiBaseUrl={publicApiBaseUrl()} holdId={h.id} />
                      ) : (
                        <span className="text-xs text-gray-500">{h.releasedAt?.slice(0, 10)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <LegalHoldCreateForm apiBaseUrl={publicApiBaseUrl()} />
      </main>
    </AppShell>
  );
}

function Tile({
  label, value, tone,
}: { label: string; value: string; tone?: 'success' | 'warn' | 'danger' }) {
  const valueClass =
    tone === 'success' ? 'text-emerald-700'
    : tone === 'warn' ? 'text-amber-700'
    : tone === 'danger' ? 'text-red-700'
    : 'text-gray-900';
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
