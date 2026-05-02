// /signatures — list every e-signature row.
//
// Filter chips for status; per-row link out to the audit binder
// panel for the signature record (entityType=Signature). Drives the
// 'who signed what when' query that comes up in legal review.

import Link from 'next/link';
import {
  Alert,
  AppShell,
  PageHeader,
  StatusPill,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  computeSignatureRollup,
  isLegallyBinding,
  type Signature,
  type SignatureStatus,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ListResponse { signatures: Signature[] }

async function fetchSignatures(qs: URLSearchParams): Promise<Signature[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/signatures?${qs.toString()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as ListResponse).signatures;
  } catch { return []; }
}

const STATUS_TONE: Record<SignatureStatus, 'success' | 'warn' | 'danger' | 'muted' | 'neutral'> = {
  DRAFT: 'warn',
  SIGNED: 'success',
  VOIDED: 'danger',
  EXPIRED: 'muted',
  DECLINED: 'muted',
};

interface SearchParams {
  status?: string;
  documentType?: string;
  jobId?: string;
  signerEmail?: string;
}

export default async function SignaturesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) qs.set(k, v);
  }
  const signatures = await fetchSignatures(qs);
  const rollup = computeSignatureRollup(signatures);
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Dashboard
          </Link>
          <span className="text-xs text-gray-500">
            {signatures.length} row{signatures.length === 1 ? '' : 's'}
          </span>
        </div>

        <PageHeader
          title={t('signatures.title')}
          subtitle={t('signatures.subtitle')}
        />

        <section className="mt-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('signatures.tile.total')} value={String(rollup.total)} />
          <Tile label={t('signatures.tile.signed')} value={String(rollup.byStatus.SIGNED)} tone="success" />
          <Tile label={t('signatures.tile.drafts')} value={String(rollup.byStatus.DRAFT)} tone="warn" />
          <Tile label={t('signatures.tile.binding')} value={String(rollup.bindingCount)} />
        </section>

        {signatures.length === 0 ? (
          <Alert tone="info" className="mt-6">
            {t('signatures.empty')}
          </Alert>
        ) : (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">{t('signatures.col.status')}</th>
                  <th className="px-3 py-2 text-left">{t('signatures.col.document')}</th>
                  <th className="px-3 py-2 text-left">{t('signatures.col.signer')}</th>
                  <th className="px-3 py-2 text-left">{t('signatures.col.method')}</th>
                  <th className="px-3 py-2 text-left">{t('signatures.col.signed')}</th>
                  <th className="px-3 py-2 text-right">{t('signatures.col.action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {signatures.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">
                      <StatusPill label={s.status} tone={STATUS_TONE[s.status]} size="sm" />
                      {isLegallyBinding(s) && (
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-800">
                          {t('signatures.binding')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{s.document.displayName}</div>
                      <div className="text-xs text-gray-500">{s.document.documentType}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-sm text-gray-900">{s.signer.name}</div>
                      <div className="text-xs text-gray-500">{s.signer.email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs uppercase tracking-wide text-gray-700">
                      {s.method}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-600">
                      {s.signedAt ? s.signedAt.replace('T', ' ').slice(0, 16) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {s.status === 'DRAFT' ? (
                        <Link
                          href={`/sign/${s.id}`}
                          className="rounded bg-yge-blue-500 px-2 py-1 text-xs font-medium text-white hover:bg-yge-blue-700"
                        >
                          {t('signatures.openToSign')}
                        </Link>
                      ) : (
                        <Link
                          href={`/audit?entityType=Signature&entityId=${encodeURIComponent(s.id)}`}
                          className="text-xs text-yge-blue-500 hover:underline"
                        >
                          {t('signatures.auditTrail')} →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warn' | 'danger';
}) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'danger'
          ? 'text-red-700'
          : 'text-gray-900';
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
