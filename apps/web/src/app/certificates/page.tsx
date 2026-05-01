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

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Bonds, insurance, licenses"
          subtitle="Every certificate the company holds, with expiration tracking. Bid envelopes deep-link here for CSLB and DIR records."
          actions={
            <LinkButton href="/certificates/new" variant="primary" size="md">
              + Add certificate
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total" value={rollup.total} />
          <Tile label="Active" value={rollup.active} tone="success" />
          <Tile
            label="Expiring soon"
            value={rollup.expiringSoon}
            tone={rollup.expiringSoon > 0 ? 'warn' : 'neutral'}
          />
          <Tile
            label="Expired"
            value={rollup.expired}
            tone={rollup.expired > 0 ? 'danger' : 'neutral'}
          />
        </section>

        {certs.length === 0 ? (
          <EmptyState
            title="No certificates yet"
            body="Add CSLB licenses, DIR registration, insurance policies, and bonding profiles. Bid envelopes will deep-link here once it's loaded."
            actions={[{ href: '/certificates/new', label: 'Add certificate', primary: true }]}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Kind</th>
                  <th className="px-4 py-2">Label</th>
                  <th className="px-4 py-2">Issuer / Carrier</th>
                  <th className="px-4 py-2">Number</th>
                  <th className="px-4 py-2">Limits / Caps</th>
                  <th className="px-4 py-2">Expires</th>
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
                          <div><Money cents={c.perOccurrenceLimitCents} /> <span className="text-gray-500">per occ.</span></div>
                        ) : null}
                        {c.aggregateLimitCents !== undefined ? (
                          <div><Money cents={c.aggregateLimitCents} /> <span className="text-gray-500">agg.</span></div>
                        ) : null}
                        {c.singleJobCapCents !== undefined ? (
                          <div><Money cents={c.singleJobCapCents} /> <span className="text-gray-500">single-job cap</span></div>
                        ) : null}
                        {c.bondingAggregateCapCents !== undefined ? (
                          <div><Money cents={c.bondingAggregateCapCents} /> <span className="text-gray-500">bond agg. cap</span></div>
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
                                  ? `EXPIRED ${Math.abs(days)} d ago`
                                  : days === 0
                                    ? 'expires today'
                                    : `${days} d remaining`}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">Lifetime</span>
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
