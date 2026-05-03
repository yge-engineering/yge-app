// /certificates — bond / insurance / license tracker.
//
// Plain English: every certificate the company holds, with expiration
// tracking. Bid envelopes deep-link here for the CSLB and DIR records.
// Soonest-expiring rows float to the top so the renewal pipe is always
// visible.

import Link from 'next/link';

import {
  AppShell,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  certificateExpiryLevel,
  certificateKindLabel,
  certificateStatusLabel,
  computeCertificateRollup,
  daysUntilExpiry,
  type Certificate,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchCerts(): Promise<Certificate[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/certificates`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { certificates: Certificate[] }).certificates;
  } catch {
    return [];
  }
}

export default async function CertificatesPage() {
  const certs = await fetchCerts();
  const rollup = computeCertificateRollup(certs);
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('certs.title')}
          subtitle={t('certs.subtitle')}
          actions={
            <LinkButton href="/certificates/new" variant="primary" size="md">
              {t('certs.addCertificate')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('certs.tile.total')} value={rollup.total} />
          <Tile label={t('certs.tile.active')} value={rollup.active} tone="success" />
          <Tile
            label={t('certs.tile.expiringSoon')}
            value={rollup.expiringSoon}
            tone={rollup.expiringSoon > 0 ? 'warn' : 'neutral'}
          />
          <Tile
            label={t('certs.tile.expired')}
            value={rollup.expired}
            tone={rollup.expired > 0 ? 'danger' : 'neutral'}
          />
        </section>

        {certs.length === 0 ? (
          <EmptyState
            title={t('certs.empty.title')}
            body={t('certs.empty.body')}
            actions={[{ href: '/certificates/new', label: t('certs.empty.action'), primary: true }]}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t('certs.col.kind')}</th>
                  <th className="px-4 py-2">{t('certs.col.label')}</th>
                  <th className="px-4 py-2">{t('certs.col.issuer')}</th>
                  <th className="px-4 py-2">{t('certs.col.number')}</th>
                  <th className="px-4 py-2">{t('certs.col.limits')}</th>
                  <th className="px-4 py-2">{t('certs.col.expires')}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {certs.map((c) => {
                  const lvl = certificateExpiryLevel(c);
                  const days = daysUntilExpiry(c);
                  const rowClass =
                    lvl === 'expired' ? 'bg-red-50' : lvl === 'expiringSoon' ? 'bg-amber-50' : '';
                  return (
                    <tr key={c.id} className={rowClass}>
                      <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
                        {certificateKindLabel(c.kind)}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/certificates/${c.id}`} className="font-medium text-blue-700 hover:underline">
                          {c.label}
                        </Link>
                        {c.status !== 'ACTIVE' ? (
                          <div className="text-xs italic text-gray-500">{certificateStatusLabel(c.status)}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {c.issuingAuthority ?? <span className="text-gray-400">—</span>}
                        {c.agentName ? (
                          <div className="text-xs text-gray-500">
                            {c.agentName}
                            {c.agentPhone ? <> · {c.agentPhone}</> : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">
                        {c.certificateNumber ?? <span className="text-gray-400 font-sans">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {c.perOccurrenceLimitCents !== undefined ? (
                          <div><Money cents={c.perOccurrenceLimitCents} /> <span className="text-gray-500">{t('certs.perOcc')}</span></div>
                        ) : null}
                        {c.aggregateLimitCents !== undefined ? (
                          <div><Money cents={c.aggregateLimitCents} /> <span className="text-gray-500">{t('certs.agg')}</span></div>
                        ) : null}
                        {c.singleJobCapCents !== undefined ? (
                          <div><Money cents={c.singleJobCapCents} /> <span className="text-gray-500">{t('certs.singleJobCap')}</span></div>
                        ) : null}
                        {c.bondingAggregateCapCents !== undefined ? (
                          <div><Money cents={c.bondingAggregateCapCents} /> <span className="text-gray-500">{t('certs.bondAggCap')}</span></div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {c.expiresOn ? (
                          <>
                            <div className="text-gray-900">{c.expiresOn}</div>
                            <div
                              className={
                                lvl === 'expired'
                                  ? 'text-xs font-semibold text-red-700'
                                  : lvl === 'expiringSoon'
                                    ? 'text-xs font-semibold text-amber-700'
                                    : 'text-xs text-gray-500'
                              }
                            >
                              {days === undefined
                                ? ''
                                : days < 0
                                  ? t('certs.expiredAgo', { days: Math.abs(days) })
                                  : days === 0
                                    ? t('certs.expiresToday')
                                    : t('certs.daysRemaining', { days })}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">{t('certs.lifetime')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {c.pdfUrl ? (
                          <a
                            href={c.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:underline"
                          >
                            PDF
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
