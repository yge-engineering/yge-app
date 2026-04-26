// /certificates — bond / insurance / license tracker.
//
// Server component. Lists every certificate, color-codes by expiry
// urgency, and shows a top-of-page rollup with active/expiring/expired
// counts. Soonest-expiring rows float to the top so the renewal pipe
// is always visible.

import Link from 'next/link';
import {
  certificateExpiryLevel,
  certificateKindLabel,
  certificateStatusLabel,
  computeCertificateRollup,
  daysUntilExpiry,
  formatUSD,
  type Certificate,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchCerts(): Promise<Certificate[]> {
  const res = await fetch(`${apiBaseUrl()}/api/certificates`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { certificates: Certificate[] }).certificates;
}

export default async function CertificatesPage() {
  const certs = await fetchCerts();
  const rollup = computeCertificateRollup(certs);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/certificates/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + Add certificate
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">
        Bonds, insurance, licenses
      </h1>
      <p className="mt-2 text-gray-700">
        Every certificate the company holds, with expiration tracking. Bid
        envelopes deep-link here for the CSLB and DIR records.
      </p>

      {/* Rollup */}
      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={rollup.total} />
        <Stat label="Active" value={rollup.active} variant="ok" />
        <Stat
          label="Expiring soon"
          value={rollup.expiringSoon}
          variant={rollup.expiringSoon > 0 ? 'warn' : 'neutral'}
        />
        <Stat
          label="Expired"
          value={rollup.expired}
          variant={rollup.expired > 0 ? 'bad' : 'neutral'}
        />
      </section>

      {certs.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No certificates yet. Click <em>Add certificate</em> to log a CSLB
          license, DIR registration, insurance policy, or bonding profile.
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                  lvl === 'expired'
                    ? 'bg-red-50'
                    : lvl === 'expiringSoon'
                      ? 'bg-yellow-50'
                      : '';
                return (
                  <tr key={c.id} className={rowClass}>
                    <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
                      {certificateKindLabel(c.kind)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.label}</div>
                      {c.status !== 'ACTIVE' && (
                        <div className="text-xs italic text-gray-500">
                          {certificateStatusLabel(c.status)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {c.issuingAuthority ?? <span className="text-gray-400">&mdash;</span>}
                      {c.agentName && (
                        <div className="text-xs text-gray-500">
                          {c.agentName}
                          {c.agentPhone && (
                            <>
                              {' '}\u00b7 {c.agentPhone}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {c.certificateNumber ?? <span className="text-gray-400 font-sans">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {c.perOccurrenceLimitCents !== undefined && (
                        <div>
                          {formatUSD(c.perOccurrenceLimitCents)}{' '}
                          <span className="text-gray-500">per occ.</span>
                        </div>
                      )}
                      {c.aggregateLimitCents !== undefined && (
                        <div>
                          {formatUSD(c.aggregateLimitCents)}{' '}
                          <span className="text-gray-500">agg.</span>
                        </div>
                      )}
                      {c.singleJobCapCents !== undefined && (
                        <div>
                          {formatUSD(c.singleJobCapCents)}{' '}
                          <span className="text-gray-500">single-job cap</span>
                        </div>
                      )}
                      {c.bondingAggregateCapCents !== undefined && (
                        <div>
                          {formatUSD(c.bondingAggregateCapCents)}{' '}
                          <span className="text-gray-500">bond agg. cap</span>
                        </div>
                      )}
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
                                  ? 'text-xs font-semibold text-yellow-700'
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
                      {c.pdfUrl && (
                        <a
                          href={c.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mr-3 text-yge-blue-500 hover:underline"
                        >
                          PDF
                        </a>
                      )}
                      <Link
                        href={`/certificates/${c.id}`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: number;
  variant?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const cls =
    variant === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : variant === 'warn'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : variant === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
